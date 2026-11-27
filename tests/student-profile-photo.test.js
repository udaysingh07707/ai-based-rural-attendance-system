import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  teacher: { id: "teacher-a", schoolId: "school-a", emailVerifiedAt: new Date() },
  requireTeacher: vi.fn(),
  db: {
    schoolClass: { findFirst: vi.fn() },
    student: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    studentPhoto: { create: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn() },
    studentFaceTemplate: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../lib/db.js", () => ({ db: mocks.db }));
vi.mock("../lib/auth.js", () => ({ requireTeacher: mocks.requireTeacher }));

import { POST as createStudent } from "../app/api/students/route.js";
import { PUT as updateStudent } from "../app/api/students/[id]/route.js";
import { GET as getStudentPhoto } from "../app/api/students/[id]/photo/route.js";
import sharp from "sharp";

const student = {
  id: "student-a",
  name: "Test Student",
  classId: "class-a",
  rollNumber: "4",
  age: 10,
  guardianName: "Guardian",
};

async function imageFile() {
  const png = await sharp({
    create: { width: 12, height: 12, channels: 3, background: "#dce8f8" },
  }).png().toBuffer();
  return new File([png], "profile.png", { type: "image/png" });
}

function multipartRequest(fields, photo) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
  if (photo) form.set("profilePhoto", photo);
  return new Request("http://localhost/api/students", { method: "POST", body: form });
}

function enrollmentOnlyRequest(fields, photo) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
  if (photo) form.set("enrollmentPhoto", photo);
  form.set("profilePhotoAction", "keep");
  return new Request("http://localhost/api/students", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTeacher.mockResolvedValue(mocks.teacher);
  mocks.db.schoolClass.findFirst.mockResolvedValue({ id: "class-a" });
  mocks.db.student.create.mockResolvedValue(student);
  mocks.db.student.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.student.findUnique.mockResolvedValue(student);
  mocks.db.studentPhoto.create.mockResolvedValue({});
  mocks.db.studentPhoto.upsert.mockResolvedValue({});
  mocks.db.studentPhoto.deleteMany.mockResolvedValue({ count: 1 });
  mocks.db.$transaction.mockImplementation((callback) => callback({
    student: {
      create: mocks.db.student.create,
      updateMany: mocks.db.student.updateMany,
      findUnique: mocks.db.student.findUnique,
    },
    studentPhoto: {
      create: mocks.db.studentPhoto.create,
      upsert: mocks.db.studentPhoto.upsert,
      deleteMany: mocks.db.studentPhoto.deleteMany,
      findUnique: vi.fn().mockResolvedValue(null),
    },
    studentFaceTemplate: { deleteMany: mocks.db.studentFaceTemplate.deleteMany },
  }));
});

describe("student profile photo upload", () => {
  it("stores a validated photo with a newly created student in one transaction", async () => {
    const response = await createStudent(multipartRequest({ ...student, age: 10, profilePhotoAction: "replace" }, await imageFile()));
    expect(response.status).toBe(201);
    expect(mocks.db.studentPhoto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ studentId: student.id, contentType: "image/jpeg", imageBytes: expect.any(Buffer) }),
    }));
    expect((await response.json()).student.hasProfilePhoto).toBe(true);
  });

  it("does not persist an enrollment-only photo as a profile photo", async () => {
    const response = await createStudent(enrollmentOnlyRequest({ ...student, age: 10 }, await imageFile()));
    expect(response.status).toBe(201);
    expect(mocks.db.studentPhoto.create).not.toHaveBeenCalled();
    expect((await response.json()).student.hasProfilePhoto).toBe(false);
  });

  it("replaces and removes the existing photo without changing the student identity", async () => {
    const params = { params: Promise.resolve({ id: student.id }) };
    const replacement = await updateStudent(multipartRequest({ ...student, age: 10, profilePhotoAction: "replace" }, await imageFile()), params);
    expect(replacement.status).toBe(200);
    expect(mocks.db.studentPhoto.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: student.id } }));

    const removeRequest = multipartRequest({ ...student, age: 10, profilePhotoAction: "remove" });
    const removed = await updateStudent(removeRequest, params);
    expect(removed.status).toBe(200);
    expect(mocks.db.studentPhoto.deleteMany).toHaveBeenCalledWith({ where: { studentId: student.id } });
    expect((await removed.json()).student.hasProfilePhoto).toBe(false);
  });

  it("rejects invalid image bytes and does not start a database transaction", async () => {
    const invalid = new File(["not an image"], "profile.png", { type: "image/png" });
    const response = await createStudent(multipartRequest({ ...student, age: 10, profilePhotoAction: "replace" }, invalid));
    expect(response.status).toBe(400);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("requires a verified teacher and scopes photo retrieval to their school", async () => {
    mocks.requireTeacher.mockResolvedValueOnce(null);
    const unauthorized = await getStudentPhoto(new Request("http://localhost"), { params: Promise.resolve({ id: student.id }) });
    expect(unauthorized.status).toBe(401);
    expect(mocks.db.studentPhoto.findFirst).not.toHaveBeenCalled();

    mocks.db.studentPhoto.findFirst.mockResolvedValue({ contentType: "image/jpeg", imageBytes: Buffer.from([1, 2, 3]) });
    const response = await getStudentPhoto(new Request("http://localhost"), { params: Promise.resolve({ id: student.id }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.db.studentPhoto.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        studentId: student.id,
        student: { isActive: true, class: { isActive: true, schoolId: "school-a" } },
      }),
    }));
  });
});
