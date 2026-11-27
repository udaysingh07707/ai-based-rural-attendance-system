import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ACTIVE_KEY_VERSION = process.env.FACE_TEMPLATE_KEY_VERSION || "k1";

function encryptionKey(version = ACTIVE_KEY_VERSION) {
  let keyring;
  try { keyring = JSON.parse(process.env.FACE_TEMPLATE_ENCRYPTION_KEYS || "{}"); }
  catch { throw new Error("Face template keyring configuration is invalid."); }
  const encoded = keyring[version];
  if (typeof encoded !== "string") throw new Error(`Face template key version ${version} is not configured.`);
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error(`Face template key version ${version} must decode to 32 bytes.`);
  return key;
}

function associatedData({ studentId, schoolId, consentId, modelVersion, photoUpdatedAt }) {
  return Buffer.from([studentId, schoolId, consentId, modelVersion, photoUpdatedAt].join("\0"), "utf8");
}

export function encryptFaceEmbedding(embedding, context) {
  if (!Array.isArray(embedding) || embedding.length < 16 || embedding.length > 512
    || !embedding.every(Number.isFinite)) throw new Error("Invalid face feature.");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  cipher.setAAD(associatedData(context));
  const plaintext = Buffer.allocUnsafe(embedding.length * 4);
  embedding.forEach((value, index) => plaintext.writeFloatLE(value, index * 4));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  plaintext.fill(0);
  return { ciphertext, nonce, authTag, keyVersion: ACTIVE_KEY_VERSION };
}

export function decryptFaceEmbedding(template, context) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(template.keyVersion), Buffer.from(template.nonce));
  decipher.setAAD(associatedData(context));
  decipher.setAuthTag(Buffer.from(template.authTag));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(template.ciphertext)),
    decipher.final(),
  ]);
  if (!plaintext.length || plaintext.length % 4 !== 0 || plaintext.length / 4 > 512) {
    plaintext.fill(0);
    throw new Error("Stored face template has an invalid format.");
  }
  const embedding = Array.from({ length: plaintext.length / 4 }, (_, index) => plaintext.readFloatLE(index * 4));
  plaintext.fill(0);
  if (!embedding.every(Number.isFinite)) throw new Error("Stored face template is invalid.");
  return embedding;
}

export function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || !left.length) return -1;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) return -1;
  return dot / Math.sqrt(leftNorm * rightNorm);
}
