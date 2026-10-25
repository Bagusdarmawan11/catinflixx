import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/*
 * FIX FATAL: Sinkronisasi roomRegistry antara API route dan Socket.IO server.
 *
 * Sebelumnya: API route punya global.__roomRegistry sendiri (in-memory Next.js),
 * sedangkan server/index.ts punya persistedRooms sendiri.
 * Akibatnya: user/tamu yang cek room via GET /api/rooms/[code] selalu dapat 404
 * karena room hanya ada di Socket.IO store, bukan di registry API.
 *
 * Fix: server/index.ts mengekspos persistedRooms-nya via global.__catinfixRooms.
 * Karena custom server dan Next.js route handlers berjalan dalam 1 process,
 * global variable ini bisa diakses dari sini.
 *
 * Fallback: kalau __catinfixRooms belum tersedia (race condition saat cold start),
 * cek juga __roomRegistry lama supaya backward compatible.
 */

interface PersistedRoom {
  code: string;
  hostUserId: number;
  videoUrl: string;
  videoTitle: string;
  createdAt: number;
  lastActiveAt?: number;
  videoState?: { isPlaying: boolean; currentTime: number; updatedAt: number };
}

function getRoomRegistry(): Map<string, PersistedRoom> | undefined {
  // Prioritas 1: registry dari Socket.IO server (fix utama)
  const socketRooms = (global as any).__catinfixRooms as Map<string, PersistedRoom> | undefined;
  if (socketRooms && socketRooms.size >= 0) return socketRooms;

  // Fallback: registry lama dari API route
  return (global as any).__roomRegistry as Map<string, PersistedRoom> | undefined;
}

// GET /api/rooms/[code] — cek apakah room valid
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();
    const registry = getRoomRegistry();

    if (!registry) {
      // Server belum sepenuhnya boot, beri status 503 bukan 404
      return NextResponse.json(
        { success: false, error: "Server sedang memuat, coba lagi sebentar" },
        { status: 503 }
      );
    }

    const room = registry.get(code);

    if (!room) {
      return NextResponse.json(
        { success: false, error: "Room tidak ditemukan" },
        { status: 404 }
      );
    }

    // Cek expired: pakai lastActiveAt kalau ada (lebih akurat), fallback ke createdAt
    const lastActivity = room.lastActiveAt ?? room.createdAt;
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (lastActivity < twentyFourHoursAgo) {
      registry.delete(code);
      return NextResponse.json(
        { success: false, error: "Room sudah berakhir" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, room });
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal mengambil room" },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/[code] — tutup room (host only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();
    const registry = getRoomRegistry();
    registry?.delete(code);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal menghapus room" },
      { status: 500 }
    );
  }
}
