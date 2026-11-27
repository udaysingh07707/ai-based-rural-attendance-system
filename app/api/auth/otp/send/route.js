import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { OtpPurpose } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "../../../../../lib/db.js";
import { jsonError, readJson } from "../../../../../lib/api.js";
import { sendVerificationCode } from "../../../../../lib/mail.js";
import { hashOtp } from "../../../../../lib/otp.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await readJson(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const purpose = body?.purpose === "SIGNUP" ? OtpPurpose.SIGNUP : null;
  const resend = body?.resend === true;
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const schoolName = typeof body?.schoolName === "string" ? body.schoolName.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";
  if (!purpose || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return jsonError("Enter a valid email address.");
  if (!resend && (!firstName || !lastName || !schoolName || firstName.length > 80 || lastName.length > 80 || schoolName.length > 120)) return jsonError("Enter your first name, last name, and school name.");
  if (!resend && (password.length < 10 || Buffer.byteLength(password, "utf8") > 72)) return jsonError("Password must be at least 10 characters and no more than 72 bytes.");
  if (!resend && password !== confirmPassword) return jsonError("Password and confirmation do not match.");

  let existingTeacher;
  let prior;
  try {
    existingTeacher = await db.teacher.findUnique({ where: { email }, select: { id: true } });
    await db.emailOtp.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    prior = await db.emailOtp.findUnique({ where: { email } });
  } catch (error) {
    console.error("OTP request database lookup failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    return jsonError("The account service is temporarily unavailable. Please try again.", 503);
  }
  if (purpose === OtpPurpose.SIGNUP && existingTeacher) return jsonError("An account already uses this email. Choose Sign in instead.", 409);
  if (resend && (!prior || prior.purpose !== OtpPurpose.SIGNUP)) return jsonError("Start registration again to request a new code.", 404);

  if (prior && prior.createdAt.getTime() > Date.now() - 60_000) return jsonError("Wait one minute before requesting another code.", 429);

  const now = new Date();
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(now.getTime() + 10 * 60_000);
  const codeHash = hashOtp(email, purpose, code);
  let passwordHash;
  try {
    passwordHash = resend ? undefined : await bcrypt.hash(password, 12);
    const registrationData = resend ? {} : { firstName, lastName, schoolName, passwordHash };
    if (prior) {
      const claimed = await db.emailOtp.updateMany({
        where: { email, purpose: prior.purpose, createdAt: { lte: new Date(now.getTime() - 60_000) } },
        data: { purpose, codeHash, expiresAt, attempts: 0, createdAt: now, ...registrationData },
      });
      if (!claimed.count) return jsonError("Wait one minute before requesting another code.", 429);
    } else {
      await db.emailOtp.create({ data: { email, purpose, codeHash, expiresAt, ...registrationData } });
    }
  } catch (error) {
    if (error?.code === "P2002") return jsonError("Wait one minute before requesting another code.", 429);
    console.error("OTP challenge could not be stored", { code: error.code || "DATABASE_UNAVAILABLE" });
    return jsonError("The account service is temporarily unavailable. Please try again.", 503);
  }

  try {
    await sendVerificationCode({ to: email, code, purpose });
    return NextResponse.json({ ok: true, expiresInSeconds: 600 });
  } catch (error) {
    await db.emailOtp.deleteMany({ where: { email, codeHash } }).catch(() => {});
    console.error("Sending verification email failed", { code: error.code || "MAIL_SEND_FAILED" });
    const configured = error.code === "MAIL_CONFIG";
    return jsonError(configured ? "Email delivery is not set up yet. Ask the administrator to configure the mail sender." : "We could not send the code right now. Check the mail sender settings and try again.", configured ? 503 : 502);
  }
}
