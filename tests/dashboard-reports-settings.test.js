import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    student: { count: vi.fn() },
    schoolClass: { findMany: vi.fn() },
    attendanceSession: { findMany: vi.fn() },
    attendanceEntry: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  requireTeacher: vi.fn(),
}));

vi.mock("../lib/db.js", () => ({ db: mocks.db }));
vi.mock("../lib/auth.js", () => ({ requireTeacher: mocks.requireTeacher }));

import { GET as getDashboard } from "../app/api/dashboard/route.js";
import { GET as getReport } from "../app/api/reports/route.js";
import { PATCH as updateSettings } from "../app/api/settings/route.js";

const teacher = { id: "teacher-a", schoolId: "school-a", name: "Teacher A" };
const date = new Date("2026-11-26T00:00:00.000Z");

function request(url, body, method = "GET") {
  return new Request(`http://localhost${url}`, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTeacher.mockResolvedValue(teacher);
  mocks.db.student.count.mockResolvedValue(3);
  mocks.db.schoolClass.findMany.mockResolvedValue([{ id: "class-a", name: "Class 5", section: "A", students: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] }]);
  mocks.db.attendanceSession.findMany.mockResolvedValue([{
    id: "session-a",
    classId: "class-a",
    date,
    class: { id: "class-a", name: "Class 5", section: "A" },
    entries: [
      { id: "e1", studentId: "s1", status: "PRESENT", markedAt: new Date("2026-11-26T08:00:00.000Z"), student: { name: "Asha", rollNumber: "1" } },
      { id: "e2", studentId: "s2", status: "LATE", markedAt: new Date("2026-11-26T08:05:00.000Z"), student: { name: "Bala", rollNumber: "2" } },
      { id: "e3", studentId: "s3", status: "ABSENT", markedAt: new Date("2026-11-26T08:10:00.000Z"), student: { name: "Chitra", rollNumber: "3" } },
      { id: "e4", studentId: "old-s", status: "EXCUSED", markedAt: new Date("2026-11-26T08:12:00.000Z"), student: null },
    ],
  }]);
  mocks.db.attendanceEntry.findMany.mockResolvedValue([{
    studentId: "s1",
    status: "PRESENT",
    markedAt: new Date("2026-11-26T08:00:00.000Z"),
    student: { name: "Asha" },
    session: { classId: "class-a", date, class: { name: "Class 5", section: "A" } },
  }]);
  mocks.db.$transaction.mockImplementation(async (callback) => callback({
    school: { update: vi.fn().mockResolvedValue({ id: "school-a", name: "Updated School" }) },
    teacher: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ ...teacher, name: "Updated Teacher", school: { name: "Updated School" } }),
    },
  }));
});

describe("dashboard reporting API", () => {
  it("calculates counts and attendance rate from school-specific records", async () => {
    mocks.db.attendanceSession.findMany.mockResolvedValueOnce([{
      id: "session-a",
      classId: "class-a",
      date,
      class: { id: "class-a", name: "Class 5", section: "A" },
      entries: [
        { studentId: "s1", status: "PRESENT" },
        { studentId: "s2", status: "LATE" },
        { studentId: "s3", status: "ABSENT" },
      ],
    }]);
    const response = await getDashboard(request("/api/dashboard?date=2026-11-26"));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.totalStudents).toBe(3);
    expect(result.today).toMatchObject({ present: 1, late: 1, absent: 1, excused: 0, markedStudents: 3, attendancePercentage: 66.7 });
    expect(result.recentActivity[0]).toMatchObject({ studentName: "Asha", status: "present" });
    expect(mocks.db.student.count).toHaveBeenCalledWith({ where: { isActive: true, class: { schoolId: "school-a", isActive: true } } });
    expect(mocks.db.attendanceEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { session: { class: { schoolId: "school-a" } } }, orderBy: { markedAt: "desc" } }));
    expect(mocks.db.attendanceSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: { entries: { where: { student: { isActive: true } }, select: { studentId: true, status: true } } } }));
  });

  it("rejects invalid dashboard dates", async () => {
    expect((await getDashboard(request("/api/dashboard?date=2026-19-40"))).status).toBe(400);
    expect(mocks.db.student.count).not.toHaveBeenCalled();
  });
});

describe("attendance reports API", () => {
  it("returns all four status counts and school-scoped daily records", async () => {
    const response = await getReport(request("/api/reports?period=daily&date=2026-11-26&classId=class-a"));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.counts).toMatchObject({ present: 1, absent: 1, late: 1, excused: 1, total: 4, attendancePercentage: 50 });
    expect(result.records.find((record) => record.status === "excused")).toMatchObject({ studentName: "Archived student" });
    expect(mocks.db.attendanceSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ class: { schoolId: "school-a", id: "class-a" } }) }));
  });

  it.each([
    ["weekly", "2026-11-23", "2026-11-29"],
    ["monthly", "2026-11-01", "2026-11-30"],
  ])("computes inclusive %s date bounds", async (period, from, to) => {
    const response = await getReport(request(`/api/reports?period=${period}&date=2026-11-26`));
    const result = await response.json();
    expect(result).toMatchObject({ period, from, to });
  });

  it("supports custom date ranges and rejects reversed ranges", async () => {
    const response = await getReport(request("/api/reports?period=custom&from=2026-11-01&to=2026-11-26"));
    expect(response.status).toBe(200);
    expect((await response.json()).from).toBe("2026-11-01");
    expect((await getReport(request("/api/reports?period=custom&from=2026-11-26&to=2026-11-01"))).status).toBe(400);
  });
});

describe("settings update API", () => {
  it("updates only the signed-in teacher and their associated school", async () => {
    const response = await updateSettings(request("/api/settings", { name: "Updated Teacher", schoolName: "Updated School" }, "PATCH"));
    expect(response.status).toBe(200);
    expect(mocks.db.$transaction).toHaveBeenCalledOnce();
  });

  it("rejects invalid settings and unauthenticated updates", async () => {
    expect((await updateSettings(request("/api/settings", { schoolName: " " }, "PATCH"))).status).toBe(400);
    mocks.requireTeacher.mockResolvedValueOnce(null);
    expect((await updateSettings(request("/api/settings", { name: "Other" }, "PATCH"))).status).toBe(401);
  });
});
