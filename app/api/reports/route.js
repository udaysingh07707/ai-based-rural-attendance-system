import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";
import { requireTeacher } from "../../../lib/auth.js";

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function periodRange(params) {
  const period = params.get("period") || "daily";
  const anchor = parseDate(params.get("date") || new Date().toISOString().slice(0, 10));
  if (!anchor) return null;
  const start = new Date(anchor);
  const end = new Date(anchor);
  if (period === "weekly") {
    const offset = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - offset);
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
  } else if (period === "monthly") {
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
  } else if (period === "custom") {
    const from = parseDate(params.get("from"));
    const to = parseDate(params.get("to"));
    if (!from || !to || from > to) return null;
    return { period, start: from, end: to };
  } else if (period !== "daily") {
    return null;
  }
  return { period, start, end };
}

export async function GET(request) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const range = periodRange(params);
  if (!range) return NextResponse.json({ error: "Choose a valid date period and range." }, { status: 400 });
  const classId = params.get("classId");

  try {
    const sessions = await db.attendanceSession.findMany({
      where: {
        date: { gte: range.start, lte: range.end },
        class: { schoolId: teacher.schoolId, ...(classId && classId !== "all" ? { id: classId } : {}) },
      },
      orderBy: [{ date: "desc" }, { class: { name: "asc" } }, { class: { section: "asc" } }],
      include: { class: true, entries: { include: { student: true } } },
    });

    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    const records = sessions.flatMap((session) => session.entries.map((entry) => {
      const status = entry.status.toLowerCase();
      counts[status] += 1;
      return {
        date: session.date.toISOString().slice(0, 10),
        classId: session.classId,
        className: `${session.class.name} - ${session.class.section}`,
        studentId: entry.studentId,
        studentName: entry.student?.name ?? "Archived student",
        rollNumber: entry.student?.rollNumber ?? "—",
        status,
        markedAt: entry.markedAt.toISOString(),
      };
    }));
    const marked = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return NextResponse.json({
      period: range.period,
      from: range.start.toISOString().slice(0, 10),
      to: range.end.toISOString().slice(0, 10),
      classId: classId || "all",
      counts: { ...counts, total: marked, attendancePercentage: marked ? Math.round(((counts.present + counts.late) / marked) * 1000) / 10 : 0 },
      records,
    });
  } catch (error) {
    console.error("Loading attendance report failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return NextResponse.json({ error: "Could not load the attendance report." }, { status: 500 });
  }
}
