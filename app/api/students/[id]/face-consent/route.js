import { NextResponse } from "next/server";
import { db } from "../../../../../lib/db.js";
import { requireTeacher } from "../../../../../lib/auth.js";
import { jsonError, readJson } from "../../../../../lib/api.js";

const CONSENT_VERSION = "face-attendance-v1";

async function findStudent(studentId, schoolId) {
  return db.student.findFirst({
    where: { id: studentId, isActive: true, class: { schoolId, isActive: true } },
    select: { id: true, classId: true },
  });
}

export async function GET(_request, { params }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const { id } = await params;
  try {
    const student = await db.student.findFirst({
      where: { id, isActive: true, class: { schoolId: teacher.schoolId, isActive: true } },
      select: {
        id: true,
        profilePhoto: { select: { studentId: true } },
        faceConsents: {
          where: { schoolId: teacher.schoolId, activeStudentId: id, revokedAt: null },
          orderBy: { grantedAt: "desc" },
          take: 1,
          select: { id: true, guardianName: true, guardianRelationship: true, consentReference: true, consentVersion: true, grantedAt: true },
        },
        faceTemplate: { select: { studentId: true, consentId: true, modelVersion: true } },
      },
    });
    if (!student) return jsonError("Student not found.", 404);
    const consent = student.faceConsents[0] ?? null;
    return NextResponse.json({
      consent,
      hasProfilePhoto: Boolean(student.profilePhoto),
      enrolled: Boolean(consent && student.faceTemplate?.consentId === consent.id),
      modelVersion: consent && student.faceTemplate?.consentId === consent.id ? student.faceTemplate.modelVersion : null,
    });
  } catch (error) {
    console.error("Loading face consent state failed", { code: error?.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not load face enrollment status.", 500);
  }
}

export async function POST(request, { params }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const { id } = await params;
  const body = await readJson(request);
  const guardianName = typeof body?.guardianName === "string" ? body.guardianName.trim() : "";
  const guardianRelationship = typeof body?.guardianRelationship === "string" ? body.guardianRelationship.trim() : "";
  const consentReference = typeof body?.consentReference === "string" ? body.consentReference.trim() : "";
  if (body?.guardianConfirmed !== true || !guardianName || guardianName.length > 120 || !guardianRelationship || guardianRelationship.length > 80 || !consentReference || consentReference.length > 120) {
    return jsonError("Confirm documented guardian consent and enter the guardian’s name, relationship, and consent record reference.");
  }

  try {
    const student = await findStudent(id, teacher.schoolId);
    if (!student) return jsonError("Student not found.", 404);
    const active = await db.faceConsent.findFirst({ where: { studentId: id, activeStudentId: id, schoolId: teacher.schoolId, revokedAt: null }, select: { id: true } });
    if (active) return jsonError("Guardian consent is already recorded.", 409);
    const consent = await db.faceConsent.create({
      data: {
        studentId: id,
        activeStudentId: id,
        classId: student.classId,
        schoolId: teacher.schoolId,
        recordedByTeacherId: teacher.id,
        guardianName,
        guardianRelationship,
        consentReference,
        consentVersion: CONSENT_VERSION,
      },
      select: { id: true, guardianName: true, guardianRelationship: true, consentReference: true, consentVersion: true, grantedAt: true },
    });
    return NextResponse.json({ consent }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") return jsonError("Guardian consent is already recorded.", 409);
    console.error("Recording face consent failed", { code: error?.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not record guardian consent.", 500);
  }
}

export async function DELETE(_request, { params }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const { id } = await params;
  try {
    const student = await findStudent(id, teacher.schoolId);
    if (!student) return jsonError("Student not found.", 404);
    const revoked = await db.$transaction(async (tx) => {
      // Use the same consent-row lock as enrollment, and retain it through the
      // revocation update and template deletion until this transaction commits.
      const lockedRows = await tx.$queryRaw`
        SELECT "id"
        FROM "FaceConsent"
        WHERE "studentId" = ${id}
          AND "activeStudentId" = ${id}
          AND "schoolId" = ${teacher.schoolId}
          AND "revokedAt" IS NULL
        FOR UPDATE
      `;
      const consent = lockedRows[0];
      if (!consent) return false;
      const now = new Date();
      await tx.faceConsent.updateMany({ where: { id: consent.id, activeStudentId: id, revokedAt: null }, data: { revokedAt: now, activeStudentId: null } });
      await tx.studentFaceTemplate.deleteMany({ where: { studentId: id, consentId: consent.id } });
      return true;
    });
    return revoked ? NextResponse.json({ ok: true, revoked: true, templateDeleted: true }) : jsonError("No active face consent was found.", 404);
  } catch (error) {
    console.error("Revoking face consent failed", { code: error?.code || "DATABASE_UNAVAILABLE" });
    return jsonError("Could not revoke face consent.", 500);
  }
}
