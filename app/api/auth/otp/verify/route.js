import { OtpPurpose } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "../../../../../lib/db.js";
import { jsonError, readJson } from "../../../../../lib/api.js";
import { createSession } from "../../../../../lib/auth.js";
import { verifyOtp } from "../../../../../lib/otp.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await readJson(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const purpose = body?.purpose === "SIGNUP" ? OtpPurpose.SIGNUP : null;
  if (!purpose || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) return jsonError("Enter the six-digit code sent to your email.");

  let challenge;
  try {
    challenge = await db.emailOtp.findUnique({ where: { email } });
  } catch (error) {
    console.error("OTP verification database lookup failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return jsonError("The account service is temporarily unavailable. Please try again.", 503);
  }
  if (!challenge || challenge.purpose !== purpose || challenge.expiresAt.getTime() < Date.now()) {
    if (challenge?.expiresAt.getTime() < Date.now()) {
      try { await db.emailOtp.deleteMany({ where: { email } }); }
      catch (error) {
        console.error("Expired OTP cleanup failed", { code: error.code || "DATABASE_UNAVAILABLE" });
        return jsonError("The account service is temporarily unavailable. Please try again.", 503);
      }
    }
    return jsonError("That code expired or is no longer valid. Request a new code.", 400);
  }
  if (!verifyOtp(email, purpose, code, challenge.codeHash)) {
    let attemptUpdate;
    try {
      attemptUpdate = await db.emailOtp.updateMany({
        where: { email, purpose, codeHash: challenge.codeHash, expiresAt: { gt: new Date() }, attempts: { lt: 4 } },
        data: { attempts: { increment: 1 } },
      });
    }
    catch (error) {
      console.error("OTP attempt could not be stored", { code: error.code || "DATABASE_UNAVAILABLE" });
      return jsonError("The account service is temporarily unavailable. Please try again.", 503);
    }

    if (!attemptUpdate.count) {
      try {
        const latestChallenge = await db.emailOtp.findUnique({ where: { email }, select: { attempts: true, expiresAt: true, purpose: true } });
        if (latestChallenge?.purpose === purpose && latestChallenge.attempts >= 4) {
          await db.emailOtp.deleteMany({ where: { email } });
          return jsonError("Too many incorrect attempts. Request a new code.", 429);
        }
      } catch (error) {
        console.error("OTP attempt-limit cleanup failed", { code: error.code || "DATABASE_UNAVAILABLE" });
        return jsonError("The account service is temporarily unavailable. Please try again.", 503);
      }
      return jsonError("That code expired or is no longer valid. Request a new code.", 400);
    }
    return jsonError("That code is incorrect. Check your email and try again.", 400);
  }

  try {
    let teacher;
    if (purpose === OtpPurpose.SIGNUP) {
      if (!challenge.firstName || !challenge.lastName || !challenge.schoolName || !challenge.passwordHash) return jsonError("Registration details expired. Start again.", 400);
      const alreadyExists = await db.teacher.findUnique({ where: { email }, select: { id: true } });
      if (alreadyExists) return jsonError("An account already uses this email. Choose Sign in instead.", 409);
      teacher = await db.$transaction(async (tx) => {
        const school = await tx.school.create({ data: { name: challenge.schoolName } });
        const name = `${challenge.firstName} ${challenge.lastName}`.trim();
        return tx.teacher.create({ data: {
          schoolId: school.id,
          name,
          firstName: challenge.firstName,
          lastName: challenge.lastName,
          email,
          passwordHash: challenge.passwordHash,
          emailVerifiedAt: new Date(),
        }, select: { id: true } });
      });
    }
    await db.emailOtp.deleteMany({ where: { email } });
    await createSession(teacher.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error?.code === "P2002") return jsonError("An account already uses this email. Choose Sign in instead.", 409);
    console.error("Verifying email code failed", { code: error.code || "OTP_VERIFY_FAILED" });
    return jsonError("Could not verify this code. Please request a new one.", 500);
  }
}
