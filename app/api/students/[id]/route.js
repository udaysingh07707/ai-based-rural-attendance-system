import { NextResponse } from "next/server";
import { db } from "../../../../lib/db.js";
import { requireTeacher } from "../../../../lib/auth.js";
import { jsonError } from "../../../../lib/api.js";
import { isStudentPhotoActionValid, readStudentRequest, StudentPhotoError, validateAndPrepareStudentPhoto } from "../../../../lib/student-photo.js";

export async function PUT(request, { params }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const { id } = await params;
  let parsed;
  try { parsed = await readStudentRequest(request); }
  catch (error) { if (error instanceof StudentPhotoError) return jsonError(error.message); throw error; }
  const { body, photo, photoAction } = parsed;
  const { name, classId, rollNumber, age, guardianName } = body ?? {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120 || typeof classId !== "string" || !classId || typeof rollNumber !== "string" || !rollNumber.trim() || rollNumber.trim().length > 32 || !Number.isInteger(age) || age < 3 || age > 25 || typeof guardianName !== "string" || !guardianName.trim() || guardianName.trim().length > 120) return jsonError("Enter valid student details.");
  if (!isStudentPhotoActionValid(photoAction, photo)) return jsonError("Choose a photo or remove the selected photo, then try again.");
  try {
    const belongs = await db.schoolClass.findFirst({ where: { id: classId, schoolId: teacher.schoolId, isActive: true }, select: { id: true } });
    if (!belongs) return jsonError("Class not found.", 404);
    const preparedPhoto = photo ? await validateAndPrepareStudentPhoto(photo) : null;
    const student = await db.$transaction(async (tx) => {
      const result = await tx.student.updateMany({ where: { id, isActive: true, class: { schoolId: teacher.schoolId, isActive: true } }, data: { name: name.trim(), classId, rollNumber: rollNumber.trim(), age, guardianName: guardianName.trim() } });
      if (!result.count) return null;
      if (photoAction === "replace") await tx.studentPhoto.upsert({ where: { studentId: id }, create: { studentId: id, ...preparedPhoto }, update: preparedPhoto });
      if (photoAction === "remove") await tx.studentPhoto.deleteMany({ where: { studentId: id } });
      const updated = await tx.student.findUnique({ where: { id } });
      return { ...updated, hasProfilePhoto: photoAction === "replace" || (photoAction === "keep" && Boolean(await tx.studentPhoto.findUnique({ where: { studentId: id }, select: { studentId: true } }))) };
    });
    if (!student) return jsonError("Student not found.", 404);
    return NextResponse.json({ student });
  } catch (error) {
    if (error instanceof StudentPhotoError) return jsonError(error.message);
    if (error?.code === "P2002") return jsonError("That roll number is already used in this class.", 409);
    console.error("Updating student failed", error);
    return jsonError("Could not update student.", 500);
  }
}

export async function DELETE(_request, { params }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const { id } = await params;
  try {
    const archived = await db.$transaction(async (tx) => {
      // Match enrollment's consent-first lock order so an in-flight enrollment
      // cannot recreate a template after the student is archived.
      await tx.$queryRaw`
        SELECT "id"
        FROM "FaceConsent"
        WHERE "studentId" = ${id}
          AND "activeStudentId" = ${id}
          AND "schoolId" = ${teacher.schoolId}
          AND "revokedAt" IS NULL
        FOR UPDATE
      `;
      const result = await tx.student.updateMany({ where: { id, isActive: true, class: { schoolId: teacher.schoolId, isActive: true } }, data: { isActive: false } });
      if (result.count) {
        const revokedAt = new Date();
        await tx.faceConsent.updateMany({ where: { studentId: id, schoolId: teacher.schoolId, activeStudentId: id, revokedAt: null }, data: { revokedAt, activeStudentId: null } });
        await tx.studentFaceTemplate.deleteMany({ where: { studentId: id } });
      }
      return result.count;
    });
    return archived ? NextResponse.json({ ok: true, archived: true }) : jsonError("Student not found.", 404);
  } catch (error) {
    console.error("Archiving student failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not archive student.", 500);
  }
}
