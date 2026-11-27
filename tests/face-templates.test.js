import { describe, expect, it } from "vitest";

const keyK1 = Buffer.alloc(32, 11).toString("base64");
const keyK2 = Buffer.alloc(32, 22).toString("base64");
const context = {
  studentId: "student-a",
  schoolId: "school-a",
  consentId: "consent-a",
  modelVersion: "yunet-sface-test-version",
  photoUpdatedAt: "2026-11-28T00:00:00.000Z",
};

describe("encrypted face template handling", () => {
  it("encrypts vectors and decrypts them only with the matching context", async () => {
    process.env.FACE_TEMPLATE_KEY_VERSION = "k1";
    process.env.FACE_TEMPLATE_ENCRYPTION_KEYS = JSON.stringify({ k1: keyK1, k2: keyK2 });
    const { encryptFaceEmbedding, decryptFaceEmbedding } = await import("../lib/face-templates.js?rotation-test-k1");
    const embedding = Array.from({ length: 32 }, (_, index) => index / 100);
    const template = encryptFaceEmbedding(embedding, context);
    expect(template.ciphertext).not.toEqual(Buffer.from(embedding.join(",")));
    expect(decryptFaceEmbedding(template, context)).toEqual(embedding.map((value) => Math.fround(value)));
    expect(() => decryptFaceEmbedding(template, { ...context, schoolId: "school-b" })).toThrow();
  });

  it("decrypts an older key version while encrypting new templates with the active version", async () => {
    process.env.FACE_TEMPLATE_KEY_VERSION = "k1";
    process.env.FACE_TEMPLATE_ENCRYPTION_KEYS = JSON.stringify({ k1: keyK1, k2: keyK2 });
    const k1 = await import("../lib/face-templates.js?rotation-test-old");
    const olderVector = Array.from({ length: 32 }, (_, index) => (index % 2 ? 0 : 1));
    const olderTemplate = k1.encryptFaceEmbedding(olderVector, context);

    process.env.FACE_TEMPLATE_KEY_VERSION = "k2";
    const k2 = await import("../lib/face-templates.js?rotation-test-new");
    const newTemplate = k2.encryptFaceEmbedding(Array.from({ length: 32 }, (_, index) => (index % 2 ? 1 : 0)), context);
    expect(newTemplate.keyVersion).toBe("k2");
    expect(k2.decryptFaceEmbedding(olderTemplate, context)).toEqual(olderVector);
  });

  it("calculates cosine similarity without treating it as a probability", async () => {
    const { cosineSimilarity } = await import("../lib/face-templates.js?similarity-test");
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1], [0, 1])).toBe(-1);
  });
});
