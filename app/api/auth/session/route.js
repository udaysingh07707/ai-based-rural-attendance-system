import { NextResponse } from "next/server";
import { requireTeacher } from "../../../../lib/auth.js";

export async function GET() {
  try {
    const teacher = await requireTeacher({ throwOnDatabaseError: true });
    return teacher ? NextResponse.json({ teacher }) : NextResponse.json({ teacher: null }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Account service is temporarily unavailable." }, { status: 503 });
  }
}
