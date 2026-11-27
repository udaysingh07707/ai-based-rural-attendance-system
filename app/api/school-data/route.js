import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";
import { requireTeacher } from "../../../lib/auth.js";

export async function GET() {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const [classes, students, sessions] = await Promise.all([
      db.schoolClass.findMany({ where: { schoolId: teacher.schoolId, isActive: true }, orderBy: [{ name: "asc" }, { section: "asc" }] }),
      db.student.findMany({ where: { isActive: true, class: { schoolId: teacher.schoolId, isActive: true } }, orderBy: [{ name: "asc" }] }),
      db.attendanceSession.findMany({ where: { class: { schoolId: teacher.schoolId } }, include: { entries: true } }),
    ]);
    const attendance = {};
    for (const session of sessions) {
      const date = session.date.toISOString().slice(0, 10);
      attendance[`${date}:${session.classId}`] = Object.fromEntries(session.entries.map((entry) => [entry.studentId, entry.status.toLowerCase()]));
    }
    return NextResponse.json({ classes, students, attendance });
  } catch (error) {
    console.error("Loading school data failed", error);
    return NextResponse.json({ error: "Could not load school data." }, { status: 500 });
  }
}
