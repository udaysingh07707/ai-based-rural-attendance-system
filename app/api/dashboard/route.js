import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";
import { requireTeacher } from "../../../lib/auth.js";

function dateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export async function GET(request) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const todayText = new URL(request.url).searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const today = dateOnly(todayText);
  if (!today) return NextResponse.json({ error: "Enter a valid date." }, { status: 400 });

  try {
    const [totalStudents, classes, sessions, recentEntries] = await Promise.all([
      db.student.count({ where: { isActive: true, class: { schoolId: teacher.schoolId, isActive: true } } }),
      db.schoolClass.findMany({
        where: { schoolId: teacher.schoolId, isActive: true },
        orderBy: [{ name: "asc" }, { section: "asc" }],
        include: { students: { where: { isActive: true }, select: { id: true } } },
      }),
      db.attendanceSession.findMany({
        where: { date: today, class: { schoolId: teacher.schoolId, isActive: true } },
        include: { entries: { where: { student: { isActive: true } }, select: { studentId: true, status: true } } },
      }),
      db.attendanceEntry.findMany({
        where: { session: { class: { schoolId: teacher.schoolId } } },
        orderBy: { markedAt: "desc" },
        take: 6,
        include: { student: true, session: { include: { class: true } } },
      }),
    ]);

    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    const todayMarks = [];
    for (const session of sessions) {
      for (const entry of session.entries) {
        const status = entry.status.toLowerCase();
        counts[status] += 1;
        todayMarks.push({ classId: session.classId, studentId: entry.studentId, status });
      }
    }
    const classAttendance = classes.map((classItem) => {
      const marks = sessions.filter((session) => session.classId === classItem.id).flatMap((session) => session.entries);
      const classCounts = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const entry of marks) classCounts[entry.status.toLowerCase()] += 1;
      const marked = marks.length;
      return {
        id: classItem.id,
        name: classItem.name,
        section: classItem.section,
        totalStudents: classItem.students.length,
        markedStudents: marked,
        ...classCounts,
        attendancePercentage: marked ? Math.round(((classCounts.present + classCounts.late) / marked) * 1000) / 10 : 0,
      };
    });
    const marked = todayMarks.length;
    const recentActivity = recentEntries.map((entry) => ({
      studentId: entry.studentId,
      studentName: entry.student?.name ?? "Archived student",
      classId: entry.session.classId,
      className: `${entry.session.class.name} - ${entry.session.class.section}`,
      date: entry.session.date.toISOString().slice(0, 10),
      status: entry.status.toLowerCase(),
      markedAt: entry.markedAt.toISOString(),
    }));

    return NextResponse.json({
      date: todayText,
      totalStudents,
      totalClasses: classes.length,
      today: {
        ...counts,
        markedStudents: marked,
        attendancePercentage: marked ? Math.round(((counts.present + counts.late) / marked) * 1000) / 10 : 0,
      },
      classAttendance,
      recentActivity,
    });
  } catch (error) {
    console.error("Loading dashboard summary failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return NextResponse.json({ error: "Could not load the dashboard summary." }, { status: 500 });
  }
}
