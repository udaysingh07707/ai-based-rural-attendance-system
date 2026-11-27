import { NextResponse } from "next/server";
import { db } from "../../../../lib/db.js";
import { requireTeacher } from "../../../../lib/auth.js";
import { jsonError, readJson } from "../../../../lib/api.js";

export async function PUT(request, { params }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const { id } = await params;
  const body = await readJson(request);
  const { name, classId, rollNumber, age, guardianName } = body ?? {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120 || typeof classId !== "string" || !classId || typeof rollNumber !== "string" || !rollNumber.trim() || rollNumber.trim().length > 32 || !Number.isInteger(age) || age < 3 || age > 25 || typeof guardianName !== "string" || !guardianName.trim() || guardianName.trim().length > 120) return jsonError("Enter valid student details.");
  try {
    const belongs = await db.schoolClass.findFirst({ where: { id: classId, schoolId: teacher.schoolId, isActive: true }, select: { id: true } });
    if (!belongs) return jsonError("Class not found.", 404);
    const result = await db.student.updateMany({ where: { id, isActive: true, class: { schoolId: teacher.schoolId, isActive: true } }, data: { name: name.trim(), classId, rollNumber: rollNumber.trim(), age, guardianName: guardianName.trim() } });
    if (!result.count) return jsonError("Student not found.", 404);
    return NextResponse.json({ student: await db.student.findUnique({ where: { id } }) });
  } catch (error) {
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
    const result = await db.student.updateMany({ where: { id, isActive: true, class: { schoolId: teacher.schoolId, isActive: true } }, data: { isActive: false } });
    return result.count ? NextResponse.json({ ok: true, archived: true }) : jsonError("Student not found.", 404);
  } catch (error) {
    console.error("Archiving student failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not archive student.", 500);
  }
}
