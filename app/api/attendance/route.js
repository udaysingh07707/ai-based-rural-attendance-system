import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";
import { requireTeacher } from "../../../lib/auth.js";
import { jsonError, readJson } from "../../../lib/api.js";

export async function POST(request) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const body = await readJson(request);
  const { classId, date, statuses } = body ?? {};
  if (typeof classId !== "string" || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !statuses || typeof statuses !== "object" || Array.isArray(statuses) || Object.values(statuses).some((status) => !["present", "absent", "late", "excused"].includes(status))) return jsonError("Invalid attendance details.");
  const day = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== date) return jsonError("Enter a valid attendance date.");
  try {
    const roster = await db.student.findMany({ where: { classId, isActive: true, class: { schoolId: teacher.schoolId, isActive: true } }, select: { id: true } });
    if (!roster.length) return jsonError("Class not found or has no students.", 404);
    if (roster.length !== Object.keys(statuses).length || roster.some((student) => !Object.hasOwn(statuses, student.id))) return jsonError("Mark every student in the class before saving.");
    const session = await db.$transaction(async (tx) => {
      const savedSession = await tx.attendanceSession.upsert({ where: { classId_date: { classId, date: day } }, create: { classId, date: day }, update: {} });
      for (const [studentId, status] of Object.entries(statuses)) await tx.attendanceEntry.upsert({ where: { sessionId_studentId: { sessionId: savedSession.id, studentId } }, create: { sessionId: savedSession.id, studentId, status: status.toUpperCase() }, update: { status: status.toUpperCase(), markedAt: new Date() } });
      return savedSession;
    });
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("Saving attendance failed", error);
    return jsonError("Could not save attendance.", 500);
  }
}
