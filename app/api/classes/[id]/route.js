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
      const result = await tx.schoolClass.updateMany({ where: { id, schoolId: teacher.schoolId, isActive: true }, data: { isActive: false } });
      if (!result.count) return false;
      await tx.student.updateMany({ where: { classId: id, isActive: true }, data: { isActive: false } });
      return true;
    });
    return archived ? NextResponse.json({ ok: true, archived: true }) : jsonError("Class not found.", 404);
  } catch (error) {
    console.error("Archiving class failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not archive class.", 500);
  }
}
