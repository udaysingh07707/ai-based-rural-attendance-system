import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { loginRateLimit: { upsert: vi.fn(), deleteMany: vi.fn() } },
}));

vi.mock("../lib/db.js", () => ({ db: mocks.db }));

import { consumeLoginAttempt } from "../lib/login-rate-limit.js";

const windows = new Map();

beforeEach(() => {
  process.env.SESSION_SECRET = "test-only-session-secret-with-at-least-32-bytes";
  windows.clear();
  vi.clearAllMocks();
  mocks.db.loginRateLimit.upsert.mockImplementation(async ({ where }) => {
    const compound = where.key_windowStart;
    const mapKey = `${compound.key}:${compound.windowStart.toISOString()}`;
    const attempts = (windows.get(mapKey) ?? 0) + 1;
    windows.set(mapKey, attempts);
    return { attempts };
  });
  mocks.db.loginRateLimit.deleteMany.mockResolvedValue({ count: 0 });
});

describe("persistent login rate limit", () => {
  it("allows five attempts and blocks the sixth within a 15-minute window", async () => {
    const now = new Date("2026-11-27T10:07:00.000Z");
    const outcomes = [];
    for (let attempt = 0; attempt < 6; attempt += 1) outcomes.push(await consumeLoginAttempt("teacher@example.test", now));
    expect(outcomes).toEqual([false, false, false, false, false, true]);
  });

  it("uses a hashed identifier and starts a fresh count in a later time window", async () => {
    const first = new Date("2026-11-27T10:07:00.000Z");
    await consumeLoginAttempt("teacher@example.test", first);
    const firstKey = mocks.db.loginRateLimit.upsert.mock.calls[0][0].create.key;
    expect(firstKey).not.toContain("teacher@example.test");
    expect(firstKey).toMatch(/^[a-f0-9]{64}$/);
    expect(await consumeLoginAttempt("teacher@example.test", new Date("2026-11-27T10:15:00.000Z"))).toBe(false);
  });
});
