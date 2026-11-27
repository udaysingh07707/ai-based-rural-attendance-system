import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";
import { requireTeacher } from "../../../lib/auth.js";
import { jsonError, readJson } from "../../../lib/api.js";

export async function GET() {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  try {
    const students = await db.student.findMany({
      where: { isActive: true, class: { schoolId: teacher.schoolId, isActive: true } },
      orderBy: [{ name: "asc" }, { rollNumber: "asc" }],
    });
    return NextResponse.json({ students });
  } catch (error) {
    console.error("Loading students failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not load students.", 500);
  }
}

export async function POST(request) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const body = await readJson(request);
  const { name, classId, rollNumber, age, guardianName } = body ?? {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120 || typeof classId !== "string" || !classId || typeof rollNumber !== "string" || !rollNumber.trim() || rollNumber.trim().length > 32 || !Number.isInteger(age) || age < 3 || age > 25 || typeof guardianName !== "string" || !guardianName.trim() || guardianName.trim().length > 120) return jsonError("Enter valid student details.");
  try {
    const belongs = await db.schoolClass.findFirst({ where: { id: classId, schoolId: teacher.schoolId, isActive: true }, select: { id: true } });
    if (!belongs) return jsonError("Class not found.", 404);
    const student = await db.student.create({ data: { name: name.trim(), classId, rollNumber: rollNumber.trim(), age, guardianName: guardianName.trim() } });
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") return jsonError("That roll number is already used in this class.", 409);
    console.error("Creating student failed", error);
    return jsonError("Could not create student.", 500);
  }
}
