import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";
import { requireTeacher } from "../../../lib/auth.js";
import { jsonError, readJson } from "../../../lib/api.js";

export async function POST(request) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const body = await readJson(request);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const section = typeof body?.section === "string" ? body.section.trim() : "";
  if (!name || !section || name.length > 80 || section.length > 32) return jsonError("Enter a class name (up to 80 characters) and section (up to 32 characters).");
  try {
    const item = await db.schoolClass.create({ data: { schoolId: teacher.schoolId, name, section } });
    return NextResponse.json({ class: item }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") return jsonError("That class and section already exist.", 409);
    console.error("Creating class failed", error);
    return jsonError("Could not create class.", 500);
  }
}
