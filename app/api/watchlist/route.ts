import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { watchlist } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

// GET /api/watchlist — ambil semua watchlist user
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

    const items = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, payload.userId))
      .orderBy(watchlist.addedAt);

    return NextResponse.json({ success: true, items });
  } catch {
    return NextResponse.json({ success: false, error: "Gagal mengambil watchlist" }, { status: 500 });
  }
}

// POST /api/watchlist — tambah item
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
    const { tmdbId, mediaType, title, posterPath } = body;

    if (!tmdbId || !mediaType || !title) {
      return NextResponse.json({ success: false, error: "Data tidak lengkap" }, { status: 400 });
    }

    // Cek duplikat
    const existing = await db
      .select({ id: watchlist.id })
      .from(watchlist)
      .where(
        and(
          eq(watchlist.userId, payload.userId),
          eq(watchlist.tmdbId, Number(tmdbId)),
          eq(watchlist.mediaType, mediaType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ success: true, message: "Sudah ada di watchlist" });
    }

    await db.insert(watchlist).values({
      userId: payload.userId,
      tmdbId: Number(tmdbId),
      mediaType,
      title,
      posterPath: posterPath || null,
    });

    return NextResponse.json({ success: true, message: "Ditambahkan ke watchlist" });
  } catch {
    return NextResponse.json({ success: false, error: "Gagal menambahkan" }, { status: 500 });
  }
}

// DELETE /api/watchlist — hapus item
export async function DELETE(req: NextRequest) {
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
    const { tmdbId, mediaType } = body;

    if (!tmdbId || !mediaType) {
      return NextResponse.json({ success: false, error: "Data tidak lengkap" }, { status: 400 });
    }

    await db
      .delete(watchlist)
      .where(
        and(
          eq(watchlist.userId, payload.userId),
          eq(watchlist.tmdbId, Number(tmdbId)),
          eq(watchlist.mediaType, mediaType)
        )
      );

    return NextResponse.json({ success: true, message: "Dihapus dari watchlist" });
  } catch {
    return NextResponse.json({ success: false, error: "Gagal menghapus" }, { status: 500 });
  }
}
