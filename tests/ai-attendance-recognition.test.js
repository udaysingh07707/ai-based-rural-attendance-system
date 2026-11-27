import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  inferFaces: vi.fn(),
  decryptFaceEmbedding: vi.fn((template) => [...template.vector]),
  db: {
    schoolClass: { findFirst: vi.fn() },
    student: { findMany: vi.fn() },
  },
}));

vi.mock("../lib/db.js", () => ({ db: mocks.db }));
vi.mock("../lib/auth.js", () => ({ requireTeacher: mocks.requireTeacher }));
vi.mock("../lib/face-inference.js", () => ({
  FaceInferenceError: class FaceInferenceError extends Error { constructor(message, status) { super(message); this.status = status; } },
  inferFaces: mocks.inferFaces,
}));
vi.mock("../lib/face-templates.js", () => ({
  cosineSimilarity: (left, right) => {
    const dot = left.reduce((total, value, index) => total + value * right[index], 0);
    const leftNorm = Math.sqrt(left.reduce((total, value) => total + value * value, 0));
    const rightNorm = Math.sqrt(right.reduce((total, value) => total + value * value, 0));
    return leftNorm && rightNorm ? dot / (leftNorm * rightNorm) : -1;
  },
  decryptFaceEmbedding: mocks.decryptFaceEmbedding,
}));

import { POST as recognize } from "../app/api/ai-attendance/recognize/route.js";

const teacher = { id: "teacher-a", schoolId: "school-a", emailVerifiedAt: new Date() };
const studentA = {
  id: "student-a", name: "Aman Kumar", rollNumber: "4", profilePhoto: null,
  faceTemplate: { consentId: "consent-a", modelVersion: "sface-test", profilePhotoUpdatedAt: new Date(), vector: [1, 0] },
  faceConsents: [{ id: "consent-a" }],
};
const studentB = {
  id: "student-b", name: "Riya Kumar", rollNumber: "5", profilePhoto: null,
  faceTemplate: { consentId: "consent-b", modelVersion: "sface-test", profilePhotoUpdatedAt: new Date(), vector: [0, 1] },
  faceConsents: [{ id: "consent-b" }],
};

async function classroomPhotoRequest(photoCount = 1) {
  const imageBytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#dedede" } }).png().toBuffer();
  const form = new FormData();
  form.set("classId", "class-a");
  for (let index = 0; index < photoCount; index += 1) form.append("photos", new File([imageBytes], `class-${index}.png`, { type: "image/png" }));
  return new Request("http://localhost/api/ai-attendance/recognize", { method: "POST", body: form });
}

function setupRoster() {
  mocks.db.schoolClass.findFirst.mockResolvedValue({ id: "class-a", name: "Class 5", section: "A" });
  mocks.db.student.findMany
    .mockResolvedValueOnce([structuredClone(studentA), structuredClone(studentB)])
    .mockResolvedValueOnce([
      { id: "student-a", faceTemplate: { consentId: "consent-a" }, faceConsents: [{ id: "consent-a" }] },
      { id: "student-b", faceTemplate: { consentId: "consent-b" }, faceConsents: [{ id: "consent-b" }] },
    ])
    .mockResolvedValueOnce([
      { id: "student-a", name: "Aman Kumar", rollNumber: "4", profilePhoto: null },
      { id: "student-b", name: "Riya Kumar", rollNumber: "5", profilePhoto: null },
    ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTeacher.mockResolvedValue(teacher);
  process.env.FACE_RECOGNITION_ENABLED = "true";
  process.env.FACE_MATCH_THRESHOLD = "0.65";
  process.env.FACE_MATCH_MARGIN = "0.1";
  setupRoster();
});

afterEach(() => {
  delete process.env.FACE_RECOGNITION_ENABLED;
  delete process.env.FACE_MATCH_THRESHOLD;
  delete process.env.FACE_MATCH_MARGIN;
});

describe("classroom recognition API", () => {
  it("returns only actual class template matches and deduplicates repeat appearances", async () => {
    mocks.inferFaces
      .mockResolvedValueOnce({ modelVersion: "sface-test", imageWidth: 16, imageHeight: 16, faces: [{ box: [1, 1, 8, 8], embedding: [1, 0] }] })
      .mockResolvedValueOnce({ modelVersion: "sface-test", imageWidth: 16, imageHeight: 16, faces: [{ box: [2, 2, 8, 8], embedding: [1, 0] }] });

    const response = await recognize(await classroomPhotoRequest(2));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.detected).toHaveLength(1);
    expect(result.detected[0]).toMatchObject({ studentId: "student-a", name: "Aman Kumar", rollNumber: "4", className: "Class 5", section: "A", identificationStatus: "matched", duplicateAppearances: 1, profilePhotoUrl: null });
    expect(result.notDetected).toEqual([{ studentId: "student-b", name: "Riya Kumar", rollNumber: "5", profilePhotoUrl: null }]);
    expect(result.unknown).toEqual([]);
    expect(result.ambiguous).toEqual([]);
    expect(mocks.db.student.findMany.mock.calls[0][0].where).toMatchObject({ classId: "class-a", class: { schoolId: "school-a", isActive: true }, faceConsents: { some: { schoolId: "school-a", activeStudentId: { not: null }, revokedAt: null } } });
  });

  it("keeps unknown and ambiguous detections separate from matched students", async () => {
    mocks.inferFaces.mockResolvedValue({
      modelVersion: "sface-test", imageWidth: 16, imageHeight: 16,
      faces: [
        { box: [1, 1, 8, 8], embedding: [Math.SQRT1_2, Math.SQRT1_2] },
        { box: [2, 2, 8, 8], embedding: [-1, 0] },
      ],
    });
    const response = await recognize(await classroomPhotoRequest());
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.detected).toEqual([]);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].candidates.map((candidate) => candidate.studentId)).toEqual(["student-a", "student-b"]);
    expect(result.unknown).toHaveLength(1);
    expect(result.notDetected).toHaveLength(2);
  });

  it("does not assign two separate faces in one photo to the same student", async () => {
    mocks.inferFaces.mockResolvedValue({
      modelVersion: "sface-test", imageWidth: 16, imageHeight: 16,
      faces: [
        { box: [1, 1, 6, 6], embedding: [1, 0] },
        { box: [8, 1, 6, 6], embedding: [0.99, 0.1] },
      ],
    });
    const response = await recognize(await classroomPhotoRequest());
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.detected).toHaveLength(1);
    expect(result.detected[0].studentId).toBe("student-a");
    expect(result.detected[0].duplicateAppearances).toBe(0);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].faceIndex).toBe(1);
    expect(result.ambiguous[0].candidates.map((candidate) => candidate.studentId)).toEqual(["student-a", "student-b"]);
  });
});
