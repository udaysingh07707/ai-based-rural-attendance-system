import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  inferFaces: vi.fn(),
  encryptFaceEmbedding: vi.fn(),
  prepareEnrollmentPhoto: vi.fn(),
  db: {
    student: { findFirst: vi.fn(), findMany: vi.fn() },
    schoolClass: { findFirst: vi.fn() },
    faceConsent: { findFirst: vi.fn(), create: vi.fn() },
    studentFaceTemplate: { deleteMany: vi.fn() },
    studentPhoto: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../lib/db.js", () => ({ db: mocks.db }));
vi.mock("../lib/auth.js", () => ({ requireTeacher: mocks.requireTeacher }));
vi.mock("../lib/face-inference.js", () => ({
  FaceInferenceError: class FaceInferenceError extends Error { constructor(message, status) { super(message); this.status = status; } },
  inferFaces: mocks.inferFaces,
}));
vi.mock("../lib/face-templates.js", () => ({ encryptFaceEmbedding: mocks.encryptFaceEmbedding }));
vi.mock("../lib/student-photo.js", () => ({
  StudentPhotoError: class StudentPhotoError extends Error {},
  validateAndPrepareStudentPhoto: mocks.prepareEnrollmentPhoto,
}));

import { GET as getConsent, POST as grantConsent, DELETE as revokeConsent } from "../app/api/students/[id]/face-consent/route.js";
import { POST as enrollFace } from "../app/api/students/[id]/face-enrollment/route.js";
import { POST as recognize } from "../app/api/ai-attendance/recognize/route.js";

const teacher = { id: "teacher-a", schoolId: "school-a", emailVerifiedAt: new Date() };
const params = { params: Promise.resolve({ id: "student-a" }) };

function jsonRequest(body) {
  return new Request("http://localhost/api/face-consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function enrollmentRequest() {
  const form = new FormData();
  form.set("enrollmentPhoto", new File(["synthetic image fixture"], "enrollment.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost/api/face-enrollment", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTeacher.mockResolvedValue(teacher);
  mocks.db.student.findFirst.mockResolvedValue({ id: "student-a", classId: "class-a" });
  mocks.db.faceConsent.findFirst.mockResolvedValue(null);
  mocks.db.faceConsent.create.mockResolvedValue({ id: "consent-a", guardianName: "Guardian", guardianRelationship: "Parent", consentReference: "FORM-12", consentVersion: "face-attendance-v1", grantedAt: new Date("2026-11-01T00:00:00.000Z") });
  mocks.db.studentFaceTemplate.deleteMany.mockResolvedValue({ count: 1 });
  mocks.inferFaces.mockResolvedValue({ modelVersion: "test-model", faces: [{ detectionScore: 0.99, box: [0, 0, 100, 100], embedding: Array(32).fill(0.25) }] });
  mocks.encryptFaceEmbedding.mockReturnValue({ ciphertext: Buffer.from("cipher"), nonce: Buffer.alloc(12), authTag: Buffer.alloc(16), keyVersion: "test-key" });
  mocks.prepareEnrollmentPhoto.mockResolvedValue({ contentType: "image/jpeg", imageBytes: Buffer.from("normalized temporary image") });
  mocks.db.$transaction.mockImplementation((callback) => callback({
    $queryRaw: vi.fn().mockResolvedValue([{ id: "consent-a" }]),
    faceConsent: {
      findFirst: vi.fn().mockResolvedValue({ id: "consent-a" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    studentFaceTemplate: { deleteMany: mocks.db.studentFaceTemplate.deleteMany, upsert: vi.fn().mockResolvedValue({}) },
    studentPhoto: { findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date("2026-11-01T00:00:00.000Z") }) },
  }));
});

afterEach(() => { delete process.env.FACE_RECOGNITION_ENABLED; delete process.env.FACE_MATCH_THRESHOLD; delete process.env.FACE_MATCH_MARGIN; delete process.env.FACE_ENROLLMENT_MIN_DETECTION_SCORE; vi.restoreAllMocks(); });

function installConsentLockHarness() {
  let active = true;
  let template = null;
  let lockTail = Promise.resolve();
  const transactions = [];
  const photoUpdatedAt = new Date("2026-11-01T00:00:00.000Z");
  const student = {
    id: "student-a",
    classId: "class-a",
    class: { schoolId: "school-a" },
    profilePhoto: { imageBytes: Buffer.from("profile-photo"), contentType: "image/jpeg", updatedAt: photoUpdatedAt },
    faceConsents: [{ id: "consent-a" }],
  };
  mocks.db.student.findFirst.mockResolvedValue(student);

  async function acquireLock() {
    const previous = lockTail;
    let release;
    lockTail = new Promise((resolve) => { release = resolve; });
    await previous;
    return release;
  }

  mocks.db.$transaction.mockImplementation(async (callback) => {
    let releaseLock;
    const tx = {
      $queryRaw: vi.fn(async (strings) => {
        const sql = strings.join("");
        const release = await acquireLock();
        if (sql.includes('"activeStudentId"') && !active) {
          release();
          return [];
        }
        releaseLock = release;
        return [{ id: "consent-a" }];
      }),
      faceConsent: {
        findFirst: vi.fn(async () => active ? { id: "consent-a" } : null),
        updateMany: vi.fn(async () => { active = false; return { count: 1 }; }),
      },
      studentPhoto: { findUnique: vi.fn().mockResolvedValue({ updatedAt: photoUpdatedAt }) },
      studentFaceTemplate: {
        upsert: vi.fn(async ({ create }) => { template = { studentId: create.studentId, consentId: create.consentId }; return template; }),
        deleteMany: vi.fn(async () => { template = null; return { count: 1 }; }),
      },
    };
    transactions.push(tx);
    try { return await callback(tx); }
    finally { releaseLock?.(); }
  });

  return { transactions, get active() { return active; }, get template() { return template; } };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

describe("face consent controls", () => {
  it("requires an authenticated teacher before reading consent state", async () => {
    mocks.requireTeacher.mockResolvedValueOnce(null);
    const response = await getConsent(new Request("http://localhost"), params);
    expect(response.status).toBe(401);
    expect(mocks.db.student.findFirst).not.toHaveBeenCalled();
  });

  it("does not record consent unless documented guardian consent is explicitly attested", async () => {
    const response = await grantConsent(jsonRequest({ guardianName: "Guardian", guardianRelationship: "Parent", consentReference: "FORM-12", guardianConfirmed: false }), params);
    expect(response.status).toBe(400);
    expect(mocks.db.faceConsent.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid configured enrollment detection floor before processing an image", async () => {
    process.env.FACE_ENROLLMENT_MIN_DETECTION_SCORE = "1.5";
    const response = await enrollFace(enrollmentRequest(), params);
    expect(response.status).toBe(503);
    expect(mocks.db.student.findFirst).not.toHaveBeenCalled();
  });

  it("records guardian, relationship, school, teacher, and consent record reference", async () => {
    const response = await grantConsent(jsonRequest({ guardianName: "Guardian", guardianRelationship: "Parent", consentReference: "FORM-12", guardianConfirmed: true }), params);
    expect(response.status).toBe(201);
    expect(mocks.db.faceConsent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ studentId: "student-a", schoolId: "school-a", recordedByTeacherId: "teacher-a", consentReference: "FORM-12" }),
    }));
  });

  it("deletes the biometric template when consent is revoked", async () => {
    const response = await revokeConsent(new Request("http://localhost", { method: "DELETE" }), params);
    expect(response.status).toBe(200);
    expect(mocks.db.studentFaceTemplate.deleteMany).toHaveBeenCalledWith({ where: { studentId: "student-a", consentId: "consent-a" } });
  });

  it("leaves no template when enrollment commits before revocation", async () => {
    const harness = installConsentLockHarness();
    const enrollment = await enrollFace(enrollmentRequest(), params);
    expect(enrollment.status).toBe(200);
    expect(harness.template).toEqual({ studentId: "student-a", consentId: "consent-a" });

    const revocation = await revokeConsent(new Request("http://localhost", { method: "DELETE" }), params);
    expect(revocation.status).toBe(200);
    expect(harness.active).toBe(false);
    expect(harness.template).toBeNull();
    expect(harness.transactions[0].$queryRaw).toHaveBeenCalled();
    expect(harness.transactions[1].$queryRaw).toHaveBeenCalled();
  });

  it("rejects enrollment when revocation commits before enrollment acquires the consent lock", async () => {
    const harness = installConsentLockHarness();
    const inference = deferred();
    mocks.inferFaces.mockReturnValueOnce(inference.promise);
    const enrollmentPromise = enrollFace(enrollmentRequest(), params);
    await vi.waitFor(() => expect(mocks.inferFaces).toHaveBeenCalled());

    const revocation = await revokeConsent(new Request("http://localhost", { method: "DELETE" }), params);
    expect(revocation.status).toBe(200);
    expect(harness.active).toBe(false);
    inference.resolve({ modelVersion: "test-model", faces: [{ detectionScore: 0.99, box: [0, 0, 100, 100], embedding: Array(32).fill(0.25) }] });

    const enrollment = await enrollmentPromise;
    expect(enrollment.status).toBe(409);
    expect(harness.template).toBeNull();
    expect(harness.transactions[1].studentFaceTemplate.upsert).not.toHaveBeenCalled();
  });
});

describe("recognition safety gates", () => {
  it("rejects unauthenticated face enrollment without inference", async () => {
    mocks.requireTeacher.mockResolvedValueOnce(null);
    const response = await enrollFace(enrollmentRequest(), params);
    expect(response.status).toBe(401);
    expect(mocks.db.student.findFirst).not.toHaveBeenCalled();
  });

  it("reports the exact disabled gate and missing threshold settings without querying data", async () => {
    process.env.FACE_RECOGNITION_ENABLED = "false";
    delete process.env.FACE_MATCH_THRESHOLD;
    delete process.env.FACE_MATCH_MARGIN;
    const response = await recognize(new Request("http://localhost", { method: "POST" }));
    expect(response.status).toBe(503);
    const { error } = await response.json();
    expect(error).toContain('FACE_RECOGNITION_ENABLED is not exactly "true"');
    expect(error).toContain("FACE_MATCH_THRESHOLD is blank");
    expect(error).toContain("FACE_MATCH_MARGIN is blank");
    expect(mocks.db.schoolClass.findFirst).not.toHaveBeenCalled();
  });

  it("rejects out-of-range matching settings before querying class or student data", async () => {
    process.env.FACE_RECOGNITION_ENABLED = "true";
    process.env.FACE_MATCH_THRESHOLD = "1.01";
    process.env.FACE_MATCH_MARGIN = "-0.1";
    const response = await recognize(new Request("http://localhost", { method: "POST" }));
    expect(response.status).toBe(503);
    const { error } = await response.json();
    expect(error).toContain("FACE_MATCH_THRESHOLD must be a finite number from -1 to 1");
    expect(error).toContain("FACE_MATCH_MARGIN must be a finite number from 0 to 1");
    expect(mocks.db.schoolClass.findFirst).not.toHaveBeenCalled();
  });
});
