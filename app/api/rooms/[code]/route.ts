import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchRooms } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// GET /api/rooms/[code] — cek apakah room valid
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();

    const [room] = await db
      .select()
      .from(watchRooms)
      .where(eq(watchRooms.code, code))
      .limit(1);

    if (!room) {
      return NextResponse.json({ success: false, error: "Room tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, room });
  } catch {
    return NextResponse.json({ success: false, error: "Gagal mengambil room" }, { status: 500 });
  }
}

// DELETE /api/rooms/[code] — tutup room (host only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();
    await db.delete(watchRooms).where(eq(watchRooms.code, code));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Gagal menghapus room" }, { status: 500 });
  }
}
