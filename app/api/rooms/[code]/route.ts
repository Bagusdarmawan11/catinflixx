import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchPartyRooms } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { verifyToken } from "@/lib/auth/jwt";
import { AUTH_CONFIG } from "@/config";

export const runtime = "nodejs";

interface PersistedRoom {
  code: string;
  hostUserId: number;
  videoUrl: string;
  videoTitle: string;
  createdAt: number;
  lastActiveAt?: number;
  videoState?: { isPlaying: boolean; currentTime: number; updatedAt: number };
}

/** Coba ambil dari in-memory store Socket.IO server (lebih fresh) */
function getRoomFromMemory(code: string): PersistedRoom | undefined {
  const socketRooms = (global as any).__catinfixRooms as
    | Map<string, PersistedRoom>
    | undefined;
  return socketRooms?.get(code);
}

// ─── GET /api/rooms/[code] — validasi room ────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();

    // 1. Cek in-memory dulu (cepat)
    const memRoom = getRoomFromMemory(code);
    if (memRoom) {
      const lastActivity = memRoom.lastActiveAt ?? memRoom.createdAt;
      const expired = lastActivity < Date.now() - 24 * 60 * 60 * 1000;
      if (!expired) {
        return NextResponse.json({
          success: true,
          room: {
            code: memRoom.code,
            hostUserId: memRoom.hostUserId,
            videoUrl: memRoom.videoUrl,
            videoTitle: memRoom.videoTitle,
            videoState: memRoom.videoState,
          },
        });
      }
    }

    // 2. Fallback ke DB
    const now = new Date();
    const [room] = await db
      .select()
      .from(watchPartyRooms)
      .where(
        and(
          eq(watchPartyRooms.code, code as any),
          gt(watchPartyRooms.expiresAt, now)
        )
      )
      .limit(1);

    if (!room) {
      return NextResponse.json(
        { success: false, error: "Room tidak ditemukan atau sudah berakhir" },
        { status: 404 }
      );
    }

    // Sync ke in-memory agar request berikutnya lebih cepat
    const socketRooms = (global as any).__catinfixRooms as
      | Map<string, PersistedRoom>
      | undefined;
    if (socketRooms && !socketRooms.has(code)) {
      socketRooms.set(code, {
        code: room.code,
        hostUserId: room.hostUserId,
        videoUrl: room.videoUrl,
        videoTitle: room.videoTitle,
        createdAt: room.createdAt.getTime(),
        lastActiveAt: Date.now(),
        videoState: {
          isPlaying: room.isPlaying,
          currentTime: room.currentTime,
          updatedAt: Date.now(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      room: {
        code: room.code,
        hostUserId: room.hostUserId,
        videoUrl: room.videoUrl,
        videoTitle: room.videoTitle,
        videoState: {
          isPlaying: room.isPlaying,
          currentTime: room.currentTime,
          updatedAt: Date.now(),
        },
      },
    });
  } catch (err) {
    console.error("[Rooms] GET error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data room" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/rooms/[code] — tutup room (host only) ───────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();

    // Verifikasi auth
    const token = req.cookies.get(AUTH_CONFIG.cookieName)?.value;
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

    // Pastikan hanya host yang bisa hapus
    const [room] = await db
      .select({ hostUserId: watchPartyRooms.hostUserId })
      .from(watchPartyRooms)
      .where(eq(watchPartyRooms.code, code as any))
      .limit(1);

    if (room && room.hostUserId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: "Hanya host yang bisa menutup room" },
        { status: 403 }
      );
    }

    // Hapus dari DB
    await db
      .delete(watchPartyRooms)
      .where(eq(watchPartyRooms.code, code as any));

    // Hapus dari in-memory
    const socketRooms = (global as any).__catinfixRooms as
      | Map<string, any>
      | undefined;
    socketRooms?.delete(code);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Rooms] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus room" },
      { status: 500 }
    );
  }
}
