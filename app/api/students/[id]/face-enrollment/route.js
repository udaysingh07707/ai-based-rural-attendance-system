import { NextResponse } from "next/server";
import { db } from "../../../../../lib/db.js";
import { requireTeacher } from "../../../../../lib/auth.js";
import { jsonError } from "../../../../../lib/api.js";
import { FaceInferenceError, inferFaces } from "../../../../../lib/face-inference.js";
import { encryptFaceEmbedding } from "../../../../../lib/face-templates.js";
import { StudentPhotoError, validateAndPrepareStudentPhoto } from "../../../../../lib/student-photo.js";

const MIN_ENROLLMENT_FACE_PIXELS = 80;

function enrollmentDetectionFloor() {
  const configured = process.env.FACE_ENROLLMENT_MIN_DETECTION_SCORE;
  const value = configured === undefined || configured.trim() === "" ? 0.9 : Number(configured);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

export async function POST(request, { params }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const detectionFloor = enrollmentDetectionFloor();
  if (detectionFloor === null) return jsonError("Face enrollment detection threshold is invalid. No template was saved.", 503);
  const { id } = await params;

  try {
    const student = await db.student.findFirst({
      where: {
        id,
        isActive: true,
        class: { schoolId: teacher.schoolId, isActive: true },
        faceConsents: { some: { schoolId: teacher.schoolId, activeStudentId: id, revokedAt: null } },
      },
      select: {
        id: true,
        classId: true,
        class: { select: { schoolId: true } },
        faceConsents: {
          where: { schoolId: teacher.schoolId, activeStudentId: id, revokedAt: null },
          orderBy: { grantedAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!student) return jsonError("Student not found or guardian consent is not active.", 404);
    const consent = student.faceConsents[0];
    if (!consent) return jsonError("Guardian consent is not active.", 409);

    let form;
    try { form = await request.formData(); }
    catch { return jsonError("Choose a valid individual enrollment photo."); }
    let enrollmentFile = form.get("enrollmentPhoto");
    if (!enrollmentFile || typeof enrollmentFile.arrayBuffer !== "function" || enrollmentFile.size <= 0) {
      return jsonError("Choose an individual photo to enroll after guardian consent is recorded.");
    }
    if (enrollmentFile.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(enrollmentFile.type)) {
      return jsonError("Choose a JPG, PNG, or WEBP enrollment photo up to 5 MB.");
    }

    let preparedPhoto;
    try { preparedPhoto = await validateAndPrepareStudentPhoto(enrollmentFile); }
    catch (error) {
      if (error instanceof StudentPhotoError) return jsonError(error.message, 422);
      throw error;
    } finally {
      enrollmentFile = null;
      form = null;
    }

    let inference;
    try { inference = await inferFaces(preparedPhoto.imageBytes, preparedPhoto.contentType); }
    finally { preparedPhoto.imageBytes.fill(0); }
    if (inference.faces.length !== 1) {
      inference.faces.forEach((detectedFace) => detectedFace.embedding.fill(0));
      return jsonError(inference.faces.length === 0
        ? "No face was detected in the enrollment photo. Choose a clear, front-facing individual photo."
        : "More than one face was detected. Choose an individual student photo for enrollment.", 422);
    }
    const face = inference.faces[0];
    if (face.detectionScore < detectionFloor || face.box[2] < MIN_ENROLLMENT_FACE_PIXELS || face.box[3] < MIN_ENROLLMENT_FACE_PIXELS) {
      inference.faces.forEach((detectedFace) => detectedFace.embedding.fill(0));
      return jsonError("The face in the enrollment photo is too small or unclear. Choose a closer, clearer photo.", 422);
    }

    const enrolledAt = new Date();
    const context = { studentId: id, schoolId: teacher.schoolId, consentId: consent.id, modelVersion: inference.modelVersion, photoUpdatedAt: enrolledAt.toISOString() };
    let encrypted;
    try { encrypted = encryptFaceEmbedding(face.embedding, context); }
    finally { inference.faces.forEach((detectedFace) => detectedFace.embedding.fill(0)); }
    await db.$transaction(async (tx) => {
      // Serialize enrollment with consent revocation. The row lock is held until
      // this interactive transaction commits, including the template upsert.
      await tx.$queryRaw`SELECT "id" FROM "FaceConsent" WHERE "id" = ${consent.id} FOR UPDATE`;
      const currentConsent = await tx.faceConsent.findFirst({
        where: {
          id: consent.id,
          studentId: id,
          activeStudentId: id,
          classId: student.classId,
          schoolId: teacher.schoolId,
          revokedAt: null,
          student: {
            is: {
              id,
              classId: student.classId,
              isActive: true,
              class: { is: { id: student.classId, schoolId: teacher.schoolId, isActive: true } },
            },
          },
          schoolClass: { is: { id: student.classId, schoolId: teacher.schoolId, isActive: true } },
        },
        select: { id: true },
      });
      if (!currentConsent) throw new Error("Consent was revoked before face enrollment completed.");
      await tx.studentFaceTemplate.upsert({
        where: { studentId: id },
        create: { studentId: id, consentId: consent.id, ...encrypted, modelVersion: inference.modelVersion, profilePhotoUpdatedAt: enrolledAt },
        update: { consentId: consent.id, ...encrypted, modelVersion: inference.modelVersion, profilePhotoUpdatedAt: enrolledAt },
      });
    });
    return NextResponse.json({ ok: true, enrolled: true, modelVersion: inference.modelVersion });
  } catch (error) {
    if (error instanceof FaceInferenceError) return jsonError(error.message, error.status);
    if (error instanceof StudentPhotoError) return jsonError(error.message, 422);
    if (error?.message === "Consent was revoked before face enrollment completed.") return jsonError("Guardian consent is no longer active. No face template was saved.", 409);
    console.error("Face enrollment failed", { code: error?.code || "ENROLLMENT_FAILED" });
    return jsonError("Face enrollment could not be completed. No attendance was changed.", 500);
  }
}
