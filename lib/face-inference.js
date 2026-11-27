const MAX_FACE_COUNT = 128;
const MAX_EMBEDDING_LENGTH = 512;

export class FaceInferenceError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = "FaceInferenceError";
    this.status = status;
  }
}

export async function inferFaces(imageBytes, contentType) {
  const serviceUrl = process.env.FACE_SERVICE_URL;
  const serviceToken = process.env.FACE_SERVICE_TOKEN;
  if (!serviceUrl || !serviceToken) {
    throw new FaceInferenceError("Self-hosted face recognition is not configured. Manual attendance is still available.");
  }

  let response;
  try {
    response = await fetch(new URL("/v1/embeddings", serviceUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": contentType,
      },
      body: imageBytes,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new FaceInferenceError("The private face inference service is unavailable. No attendance was changed.");
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new FaceInferenceError(result.error || "Face inference failed. No attendance was changed.", response.status >= 500 ? 503 : 422);
  }
  if (!Array.isArray(result.faces) || result.faces.length > MAX_FACE_COUNT) {
    throw new FaceInferenceError("The inference service returned an invalid detection result.");
  }

  const faces = result.faces.map((face) => {
    if (!Array.isArray(face.box) || face.box.length !== 4 || !face.box.every(Number.isFinite)
      || !Number.isFinite(face.detectionScore) || !Array.isArray(face.embedding)
      || face.embedding.length < 16 || face.embedding.length > MAX_EMBEDDING_LENGTH
      || !face.embedding.every(Number.isFinite)) {
      throw new FaceInferenceError("The inference service returned an invalid face feature.");
    }
    return {
      box: face.box.map(Number),
      detectionScore: Number(face.detectionScore),
      embedding: face.embedding.map(Number),
    };
  });

  return {
    modelVersion: typeof result.modelVersion === "string" ? result.modelVersion : "unknown",
    imageWidth: Number(result.imageWidth) || 0,
    imageHeight: Number(result.imageHeight) || 0,
    faces,
  };
}
