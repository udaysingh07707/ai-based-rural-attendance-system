import { createHmac } from "node:crypto";
import { db } from "./db.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function consumeLoginAttempt(email, now = new Date()) {
  const windowStart = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Session signing is not configured");
  const key = createHmac("sha256", secret).update(email).digest("hex");
  const result = await db.loginRateLimit.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, attempts: 1 },
    update: { attempts: { increment: 1 } },
    select: { attempts: true },
  });

  if (result.attempts === 1) {
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await db.loginRateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } });
  }
  return result.attempts > MAX_ATTEMPTS;
}
