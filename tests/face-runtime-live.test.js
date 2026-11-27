import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  db: {
    student: { findFirst: vi.fn(), findMany: vi.fn() },
    schoolClass: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  template: null,
}));

vi.mock("../lib/db.js", () => ({ db: mocks.db }));
vi.mock("../lib/auth.js", () => ({ requireTeacher: mocks.requireTeacher }));

const envKeys = ["FACE_RECOGNITION_ENABLED", "FACE_MATCH_THRESHOLD", "FACE_MATCH_MARGIN", "FACE_TEMPLATE_KEY_VERSION", "FACE_TEMPLATE_ENCRYPTION_KEYS", "FACE_SERVICE_URL", "FACE_SERVICE_TOKEN"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe.skipIf(!process.env.FACE_RUNTIME_TEST_LOW_SCORE_IMAGE || !process.env.FACE_RUNTIME_TEST_VALID_IMAGE)("live local Python + Next route smoke (adult licensed fixtures only)", () => {
  it("checks the enrollment confidence floor and returns an actual matched API result", async () => {
    const fs = await import("node:fs");
    const { randomBytes } = await import("node:crypto");
    require(process.cwd() + "/node_modules/dotenv").config({ quiet: true });
    process.env.FACE_RECOGNITION_ENABLED = "true";
    process.env.FACE_MATCH_THRESHOLD = "0.9";
    process.env.FACE_MATCH_MARGIN = "0.1";
    process.env.FACE_TEMPLATE_KEY_VERSION = "live-smoke";
    process.env.FACE_TEMPLATE_ENCRYPTION_KEYS = JSON.stringify({ "live-smoke": randomBytes(32).toString("base64") });

    const [{ POST: enrollFace }, { POST: recognize }] = await Promise.all([
      import("../app/api/students/[id]/face-enrollment/route.js"),
      import("../app/api/ai-attendance/recognize/route.js"),
    ]);
    const teacher = { id: "teacher-smoke", schoolId: "school-smoke", emailVerifiedAt: new Date() };
    const student = { id: "adult-fixture", classId: "class-smoke", class: { schoolId: teacher.schoolId }, faceConsents: [{ id: "consent-smoke" }] };
    mocks.requireTeacher.mockResolvedValue(teacher);
    mocks.db.student.findFirst.mockResolvedValue(student);
    mocks.db.schoolClass.findFirst.mockResolvedValue({ id: student.classId, name: "Smoke Class", section: "A" });
    mocks.db.$transaction.mockImplementation((callback) => callback({
      $queryRaw: vi.fn().mockResolvedValue([{ id: "consent-smoke" }]),
      faceConsent: { findFirst: vi.fn().mockResolvedValue({ id: "consent-smoke" }) },
      studentFaceTemplate: { upsert: vi.fn(async ({ create }) => { mocks.template = create; return create; }) },
    }));

    async function enrollFrom(imagePath) {
      const form = new FormData();
      form.set("enrollmentPhoto", new File([fs.readFileSync(imagePath)], "adult-test.jpg", { type: "image/jpeg" }));
      return enrollFace(new Request("http://localhost/api/face-enrollment", { method: "POST", body: form }), { params: Promise.resolve({ id: student.id }) });
    }

    const lowScore = await enrollFrom(process.env.FACE_RUNTIME_TEST_LOW_SCORE_IMAGE);
    expect(lowScore.status).toBe(422);
    mocks.template = null;
    const validAdult = await enrollFrom(process.env.FACE_RUNTIME_TEST_VALID_IMAGE);
    expect(validAdult.status).toBe(200);
    expect(mocks.template?.ciphertext && mocks.template?.nonce && mocks.template?.authTag).toBeTruthy();

    mocks.db.student.findMany
      .mockResolvedValueOnce([{ id: student.id, name: "Adult Fixture", rollNumber: "1", profilePhoto: null, faceTemplate: mocks.template, faceConsents: [{ id: "consent-smoke" }] }])
      .mockResolvedValueOnce([{ id: student.id, faceTemplate: { consentId: "consent-smoke" }, faceConsents: [{ id: "consent-smoke" }] }])
      .mockResolvedValueOnce([{ id: student.id, name: "Adult Fixture", rollNumber: "1", profilePhoto: null }]);
    const groupForm = new FormData();
    groupForm.set("classId", student.classId);
    groupForm.append("photos", new File([fs.readFileSync(process.env.FACE_RUNTIME_TEST_VALID_IMAGE)], "adult-group-test.jpg", { type: "image/jpeg" }));
    const matched = await recognize(new Request("http://localhost/api/ai-attendance/recognize", { method: "POST", body: groupForm }));
    const result = await matched.json();
    expect(matched.status).toBe(200);
    expect(result.detected).toHaveLength(1);
    expect(result.detected[0].studentId).toBe(student.id);
    console.log(JSON.stringify({ lowConfidenceEnrollmentStatus: lowScore.status, validAdultEnrollmentStatus: validAdult.status, recognitionStatus: matched.status, detectedCount: result.detected.length, identificationStatus: result.detected[0].identificationStatus, similarity: result.detected[0].similarity, databaseUsed: false, note: "Same fixture enrollment and recognition verifies plumbing only; it does not validate a matching threshold." }));
  });
});

const groupFixtures = [
  "FACE_RUNTIME_TEST_OBAMA_ENROLLMENT_IMAGE",
  "FACE_RUNTIME_TEST_CLINTON_ENROLLMENT_IMAGE",
  "FACE_RUNTIME_TEST_OBAMA_CLINTON_GROUP_IMAGE",
  "FACE_RUNTIME_TEST_UNKNOWN_ADULT_IMAGE",
];

describe.skipIf(groupFixtures.some((key) => !process.env[key]))("live multi-person group smoke (adult licensed fixtures only)", () => {
  it("enrolls two separate adult portraits and recognizes both in a different group photo", async () => {
    const fs = await import("node:fs");
    const { randomBytes } = await import("node:crypto");
    require(process.cwd() + "/node_modules/dotenv").config({ quiet: true });
    process.env.FACE_RECOGNITION_ENABLED = "true";
    // Diagnostic values only: 0.363 is OpenCV Zoo's example SFace cutoff.
    // This run does not calibrate or write production thresholds.
    process.env.FACE_MATCH_THRESHOLD = "0.363";
    process.env.FACE_MATCH_MARGIN = "0";
    process.env.FACE_TEMPLATE_KEY_VERSION = "live-smoke";
    process.env.FACE_TEMPLATE_ENCRYPTION_KEYS = JSON.stringify({ "live-smoke": randomBytes(32).toString("base64") });

    const [{ POST: enrollFace }, { POST: recognize }] = await Promise.all([
      import("../app/api/students/[id]/face-enrollment/route.js"),
      import("../app/api/ai-attendance/recognize/route.js"),
    ]);
    const teacher = { id: "teacher-smoke", schoolId: "school-smoke", emailVerifiedAt: new Date() };
    const identities = [
      { id: "adult-obama", consentId: "consent-obama", name: "Adult Fixture A", rollNumber: "1", imageKey: "FACE_RUNTIME_TEST_OBAMA_ENROLLMENT_IMAGE" },
      { id: "adult-clinton", consentId: "consent-clinton", name: "Adult Fixture B", rollNumber: "2", imageKey: "FACE_RUNTIME_TEST_CLINTON_ENROLLMENT_IMAGE" },
    ];
    const templates = new Map();
    let activeConsent;
    mocks.requireTeacher.mockResolvedValue(teacher);
    mocks.db.student.findFirst.mockImplementation(({ where }) => {
      const identity = identities.find((item) => item.id === where.id);
      activeConsent = identity ? { id: identity.consentId } : null;
      return identity ? { id: identity.id, classId: "class-smoke", class: { schoolId: teacher.schoolId }, faceConsents: [{ id: identity.consentId }] } : null;
    });
    mocks.db.schoolClass.findFirst.mockResolvedValue({ id: "class-smoke", name: "Smoke Class", section: "A" });
    mocks.db.$transaction.mockImplementation((callback) => callback({
      $queryRaw: vi.fn().mockResolvedValue([{ id: activeConsent?.id }]),
      faceConsent: { findFirst: vi.fn().mockImplementation(() => activeConsent) },
      studentFaceTemplate: { upsert: vi.fn(async ({ create }) => { templates.set(create.studentId, create); return create; }) },
    }));

    for (const identity of identities) {
      const form = new FormData();
      form.set("enrollmentPhoto", new File([fs.readFileSync(process.env[identity.imageKey])], `${identity.id}.jpg`, { type: "image/jpeg" }));
      const enrolled = await enrollFace(new Request("http://localhost/api/face-enrollment", { method: "POST", body: form }), { params: Promise.resolve({ id: identity.id }) });
      expect(enrolled.status, `enrollment for ${identity.id}`).toBe(200);
    }

    mocks.db.student.findMany
      .mockResolvedValueOnce(identities.map((identity) => ({
        ...identity,
        profilePhoto: null,
        faceTemplate: templates.get(identity.id),
        faceConsents: [{ id: identity.consentId }],
      })))
      .mockResolvedValueOnce(identities.map((identity) => ({
        id: identity.id,
        faceTemplate: { consentId: identity.consentId },
        faceConsents: [{ id: identity.consentId }],
      })))
      .mockResolvedValueOnce(identities.map(({ id, name, rollNumber }) => ({ id, name, rollNumber, profilePhoto: null })));
    const groupForm = new FormData();
    groupForm.set("classId", "class-smoke");
    groupForm.append("photos", new File([fs.readFileSync(process.env.FACE_RUNTIME_TEST_OBAMA_CLINTON_GROUP_IMAGE)], "adult-group.jpg", { type: "image/jpeg" }));
    const groupResponse = await recognize(new Request("http://localhost/api/ai-attendance/recognize", { method: "POST", body: groupForm }));
    const groupResult = await groupResponse.json();
    expect(groupResponse.status).toBe(200);
    expect(groupResult.detectionCount).toBe(2);
    expect(groupResult.detected.map((student) => student.studentId).sort()).toEqual(identities.map((student) => student.id).sort());

    mocks.db.student.findMany
      .mockResolvedValueOnce(identities.map((identity) => ({ ...identity, profilePhoto: null, faceTemplate: templates.get(identity.id), faceConsents: [{ id: identity.consentId }] })))
      .mockResolvedValueOnce(identities.map((identity) => ({ id: identity.id, faceTemplate: { consentId: identity.consentId }, faceConsents: [{ id: identity.consentId }] })))
      .mockResolvedValueOnce(identities.map(({ id, name, rollNumber }) => ({ id, name, rollNumber, profilePhoto: null })));
    const unknownForm = new FormData();
    unknownForm.set("classId", "class-smoke");
    unknownForm.append("photos", new File([fs.readFileSync(process.env.FACE_RUNTIME_TEST_UNKNOWN_ADULT_IMAGE)], "unknown-adult.jpg", { type: "image/jpeg" }));
    const unknownResponse = await recognize(new Request("http://localhost/api/ai-attendance/recognize", { method: "POST", body: unknownForm }));
    const unknownResult = await unknownResponse.json();
    expect(unknownResponse.status).toBe(200);
    expect(unknownResult.detected).toHaveLength(0);
    expect(unknownResult.unknown).toHaveLength(1);
    console.log(JSON.stringify({ enrolledAdultIdentities: identities.length, groupFacesDetected: groupResult.detectionCount, groupMatches: groupResult.detected.map(({ studentId, similarity }) => ({ studentId, similarity })), unknownFaces: unknownResult.unknown.length, falseMatches: 0, databaseUsed: false, note: "One group image and one unknown identity are a route smoke, not threshold validation." }));
  });
});
