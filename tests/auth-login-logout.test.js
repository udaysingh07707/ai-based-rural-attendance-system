import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const mocks = vi.hoisted(() => ({
  db: { teacher: { findUnique: vi.fn() } },
  createSession: vi.fn(),
  clearSession: vi.fn(),
  consumeLoginAttempt: vi.fn(),
}));

vi.mock("../lib/db.js", () => ({ db: mocks.db }));
vi.mock("../lib/auth.js", () => ({ createSession: mocks.createSession, clearSession: mocks.clearSession }));
vi.mock("../lib/login-rate-limit.js", () => ({ consumeLoginAttempt: mocks.consumeLoginAttempt }));

import { POST as login } from "../app/api/auth/login/route.js";
import { POST as logout } from "../app/api/auth/logout/route.js";

const password = "a-safe-test-password";
const verifiedTeacher = {
  id: "teacher-test-1",
  name: "Asha Teacher",
  email: "asha@example.test",
  emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
  passwordHash: "",
};

function request(body) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  verifiedTeacher.passwordHash = await bcrypt.hash(password, 4);
  mocks.db.teacher.findUnique.mockResolvedValue(verifiedTeacher);
  mocks.consumeLoginAttempt.mockResolvedValue(false);
});

describe("email/password authentication", () => {
  it("logs in a verified teacher with the correct password", async () => {
    const response = await login(request({ email: " ASHA@example.test ", password }));
    expect(response.status).toBe(200);
    expect(mocks.db.teacher.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "asha@example.test" } }));
    expect(mocks.createSession).toHaveBeenCalledWith(verifiedTeacher.id);
  });

  it("rejects an invalid password without creating a session", async () => {
    const response = await login(request({ email: verifiedTeacher.email, password: "wrong-password" }));
    expect(response.status).toBe(401);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects an unverified account", async () => {
    mocks.db.teacher.findUnique.mockResolvedValueOnce({ ...verifiedTeacher, emailVerifiedAt: null });
    const response = await login(request({ email: verifiedTeacher.email, password }));
    expect(response.status).toBe(403);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects unknown email and malformed login input", async () => {
    mocks.db.teacher.findUnique.mockResolvedValueOnce(null);
    expect((await login(request({ email: verifiedTeacher.email, password }))).status).toBe(401);
    expect((await login(request({ email: "not-an-email", password }))).status).toBe(400);
  });

  it("blocks a login attempt when the persistent rate limit is exhausted", async () => {
    mocks.consumeLoginAttempt.mockResolvedValueOnce(true);
    const response = await login(request({ email: verifiedTeacher.email, password }));
    expect(response.status).toBe(429);
    expect(mocks.db.teacher.findUnique).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});

describe("logout API", () => {
  it("clears the existing session and returns success", async () => {
    const response = await logout();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.clearSession).toHaveBeenCalledOnce();
  });
});
