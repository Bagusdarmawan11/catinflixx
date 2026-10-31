import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { watchPartyRooms } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

export const runtime = "nodejs";

// Generate kode 6 karakter — tanpa karakter ambigu (I, O, 0, 1)
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function generateUniqueCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateRoomCode();
    const now = new Date();
    const existing = await db
      .select({ code: watchPartyRooms.code })
      .from(watchPartyRooms)
      .where(
        and(
          eq(watchPartyRooms.code, code as any),
          gt(watchPartyRooms.expiresAt, now)
        )
      )
      .limit(1);
    if (existing.length === 0) return code;
    attempts++;
  }
  // Fallback: pakai nanoid
  const { nanoid } = await import("nanoid");
  return nanoid(6).toUpperCase();
}

// ─── POST /api/rooms — buat room baru ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("catinflix_session")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Tidak terautentikasi" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Token tidak valid" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { videoUrl, videoTitle } = body;

    if (!videoUrl?.trim()) {
      return NextResponse.json(
        { success: false, error: "URL video diperlukan" },
        { status: 400 }
      );
    }

    const code = await generateUniqueCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

    const [room] = await db
      .insert(watchPartyRooms)
      .values({
        code: code as any,
        hostUserId: payload.userId,
        videoUrl: videoUrl.trim(),
        videoTitle: (videoTitle?.trim() || "Watch Party") as any,
        expiresAt,
      })
      .returning();

    // Sync ke in-memory store Socket.IO server (jika sudah boot)
    const socketRooms = (global as any).__catinfixRooms as Map<string, any> | undefined;
    if (socketRooms) {
      socketRooms.set(code, {
        code,
        hostUserId: payload.userId,
        videoUrl: videoUrl.trim(),
        videoTitle: videoTitle?.trim() || "Watch Party",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        videoState: { isPlaying: false, currentTime: 0, updatedAt: Date.now() },
      });
    }

    return NextResponse.json({
      success: true,
      room: {
        code,
        hostUserId: payload.userId,
        videoUrl: room.videoUrl,
        videoTitle: room.videoTitle,
        createdAt: room.createdAt,
        expiresAt: room.expiresAt,
      },
    });
  } catch (err) {
    console.error("[Rooms] Create error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal membuat room" },
      { status: 500 }
    );
  }
}

// ─── GET /api/rooms — ambil room aktif milik user ─────────────────────────────

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("catinflix_session")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Tidak terautentikasi" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Token tidak valid" },
        { status: 401 }
      );
    }

    const now = new Date();
    const rooms = await db
      .select({
        code: watchPartyRooms.code,
        videoUrl: watchPartyRooms.videoUrl,
        videoTitle: watchPartyRooms.videoTitle,
        createdAt: watchPartyRooms.createdAt,
        expiresAt: watchPartyRooms.expiresAt,
      })
      .from(watchPartyRooms)
      .where(
        and(
          eq(watchPartyRooms.hostUserId, payload.userId),
          gt(watchPartyRooms.expiresAt, now)
        )
      )
      .limit(10);

    return NextResponse.json({ success: true, rooms });
  } catch (err) {
    console.error("[Rooms] List error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data" },
      { status: 500 }
    );
  }
}
