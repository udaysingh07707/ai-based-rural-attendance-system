import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";
import { requireTeacher } from "../../../lib/auth.js";
import { jsonError } from "../../../lib/api.js";
import { isStudentPhotoActionValid, readStudentRequest, StudentPhotoError, validateAndPrepareStudentPhoto } from "../../../lib/student-photo.js";

export async function GET() {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  try {
    const students = await db.student.findMany({
      where: { isActive: true, class: { schoolId: teacher.schoolId, isActive: true } },
      orderBy: [{ name: "asc" }, { rollNumber: "asc" }],
      include: { profilePhoto: { select: { studentId: true } } },
    });
    return NextResponse.json({ students: students.map(({ profilePhoto, ...student }) => ({ ...student, hasProfilePhoto: Boolean(profilePhoto) })) });
  } catch (error) {
    console.error("Loading students failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not load students.", 500);
  }
}

export async function POST(request) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  let parsed;
  try { parsed = await readStudentRequest(request); }
  catch (error) { if (error instanceof StudentPhotoError) return jsonError(error.message); throw error; }
  const { body, photo, photoAction } = parsed;
  const { name, classId, rollNumber, age, guardianName } = body ?? {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120 || typeof classId !== "string" || !classId || typeof rollNumber !== "string" || !rollNumber.trim() || rollNumber.trim().length > 32 || !Number.isInteger(age) || age < 3 || age > 25 || typeof guardianName !== "string" || !guardianName.trim() || guardianName.trim().length > 120) return jsonError("Enter valid student details.");
  if (!isStudentPhotoActionValid(photoAction, photo, true)) return jsonError("Choose a photo or remove the selected photo, then try again.");
  try {
    const belongs = await db.schoolClass.findFirst({ where: { id: classId, schoolId: teacher.schoolId, isActive: true }, select: { id: true } });
    if (!belongs) return jsonError("Class not found.", 404);
    const preparedPhoto = photo ? await validateAndPrepareStudentPhoto(photo) : null;
    const student = await db.$transaction(async (tx) => {
      const created = await tx.student.create({ data: { name: name.trim(), classId, rollNumber: rollNumber.trim(), age, guardianName: guardianName.trim() } });
      if (preparedPhoto) await tx.studentPhoto.create({ data: { studentId: created.id, ...preparedPhoto } });
      return { ...created, hasProfilePhoto: Boolean(preparedPhoto) };
    });
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (error instanceof StudentPhotoError) return jsonError(error.message);
    if (error?.code === "P2002") return jsonError("That roll number is already used in this class.", 409);
    console.error("Creating student failed", { code: error?.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not create student.", 500);
  }
}
