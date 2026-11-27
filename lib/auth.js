import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "school_session";
const WEEK = 60 * 60 * 24 * 7;

function secret() {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is not configured");
  return process.env.SESSION_SECRET;
}

function sign(value) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export async function createSession(teacherId) {
  const expires = Math.floor(Date.now() / 1000) + WEEK;
  const payload = Buffer.from(JSON.stringify({ sub: teacherId, exp: expires })).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: WEEK,
  });
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return session.exp > Date.now() / 1000 ? session : null;
  } catch {
    return null;
  }
}

export async function requireTeacher({ throwOnDatabaseError = false } = {}) {
  const session = await getSession();
  if (!session) return null;
  const { db } = await import("./db.js");
  try {
    const teacher = await db.teacher.findUnique({ where: { id: session.sub }, select: { id: true, name: true, email: true, role: true, schoolId: true, emailVerifiedAt: true, school: { select: { name: true } } } });
    return teacher?.emailVerifiedAt ? teacher : null;
  } catch (error) {
    console.error("Session account lookup failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    if (throwOnDatabaseError) throw error;
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}


