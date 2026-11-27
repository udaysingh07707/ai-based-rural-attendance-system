import { db } from "../../../../../lib/db.js";
import { requireTeacher } from "../../../../../lib/auth.js";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const teacher = await requireTeacher();
  if (!teacher) return new Response("Sign in required.", { status: 401 });
  const { id } = await params;

  try {
    const photo = await db.studentPhoto.findFirst({
      where: {
        studentId: id,
        student: {
          isActive: true,
          class: { isActive: true, schoolId: teacher.schoolId },
        },
      },
      select: { contentType: true, imageBytes: true },
    });
    if (!photo) return new Response("Photo not found.", { status: 404 });
    return new Response(Buffer.from(photo.imageBytes), {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Length": String(photo.imageBytes.length),
      },
    });
  } catch (error) {
    console.error("Loading student photo failed", { code: error?.code || "DATABASE_UNAVAILABLE" });
    return new Response("Could not load student photo.", { status: 500 });
  }
}
