import { beforeEach, describe, expect, it, vi } from "vitest";
import { OtpPurpose } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  db: {
    teacher: { findUnique: vi.fn(), create: vi.fn() },
    school: { create: vi.fn() },
    emailOtp: { findUnique: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  sendVerificationCode: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("../lib/db.js", () => ({ db: mocks.db }));
vi.mock("../lib/mail.js", () => ({ sendVerificationCode: mocks.sendVerificationCode }));
vi.mock("../lib/auth.js", () => ({ createSession: mocks.createSession }));

import { POST as sendOtp } from "../app/api/auth/otp/send/route.js";
import { POST as verifyOtpRoute } from "../app/api/auth/otp/verify/route.js";
import { verifyOtp } from "../lib/otp.js";

const email = "teacher@example.com";
const challenges = new Map();
let sentCode;

function request(body) {
  return new Request("http://localhost/api/auth/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function registration(overrides = {}) {
  return {
    purpose: "SIGNUP",
    firstName: "Asha",
    lastName: "Teacher",
    schoolName: "Village School",
    email,
    password: "correct horse battery",
    confirmPassword: "correct horse battery",
    ...overrides,
  };
}

beforeEach(() => {
  process.env.SESSION_SECRET = "test-only-session-secret-with-at-least-32-bytes";
  challenges.clear();
  sentCode = undefined;
  vi.clearAllMocks();
  mocks.db.teacher.findUnique.mockResolvedValue(null);
  mocks.db.emailOtp.findUnique.mockImplementation(({ where }) => Promise.resolve(challenges.get(where.email) ?? null));
  mocks.db.emailOtp.deleteMany.mockImplementation(async ({ where }) => {
    if (where.email) challenges.delete(where.email);
    return { count: 1 };
  });
  mocks.db.emailOtp.create.mockImplementation(async ({ data }) => {
    if (challenges.has(data.email)) throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
    const challenge = { ...data, createdAt: new Date(), attempts: 0 };
    challenges.set(data.email, challenge);
    return challenge;
  });
  mocks.db.emailOtp.updateMany.mockImplementation(async ({ where, data }) => {
    const prior = challenges.get(where.email);
    if (!prior) return { count: 0 };
    if (where.createdAt) {
      if (prior.createdAt > where.createdAt.lte) return { count: 0 };
      challenges.set(where.email, { ...prior, ...data });
      return { count: 1 };
    }
    if (prior.purpose !== where.purpose || prior.codeHash !== where.codeHash || prior.expiresAt <= where.expiresAt.gt || prior.attempts >= where.attempts.lt) return { count: 0 };
    challenges.set(where.email, { ...prior, attempts: prior.attempts + data.attempts.increment });
    return { count: 1 };
  });
  mocks.sendVerificationCode.mockImplementation(async ({ code }) => { sentCode = code; });
  mocks.db.$transaction.mockImplementation(async (callback) => callback({
    school: { create: vi.fn().mockResolvedValue({ id: "school-test-1" }) },
    teacher: { create: vi.fn().mockResolvedValue({ id: "teacher-test-1" }) },
  }));
});

describe("signup email OTP API", () => {
  it.each([
    ["malformed email", { email: "not-an-email" }],
    ["missing name", { firstName: " " }],
    ["short password", { password: "short" }],
    ["password mismatch", { confirmPassword: "different password" }],
  ])("rejects %s before database or mail work", async (_caseName, overrides) => {
    const response = await sendOtp(request(registration(overrides)));
    expect(response.status).toBe(400);
    expect(mocks.db.teacher.findUnique).not.toHaveBeenCalled();
    expect(mocks.sendVerificationCode).not.toHaveBeenCalled();
  });

  it("generates a six-digit OTP, persists only its hash, and creates a verified account after successful verification", async () => {
    const response = await sendOtp(request(registration({ email: ` ${email.toUpperCase()} ` })));
    expect(response.status).toBe(200);
    expect(sentCode).toMatch(/^\d{6}$/);

    const challenge = challenges.get(email);
    expect(challenge.email).toBe(email);
    expect(challenge.codeHash).not.toBe(sentCode);
    expect(challenge.passwordHash).not.toBe(registration().password);
    expect(challenge.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(verifyOtp(email, OtpPurpose.SIGNUP, sentCode, challenge.codeHash)).toBe(true);
    expect(challenge.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(challenge.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 10 * 60_000);

    const verifyResponse = await verifyOtpRoute(request({ purpose: "SIGNUP", email, code: sentCode }));
    expect(verifyResponse.status).toBe(200);
    expect(mocks.db.$transaction).toHaveBeenCalledOnce();
    expect(mocks.createSession).toHaveBeenCalledWith("teacher-test-1");
    expect(challenges.has(email)).toBe(false);
  });

  it("rejects and removes an expired OTP", async () => {
    challenges.set(email, { email, purpose: OtpPurpose.SIGNUP, codeHash: "invalid-unused", expiresAt: new Date(Date.now() - 1000), attempts: 0 });
    const response = await verifyOtpRoute(request({ purpose: "SIGNUP", email, code: "123456" }));
    expect(response.status).toBe(400);
    expect(challenges.has(email)).toBe(false);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects an incorrect OTP and allows no more than five failed attempts", async () => {
    await sendOtp(request(registration()));
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await verifyOtpRoute(request({ purpose: "SIGNUP", email, code: "000000" }));
      expect(response.status).toBe(400);
    }
    const fifthResponse = await verifyOtpRoute(request({ purpose: "SIGNUP", email, code: "000000" }));
    expect(fifthResponse.status).toBe(429);
    expect(challenges.has(email)).toBe(false);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("enforces the OTP attempt cap when wrong-code requests arrive concurrently", async () => {
    await sendOtp(request(registration()));
    const snapshot = { ...challenges.get(email) };
    let readers = 0;
    let releaseReads;
    const allReads = new Promise((resolve) => { releaseReads = resolve; });
    mocks.db.emailOtp.findUnique.mockImplementation(async (args) => {
      if (args.select) {
        const current = challenges.get(email);
        return current ? { attempts: current.attempts, expiresAt: current.expiresAt, purpose: current.purpose } : null;
      }
      readers += 1;
      if (readers === 5) releaseReads();
      await allReads;
      return { ...snapshot };
    });

    const responses = await Promise.all(Array.from({ length: 5 }, () => verifyOtpRoute(request({ purpose: "SIGNUP", email, code: "000000" }))));
    expect(responses.map((response) => response.status).sort()).toEqual([400, 400, 400, 400, 429]);
    expect(challenges.has(email)).toBe(false);
  });

  it("enforces the 60-second resend cooldown", async () => {
    await sendOtp(request(registration()));
    const response = await sendOtp(request({ purpose: "SIGNUP", email, resend: true }));
    expect(response.status).toBe(429);
    expect(mocks.sendVerificationCode).toHaveBeenCalledOnce();
  });

  it("allows only one concurrent resend to claim an elapsed cooldown", async () => {
    challenges.set(email, {
      email,
      purpose: OtpPurpose.SIGNUP,
      codeHash: "previous-code-hash",
      firstName: "Asha",
      lastName: "Teacher",
      schoolName: "Village School",
      passwordHash: "hashed-password",
      expiresAt: new Date(Date.now() + 5 * 60_000),
      attempts: 0,
      createdAt: new Date(Date.now() - 2 * 60_000),
    });
    const resendRequest = () => sendOtp(request({ purpose: "SIGNUP", email, resend: true }));
    const responses = await Promise.all([resendRequest(), resendRequest()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 429]);
    expect(mocks.sendVerificationCode).toHaveBeenCalledOnce();
  });

  it("rejects duplicate registered email addresses", async () => {
    mocks.db.teacher.findUnique.mockResolvedValueOnce({ id: "existing-teacher" });
    const response = await sendOtp(request(registration()));
    expect(response.status).toBe(409);
    expect(mocks.sendVerificationCode).not.toHaveBeenCalled();
  });
});
