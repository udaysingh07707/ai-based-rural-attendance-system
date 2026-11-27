import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "../../../../lib/db.js";
import { jsonError, readJson } from "../../../../lib/api.js";
import { createSession } from "../../../../lib/auth.js";
import { consumeLoginAttempt } from "../../../../lib/login-rate-limit.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await readJson(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || !password || Buffer.byteLength(password, "utf8") > 72) {
    return jsonError("Enter a valid email and password.");
  }

  try {
    if (await consumeLoginAttempt(email)) return jsonError("Too many sign-in attempts. Try again in 15 minutes.", 429);
    const teacher = await db.teacher.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true, emailVerifiedAt: true },
    });
    if (!teacher) return jsonError("Email or password is incorrect.", 401);
    if (!teacher.emailVerifiedAt) return jsonError("Verify your email before signing in.", 403);
    if (!teacher.passwordHash || !await bcrypt.compare(password, teacher.passwordHash)) {
      return jsonError("Email or password is incorrect.", 401);
    }

    await createSession(teacher.id);
    return NextResponse.json({ teacher: { id: teacher.id, name: teacher.name, email: teacher.email } });
  } catch (error) {
    console.error("Password sign-in failed", { code: error.code || "AUTH_UNAVAILABLE" });
    return jsonError("Sign-in is temporarily unavailable. Please try again.", 503);
  }
}
