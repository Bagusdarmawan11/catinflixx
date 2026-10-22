import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

// Shared global registry agar konsisten dengan [code]/route.ts
declare global {
  // eslint-disable-next-line no-var
  var __roomRegistry: Map<string, {
    code: string;
    hostUserId: number;
    videoUrl: string;
    videoTitle: string;
    createdAt: number;
  }> | undefined;
}

if (!global.__roomRegistry) {
  global.__roomRegistry = new Map();
}

const roomRegistry = global.__roomRegistry;

function cleanupOldRooms() {
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  for (const [code, room] of roomRegistry.entries()) {
    if (room.createdAt < sixHoursAgo) {
      roomRegistry.delete(code);
    }
  }
}

// POST /api/rooms — buat room baru
export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("catinflix_session")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: "Token tidak valid" }, { status: 401 });
    }

    const body = await req.json();
    const { videoUrl, videoTitle } = body;

    if (!videoUrl) {
      return NextResponse.json({ success: false, error: "URL video diperlukan" }, { status: 400 });
    }

    cleanupOldRooms();

    const code = nanoid(6).toUpperCase();
    const room = {
      code,
      hostUserId: payload.userId,
      videoUrl,
      videoTitle: videoTitle || "Watch Party",
      createdAt: Date.now(),
    };

    roomRegistry.set(code, room);

    return NextResponse.json({ success: true, room });
  } catch (err) {
    console.error("Create room error:", err);
    return NextResponse.json({ success: false, error: "Gagal membuat room" }, { status: 500 });
  }
}

// GET /api/rooms — ambil room aktif milik user
export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("catinflix_session")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: "Token tidak valid" }, { status: 401 });
    }

    cleanupOldRooms();

    const myRooms = Array.from(roomRegistry.values())
      .filter((r) => r.hostUserId === payload.userId)
      .slice(0, 5);

    return NextResponse.json({ success: true, rooms: myRooms });
  } catch {
    return NextResponse.json({ success: false, error: "Gagal mengambil data" }, { status: 500 });
  }
}
