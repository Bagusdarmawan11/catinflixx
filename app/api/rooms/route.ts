import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { watchRooms } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

// POST /api/rooms — buat room baru
export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("catinflix_session")?.value;
    if (!token) return NextResponse.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Token tidak valid" }, { status: 401 });

    const body = await req.json();
    const { videoUrl, videoTitle } = body;

    if (!videoUrl) {
      return NextResponse.json({ success: false, error: "URL video diperlukan" }, { status: 400 });
    }

    // Generate kode unik 6 karakter (huruf kapital + angka)
    const code = nanoid(6).toUpperCase();

    const [room] = await db
      .insert(watchRooms)
      .values({
        code,
        hostUserId: payload.userId,
        videoUrl,
        videoTitle: videoTitle || "Video tanpa judul",
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, room });
  } catch (err) {
    console.error("Create room error:", err);
    return NextResponse.json({ success: false, error: "Gagal membuat room" }, { status: 500 });
  }
}

// GET /api/rooms — ambil room aktif milik user (opsional)
export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("catinflix_session")?.value;
    if (!token) return NextResponse.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Token tidak valid" }, { status: 401 });

    const myRooms = await db
      .select()
      .from(watchRooms)
      .where(eq(watchRooms.hostUserId, payload.userId))
      .orderBy(desc(watchRooms.createdAt))
      .limit(5);

    return NextResponse.json({ success: true, rooms: myRooms });
  } catch {
    return NextResponse.json({ success: false, error: "Gagal mengambil data" }, { status: 500 });
  }
}
