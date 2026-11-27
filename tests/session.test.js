import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  db: { teacher: { findUnique: vi.fn() } },
  cookieValue: undefined,
  cookieOptions: undefined,
  deletedCookie: undefined,
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("../lib/db.js", () => ({ db: mocks.db }));

import { clearSession, createSession, getSession, requireTeacher } from "../lib/auth.js";

const sessionSecret = "test-only-session-secret-with-at-least-32-bytes";

beforeEach(() => {
  process.env.SESSION_SECRET = sessionSecret;
  process.env.NODE_ENV = "production";
  mocks.cookieValue = undefined;
  mocks.cookieOptions = undefined;
  mocks.deletedCookie = undefined;
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({
    set: (_name, value, options) => { mocks.cookieValue = value; mocks.cookieOptions = options; },
    get: () => mocks.cookieValue ? { value: mocks.cookieValue } : undefined,
    delete: (name) => { mocks.deletedCookie = name; mocks.cookieValue = undefined; },
  });
});

describe("signed HTTP-only teacher sessions", () => {
  it("creates a secure cookie and reads its signed teacher session", async () => {
    await createSession("teacher-test-1");
    expect(mocks.cookieOptions).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 604800 });
    expect(await getSession()).toMatchObject({ sub: "teacher-test-1" });
  });

  it("rejects tampered and expired session payloads", async () => {
    await createSession("teacher-test-1");
    mocks.cookieValue = `${mocks.cookieValue.slice(0, -1)}x`;
    expect(await getSession()).toBeNull();

    const payload = Buffer.from(JSON.stringify({ sub: "teacher-test-1", exp: 1 })).toString("base64url");
    const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
    mocks.cookieValue = `${payload}.${signature}`;
    expect(await getSession()).toBeNull();
  });

  it("clears the session cookie on logout", async () => {
    await clearSession();
    expect(mocks.deletedCookie).toBe("school_session");
  });

  it("requires an email-verified teacher record for protected access", async () => {
    await createSession("teacher-test-1");
    mocks.db.teacher.findUnique.mockResolvedValueOnce({ id: "teacher-test-1", schoolId: "school-a", emailVerifiedAt: new Date() });
    expect(await requireTeacher()).toMatchObject({ id: "teacher-test-1", schoolId: "school-a" });

    mocks.db.teacher.findUnique.mockResolvedValueOnce({ id: "teacher-test-1", schoolId: "school-a", emailVerifiedAt: null });
    expect(await requireTeacher()).toBeNull();
  });
});
