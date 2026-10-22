import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Import registry yang sama dari parent route
// Karena Next.js route handlers di-isolate per module, kita perlu solusi shared state.
// Paling simpel: gunakan global variable agar persist antar requests dalam satu process.

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

// GET /api/rooms/[code] — cek apakah room valid
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();
    const room = roomRegistry.get(code);

    if (!room) {
      return NextResponse.json(
        { success: false, error: "Room tidak ditemukan" },
        { status: 404 }
      );
    }

    // Cek apakah room sudah expired (6 jam)
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    if (room.createdAt < sixHoursAgo) {
      roomRegistry.delete(code);
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
    roomRegistry.delete(code);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal menghapus room" },
      { status: 500 }
    );
  }
}
