import { NextResponse } from "next/server";
import { db } from "../../../../lib/db.js";
import { requireTeacher } from "../../../../lib/auth.js";
import { jsonError, readJson } from "../../../../lib/api.js";

export async function PUT(request, { params }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const { id } = await params;
  const body = await readJson(request);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const section = typeof body?.section === "string" ? body.section.trim() : "";
  if (!name || !section || name.length > 80 || section.length > 32) return jsonError("Enter a class name (up to 80 characters) and section (up to 32 characters).");
  try {
    const result = await db.schoolClass.updateMany({ where: { id, schoolId: teacher.schoolId, isActive: true }, data: { name, section } });
    if (!result.count) return jsonError("Class not found.", 404);
    return NextResponse.json({ class: await db.schoolClass.findUnique({ where: { id } }) });
  } catch (error) {
    if (error?.code === "P2002") return jsonError("That class and section already exist.", 409);
    console.error("Updating class failed", error);
    return jsonError("Could not update class.", 500);
  }
}

export async function DELETE(_request, { params }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const { id } = await params;
  try {
    const archived = await db.$transaction(async (tx) => {
      // Lock affected consent rows in a stable order before archiving students,
      // using the same consent-first order as enrollment and revocation.
      await tx.$queryRaw`
        SELECT "id"
        FROM "FaceConsent"
        WHERE "classId" = ${id}
          AND "schoolId" = ${teacher.schoolId}
          AND "activeStudentId" IS NOT NULL
          AND "revokedAt" IS NULL
        ORDER BY "id"
        FOR UPDATE
      `;
      const result = await tx.schoolClass.updateMany({ where: { id, schoolId: teacher.schoolId, isActive: true }, data: { isActive: false } });
      if (!result.count) return false;
      await tx.student.updateMany({ where: { classId: id, isActive: true }, data: { isActive: false } });
      await tx.faceConsent.updateMany({ where: { classId: id, schoolId: teacher.schoolId, activeStudentId: { not: null }, revokedAt: null }, data: { revokedAt: new Date(), activeStudentId: null } });
      await tx.studentFaceTemplate.deleteMany({ where: { student: { classId: id } } });
      return true;
    });
    return archived ? NextResponse.json({ ok: true, archived: true }) : jsonError("Class not found.", 404);
  } catch (error) {
    console.error("Archiving class failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not archive class.", 500);
  }
}
