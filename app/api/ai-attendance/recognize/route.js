import { NextResponse } from "next/server";
import { db } from "../../../../lib/db.js";
import { requireTeacher } from "../../../../lib/auth.js";
import { jsonError } from "../../../../lib/api.js";
import { FaceInferenceError, inferFaces } from "../../../../lib/face-inference.js";
import { cosineSimilarity, decryptFaceEmbedding } from "../../../../lib/face-templates.js";
import sharp from "sharp";

export const runtime = "nodejs";

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function readBoundedSetting(name, minimum, maximum) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return { issue: `${name} is blank.` };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    return { issue: `${name} must be a finite number from ${minimum} to ${maximum}.` };
  }
  return { value };
}

function recognitionConfiguration() {
  const blockers = [];
  if (process.env.FACE_RECOGNITION_ENABLED !== "true") {
    blockers.push('FACE_RECOGNITION_ENABLED is not exactly "true".');
  }
  const threshold = readBoundedSetting("FACE_MATCH_THRESHOLD", -1, 1);
  const margin = readBoundedSetting("FACE_MATCH_MARGIN", 0, 1);
  if (threshold.issue) blockers.push(threshold.issue);
  if (margin.issue) blockers.push(margin.issue);
  if (blockers.length) return { blockers };
  return { thresholds: { threshold: threshold.value, margin: margin.value } };
}

function publicStudent(student, similarity, face, classroom) {
  return {
    studentId: student.id,
    name: student.name,
    rollNumber: student.rollNumber,
    className: classroom.name,
    section: classroom.section,
    identificationStatus: "matched",
    similarity: Number(similarity.toFixed(4)),
    profilePhotoUrl: student.hasProfilePhoto ? `/api/students/${encodeURIComponent(student.id)}/photo` : null,
    photoIndex: face.photoIndex,
    faceIndex: face.faceIndex,
    box: face.box,
    imageWidth: face.imageWidth,
    imageHeight: face.imageHeight,
    duplicateAppearances: 0,
  };
}

export async function POST(request) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError("Sign in required.", 401);
  const configuration = recognitionConfiguration();
  if (configuration.blockers) {
    return jsonError(`Face matching is unavailable: ${configuration.blockers.join(" ")}`, 503);
  }
  const matchThresholds = configuration.thresholds;
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_TOTAL_BYTES + 1024 * 1024) {
    return jsonError("The total upload limit is 50 MB.", 413);
  }

  let form;
  try { form = await request.formData(); }
  catch { return jsonError("Could not read the photo upload."); }
  const classId = form.get("classId");
  if (typeof classId !== "string" || !classId) return jsonError("Choose a class.");
  const photos = form.getAll("photos").filter((value) => value && typeof value === "object" && typeof value.arrayBuffer === "function" && value.size > 0);
  if (!photos.length || photos.length > MAX_PHOTOS) return jsonError(`Choose between 1 and ${MAX_PHOTOS} classroom photos.`);
  if (photos.some((photo) => !ACCEPTED_TYPES.has(photo.type) || photo.size > MAX_PHOTO_BYTES)
    || photos.reduce((total, photo) => total + photo.size, 0) > MAX_TOTAL_BYTES) {
    return jsonError("Each photo must be a JPG, PNG, or WEBP image up to 10 MB; total upload limit is 50 MB.");
  }

  const candidates = [];
  const detections = [];
  const modelVersions = new Set();
  try {
    const classroom = await db.schoolClass.findFirst({
      where: { id: classId, schoolId: teacher.schoolId, isActive: true },
      select: { id: true, name: true, section: true },
    });
    if (!classroom) return jsonError("Class not found.", 404);

    const students = await db.student.findMany({
      where: {
        classId,
        isActive: true,
        class: { schoolId: teacher.schoolId, isActive: true },
        faceTemplate: { isNot: null },
        faceConsents: { some: { schoolId: teacher.schoolId, activeStudentId: { not: null }, revokedAt: null } },
      },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        profilePhoto: { select: { studentId: true } },
        faceTemplate: true,
        faceConsents: {
          where: { schoolId: teacher.schoolId, activeStudentId: { not: null }, revokedAt: null },
          orderBy: { grantedAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    for (const student of students) {
      const consent = student.faceConsents[0];
      const template = student.faceTemplate;
      if (!consent || !template || template.consentId !== consent.id) continue;
      const embedding = decryptFaceEmbedding(template, {
        studentId: student.id,
        schoolId: teacher.schoolId,
        consentId: consent.id,
        modelVersion: template.modelVersion,
        photoUpdatedAt: template.profilePhotoUpdatedAt.toISOString(),
      });
      candidates.push({ id: student.id, name: student.name, rollNumber: student.rollNumber, hasProfilePhoto: Boolean(student.profilePhoto), embedding });
    }
    if (!candidates.length) return jsonError("No active, consented face templates are enrolled for this class. Use manual attendance or enroll consented students first.", 409);

    for (let photoIndex = 0; photoIndex < photos.length; photoIndex += 1) {
      const photo = photos[photoIndex];
      const bytes = Buffer.from(await photo.arrayBuffer());
      let inference;
      let metadata;
      try {
        metadata = await sharp(bytes, { limitInputPixels: 40_000_000, animated: false }).metadata();
        const detectedType = metadata.format === "jpeg" ? "image/jpeg" : metadata.format === "png" ? "image/png" : metadata.format === "webp" ? "image/webp" : "";
        if (!detectedType || detectedType !== photo.type || !metadata.width || !metadata.height || metadata.pages > 1) {
          return jsonError("A photo is invalid, animated, or its file type does not match its image content.", 422);
        }
        inference = await inferFaces(bytes, detectedType);
      }
      catch (error) {
        if (error instanceof FaceInferenceError) throw error;
        return jsonError("A classroom photo could not be decoded safely.", 422);
      }
      finally { bytes.fill(0); }
      modelVersions.add(inference.modelVersion);
      for (let faceIndex = 0; faceIndex < inference.faces.length; faceIndex += 1) {
        const face = inference.faces[faceIndex];
        detections.push({ photoIndex, faceIndex, box: face.box, imageWidth: inference.imageWidth, imageHeight: inference.imageHeight, embedding: face.embedding });
      }
    }

    const currentStudents = await db.student.findMany({
      where: {
        id: { in: candidates.map((candidate) => candidate.id) },
        classId,
        isActive: true,
        class: { schoolId: teacher.schoolId, isActive: true },
        faceConsents: { some: { schoolId: teacher.schoolId, activeStudentId: { not: null }, revokedAt: null } },
      },
      select: {
        id: true,
        faceTemplate: { select: { consentId: true } },
        faceConsents: {
          where: { schoolId: teacher.schoolId, activeStudentId: { not: null }, revokedAt: null },
          orderBy: { grantedAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    const stillEligible = new Set(currentStudents.filter((student) => {
      const currentConsent = student.faceConsents[0];
      return currentConsent && student.faceTemplate && student.faceTemplate.consentId === currentConsent.id;
    }).map((student) => student.id));
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      if (!stillEligible.has(candidates[index].id)) {
        candidates[index].embedding.fill(0);
        candidates.splice(index, 1);
      }
    }
    if (!candidates.length) return jsonError("Consent or enrollment status changed during recognition. Please retry.", 409);

    const accepted = [];
    const unknown = [];
    const ambiguous = [];
    const proposalsByPhoto = new Map();
    for (const face of detections) {
      const ranked = candidates
        .map((student) => ({ student, score: cosineSimilarity(face.embedding, student.embedding) }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => right.score - left.score);
      const best = ranked[0];
      if (!best || best.score < matchThresholds.threshold) {
        unknown.push({ photoIndex: face.photoIndex, faceIndex: face.faceIndex, box: face.box, imageWidth: face.imageWidth, imageHeight: face.imageHeight });
      } else if (ranked[1] && best.score - ranked[1].score < matchThresholds.margin) {
        ambiguous.push({
          photoIndex: face.photoIndex,
          faceIndex: face.faceIndex,
          box: face.box,
          imageWidth: face.imageWidth,
          imageHeight: face.imageHeight,
          candidates: ranked.slice(0, 2).map(({ student, score }) => ({ studentId: student.id, name: student.name, rollNumber: student.rollNumber, similarity: Number(score.toFixed(4)) })),
        });
      } else {
        if (!proposalsByPhoto.has(face.photoIndex)) proposalsByPhoto.set(face.photoIndex, new Map());
        const proposalsByStudent = proposalsByPhoto.get(face.photoIndex);
        if (!proposalsByStudent.has(best.student.id)) proposalsByStudent.set(best.student.id, []);
        proposalsByStudent.get(best.student.id).push({ student: best.student, score: best.score, face, ranked });
      }
      face.embedding.fill(0);
    }

    for (const proposalsByStudent of proposalsByPhoto.values()) {
      for (const proposals of proposalsByStudent.values()) {
        proposals.sort((left, right) => right.score - left.score);
        accepted.push(proposals[0]);
        for (const collision of proposals.slice(1)) {
          ambiguous.push({
            photoIndex: collision.face.photoIndex,
            faceIndex: collision.face.faceIndex,
            box: collision.face.box,
            imageWidth: collision.face.imageWidth,
            imageHeight: collision.face.imageHeight,
            candidates: collision.ranked.slice(0, 2).map(({ student, score }) => ({
              studentId: student.id,
              name: student.name,
              rollNumber: student.rollNumber,
              similarity: Number(score.toFixed(4)),
            })),
          });
        }
      }
    }

    accepted.sort((left, right) => right.score - left.score);
    const matchedByStudent = new Map();
    for (const result of accepted) {
      const existing = matchedByStudent.get(result.student.id);
      if (!existing) matchedByStudent.set(result.student.id, publicStudent(result.student, result.score, result.face, classroom));
      else existing.duplicateAppearances += 1;
    }
    const matched = [...matchedByStudent.values()];
    const matchedIds = new Set(matched.map((student) => student.studentId));
    const roster = await db.student.findMany({
      where: { classId, isActive: true, class: { schoolId: teacher.schoolId, isActive: true } },
      orderBy: [{ name: "asc" }, { rollNumber: "asc" }],
      select: { id: true, name: true, rollNumber: true, profilePhoto: { select: { studentId: true } } },
    });
    const notDetected = roster
      .filter((student) => !matchedIds.has(student.id))
      .map(({ id, name, rollNumber, profilePhoto }) => ({ studentId: id, name, rollNumber, profilePhotoUrl: profilePhoto ? `/api/students/${encodeURIComponent(id)}/photo` : null }));

    for (const candidate of candidates) candidate.embedding.fill(0);
    return NextResponse.json({
      modelVersions: [...modelVersions],
      detected: matched,
      notDetected,
      unknown,
      ambiguous,
      detectionCount: detections.length,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof FaceInferenceError) return jsonError(error.message, error.status);
    console.error("AI attendance recognition failed", { code: error?.code || "FACE_RECOGNITION_FAILED" });
    return jsonError("Face recognition could not complete. No attendance was changed.", 503);
  } finally {
    for (const candidate of candidates) candidate.embedding.fill(0);
    for (const face of detections) face.embedding.fill(0);
  }
}
