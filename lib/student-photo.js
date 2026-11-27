import sharp from "sharp";
import { readJson } from "./api.js";

export const MAX_STUDENT_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export class StudentPhotoError extends Error {
  constructor(message) {
    super(message);
    this.name = "StudentPhotoError";
  }
}

export async function readStudentRequest(request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    const body = await readJson(request);
    return { body, photo: null, photoAction: "keep" };
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    throw new StudentPhotoError("Could not read the student form. Please try again.");
  }

  const photoValue = form.get("profilePhoto");
  const photo = photoValue && typeof photoValue === "object" && photoValue.size > 0
    ? photoValue
    : null;
  const body = {
    name: form.get("name"),
    classId: form.get("classId"),
    rollNumber: form.get("rollNumber"),
    age: Number(form.get("age")),
    guardianName: form.get("guardianName"),
  };
  const photoAction = form.get("profilePhotoAction") || (photo ? "replace" : "keep");
  return { body, photo, photoAction };
}

export async function validateAndPrepareStudentPhoto(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new StudentPhotoError("Choose a JPG, PNG, or WEBP photo.");
  }
  if (file.size > MAX_STUDENT_PHOTO_BYTES) {
    throw new StudentPhotoError("Photo must be 5 MB or smaller.");
  }
  if (file.size === 0) {
    throw new StudentPhotoError("The selected photo is empty.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(input, { limitInputPixels: 40_000_000, animated: false });
    const metadata = await image.metadata();
    if (!ACCEPTED_FORMATS.has(metadata.format) || !metadata.width || !metadata.height || metadata.pages > 1) {
      throw new StudentPhotoError("Use a valid, non-animated JPG, PNG, or WEBP image.");
    }
    // Re-encoding validates image content, strips embedded metadata, and stores
    // a normalized JPEG representation instead of the untrusted source bytes.
    const imageBytes = await image
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    if (imageBytes.length > MAX_STUDENT_PHOTO_BYTES) {
      throw new StudentPhotoError("Processed photo is too large. Choose a smaller image.");
    }
    return { contentType: "image/jpeg", imageBytes };
  } catch (error) {
    if (error instanceof StudentPhotoError) throw error;
    throw new StudentPhotoError("This image could not be opened. Choose a valid JPG, PNG, or WEBP photo.");
  } finally {
    input.fill(0);
  }
}

export function isStudentPhotoActionValid(action, photo, isCreate = false) {
  return (action === "keep" && !photo)
    || (action === "replace" && Boolean(photo))
    || (action === "remove" && !photo)
    || (isCreate && action === "remove" && !photo);
}
