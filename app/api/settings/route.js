import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";
import { requireTeacher } from "../../../lib/auth.js";
import { jsonError, readJson } from "../../../lib/api.js";

export async function PATCH(request) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const body = await readJson(request);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const schoolName = typeof body?.schoolName === "string" ? body.schoolName.trim() : undefined;
  if (name === undefined && schoolName === undefined) return jsonError("Provide a profile name or school name to update.");
  if (name !== undefined && (!name || name.length > 160)) return jsonError("Name must be between 1 and 160 characters.");
  if (schoolName !== undefined && (!schoolName || schoolName.length > 120)) return jsonError("School name must be between 1 and 120 characters.");

  try {
    const updatedTeacher = await db.$transaction(async (tx) => {
      if (schoolName !== undefined) {
        await tx.school.update({ where: { id: teacher.schoolId }, data: { name: schoolName } });
      }
      if (name !== undefined) {
        const [firstName, ...rest] = name.split(/\s+/);
        await tx.teacher.updateMany({
          where: { id: teacher.id, schoolId: teacher.schoolId },
          data: { name, firstName, lastName: rest.join(" ") || null },
        });
      }
      return tx.teacher.findUnique({
        where: { id: teacher.id },
        select: { id: true, name: true, firstName: true, lastName: true, email: true, role: true, emailVerifiedAt: true, school: { select: { name: true } } },
      });
    });
    if (!updatedTeacher) return jsonError("Teacher account not found.", 404);
    return NextResponse.json({ teacher: updatedTeacher });
  } catch (error) {
    console.error("Updating account settings failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not update account settings.", 500);
  }
}
