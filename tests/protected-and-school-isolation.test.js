import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    schoolClass: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    student: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    studentPhoto: { create: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
    faceConsent: { updateMany: vi.fn() },
    studentFaceTemplate: { upsert: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
    attendanceSession: { findMany: vi.fn() },
    attendanceEntry: { upsert: vi.fn() },
    emailOtp: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  requireTeacher: vi.fn(),
}));

vi.mock("../lib/db.js", () => ({ db: mocks.db }));
vi.mock("../lib/auth.js", () => ({ requireTeacher: mocks.requireTeacher }));

import { POST as createStudent } from "../app/api/students/route.js";
import { GET as listStudents } from "../app/api/students/route.js";
import { PUT as updateStudent, DELETE as deleteStudent } from "../app/api/students/[id]/route.js";
import { POST as createClass } from "../app/api/classes/route.js";
import { PUT as updateClass, DELETE as archiveClass } from "../app/api/classes/[id]/route.js";
import { POST as saveAttendance } from "../app/api/attendance/route.js";
import { GET as getSchoolData } from "../app/api/school-data/route.js";

const teacher = { id: "teacher-a", schoolId: "school-a", emailVerifiedAt: new Date() };

function request(body) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validStudent(overrides = {}) {
  return { name: "Aman Kumar", classId: "class-a", rollNumber: "4", age: 10, guardianName: "Guardian", ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTeacher.mockResolvedValue(teacher);
  mocks.db.schoolClass.findFirst.mockResolvedValue({ id: "class-a" });
  mocks.db.schoolClass.create.mockResolvedValue({ id: "class-new", schoolId: teacher.schoolId, name: "Class 5", section: "A" });
  mocks.db.schoolClass.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.schoolClass.findUnique.mockResolvedValue({ id: "class-a", schoolId: teacher.schoolId, name: "Class 5", section: "B" });
  mocks.db.student.create.mockResolvedValue({ id: "student-new", ...validStudent() });
  mocks.db.student.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.student.findUnique.mockResolvedValue({ id: "student-a", ...validStudent({ name: "Updated Name" }) });
  mocks.db.student.deleteMany.mockResolvedValue({ count: 1 });
  mocks.db.studentPhoto.create.mockResolvedValue({});
  mocks.db.studentPhoto.upsert.mockResolvedValue({});
  mocks.db.studentPhoto.deleteMany.mockResolvedValue({ count: 1 });
  mocks.db.studentPhoto.findUnique.mockResolvedValue(null);
  mocks.db.faceConsent.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.studentFaceTemplate.deleteMany.mockResolvedValue({ count: 0 });
  mocks.db.student.findMany.mockResolvedValue([{ id: "student-a" }, { id: "student-b" }]);
  mocks.db.attendanceSession.findMany.mockResolvedValue([]);
  mocks.db.attendanceEntry.upsert.mockResolvedValue({});
  mocks.db.$transaction.mockImplementation(async (callback) => callback({
    $queryRaw: vi.fn().mockResolvedValue([{ id: "consent-a" }]),
    attendanceSession: { upsert: vi.fn().mockResolvedValue({ id: "session-a" }) },
    attendanceEntry: { upsert: mocks.db.attendanceEntry.upsert },
    schoolClass: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    student: {
      create: mocks.db.student.create,
      updateMany: mocks.db.student.updateMany,
      findUnique: mocks.db.student.findUnique,
    },
    studentPhoto: {
      create: mocks.db.studentPhoto.create,
      upsert: mocks.db.studentPhoto.upsert,
      deleteMany: mocks.db.studentPhoto.deleteMany,
      findUnique: mocks.db.studentPhoto.findUnique,
    },
    studentFaceTemplate: {
      upsert: mocks.db.studentFaceTemplate.upsert,
      deleteMany: mocks.db.studentFaceTemplate.deleteMany,
      findUnique: mocks.db.studentFaceTemplate.findUnique,
    },
    faceConsent: { updateMany: mocks.db.faceConsent.updateMany },
  }));
});

describe("protected API authorization", () => {
  it("rejects unauthenticated access to student, class, attendance, and school-data APIs", async () => {
    mocks.requireTeacher.mockResolvedValue(null);
    const responses = await Promise.all([
      createStudent(request(validStudent())),
      updateStudent(request(validStudent()), { params: Promise.resolve({ id: "student-a" }) }),
      deleteStudent(request({}), { params: Promise.resolve({ id: "student-a" }) }),
      createClass(request({ name: "Class 5", section: "A" })),
      updateClass(request({ name: "Class 5", section: "A" }), { params: Promise.resolve({ id: "class-a" }) }),
      saveAttendance(request({ classId: "class-a", date: "2026-05-01", statuses: { "student-a": "present", "student-b": "absent" } })),
      getSchoolData(),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
    expect(mocks.db.student.create).not.toHaveBeenCalled();
    expect(mocks.db.schoolClass.create).not.toHaveBeenCalled();
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});

describe("student and class school scoping", () => {
  it("creates students only in a class owned by the authenticated teacher's school", async () => {
    mocks.db.schoolClass.findFirst.mockResolvedValueOnce(null);
    const response = await createStudent(request(validStudent({ classId: "foreign-class" })));
    expect(response.status).toBe(404);
    expect(mocks.db.schoolClass.findFirst).toHaveBeenCalledWith({ where: { id: "foreign-class", schoolId: "school-a", isActive: true }, select: { id: true } });
    expect(mocks.db.student.create).not.toHaveBeenCalled();
  });

  it("scopes student updates and deletes to the teacher's school", async () => {
    mocks.db.student.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
    const updateResponse = await updateStudent(request(validStudent()), { params: Promise.resolve({ id: "foreign-student" }) });
    const deleteResponse = await deleteStudent(request({}), { params: Promise.resolve({ id: "foreign-student" }) });
    expect(updateResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
    expect(mocks.db.student.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "foreign-student", isActive: true, class: { schoolId: "school-a", isActive: true } } }));
    expect(mocks.db.student.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "foreign-student", isActive: true, class: { schoolId: "school-a", isActive: true } }, data: { isActive: false } }));
  });

  it("scopes class create and update to the authenticated school", async () => {
    await createClass(request({ name: "Class 5", section: "A" }));
    expect(mocks.db.schoolClass.create).toHaveBeenCalledWith({ data: { schoolId: "school-a", name: "Class 5", section: "A" } });
    await updateClass(request({ name: "Class 5", section: "B" }), { params: Promise.resolve({ id: "class-a" }) });
    expect(mocks.db.schoolClass.updateMany).toHaveBeenCalledWith({ where: { id: "class-a", schoolId: "school-a", isActive: true }, data: { name: "Class 5", section: "B" } });
  });

  it("returns only classes, students, and attendance for the authenticated school", async () => {
    await getSchoolData();
    expect(mocks.db.schoolClass.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: "school-a", isActive: true } }));
    expect(mocks.db.student.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true, class: { schoolId: "school-a", isActive: true } } }));
    expect(mocks.db.attendanceSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { class: { schoolId: "school-a" } } }));
  });
});

describe("student and class CRUD handlers", () => {
  it("creates, updates, and deletes a student through authenticated routes", async () => {
    expect((await createStudent(request(validStudent()))).status).toBe(201);
    expect((await updateStudent(request(validStudent()), { params: Promise.resolve({ id: "student-a" }) })).status).toBe(200);
    expect((await deleteStudent(request({}), { params: Promise.resolve({ id: "student-a" }) })).status).toBe(200);
  });

  it("returns a conflict for duplicate student roll numbers and class names", async () => {
    mocks.db.student.create.mockRejectedValueOnce({ code: "P2002" });
    mocks.db.schoolClass.create.mockRejectedValueOnce({ code: "P2002" });
    expect((await createStudent(request(validStudent()))).status).toBe(409);
    expect((await createClass(request({ name: "Class 5", section: "A" }))).status).toBe(409);
  });

  it("reads only active students assigned to active classes in the teacher's school", async () => {
    const response = await listStudents();
    expect(response.status).toBe(200);
    expect(mocks.db.student.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true, class: { schoolId: "school-a", isActive: true } } }));
  });

  it("creates and updates a class through authenticated routes", async () => {
    expect((await createClass(request({ name: "Class 5", section: "A" }))).status).toBe(201);
    expect((await updateClass(request({ name: "Class 5", section: "B" }), { params: Promise.resolve({ id: "class-a" }) })).status).toBe(200);
  });

  it("archives a class and its active students transactionally without physical deletes", async () => {
    const response = await archiveClass(request({}), { params: Promise.resolve({ id: "class-a" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, archived: true });
    expect(mocks.db.$transaction).toHaveBeenCalledOnce();
    expect(mocks.db.student.deleteMany).not.toHaveBeenCalled();
    expect(mocks.db.faceConsent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { classId: "class-a", schoolId: "school-a", activeStudentId: { not: null }, revokedAt: null },
      data: expect.objectContaining({ activeStudentId: null, revokedAt: expect.any(Date) }),
    }));
    expect(mocks.db.studentFaceTemplate.deleteMany).toHaveBeenCalledWith({ where: { student: { classId: "class-a" } } });
  });

  it("revokes active face consent and removes its template when a student is archived", async () => {
    const response = await deleteStudent(request({}), { params: Promise.resolve({ id: "student-a" }) });
    expect(response.status).toBe(200);
    expect(mocks.db.faceConsent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: "student-a", schoolId: "school-a", activeStudentId: "student-a", revokedAt: null },
      data: expect.objectContaining({ activeStudentId: null, revokedAt: expect.any(Date) }),
    }));
    expect(mocks.db.studentFaceTemplate.deleteMany).toHaveBeenCalledWith({ where: { studentId: "student-a" } });
    expect(mocks.db.studentPhoto.deleteMany).not.toHaveBeenCalled();
  });
});

describe("attendance save and update", () => {
  it("creates a session and writes/upserts a complete roster", async () => {
    const statuses = { "student-a": "present", "student-b": "absent" };
    const first = await saveAttendance(request({ classId: "class-a", date: "2026-05-01", statuses }));
    const second = await saveAttendance(request({ classId: "class-a", date: "2026-05-01", statuses: { ...statuses, "student-b": "present" } }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(2);
    expect(mocks.db.attendanceEntry.upsert).toHaveBeenCalledTimes(4);
    expect(mocks.db.attendanceEntry.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: "PRESENT" }) }));
  });

  it("rejects attendance from a class outside the authenticated school", async () => {
    mocks.db.student.findMany.mockResolvedValueOnce([]);
    const response = await saveAttendance(request({ classId: "foreign-class", date: "2026-05-01", statuses: { "student-a": "present" } }));
    expect(response.status).toBe(404);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
