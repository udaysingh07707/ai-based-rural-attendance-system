import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is not configured");
  return process.env.SESSION_SECRET;
}

export function hashOtp(email, purpose, code) {
  return createHmac("sha256", secret()).update(`${email}:${purpose}:${code}`).digest("hex");
}

export function verifyOtp(email, purpose, code, savedHash) {
  const expected = Buffer.from(savedHash, "hex");
  const actual = Buffer.from(hashOtp(email, purpose, code), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
