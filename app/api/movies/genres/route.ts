import { NextRequest, NextResponse } from "next/server";
import { getGenres } from "@/lib/tmdb/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const mediaType = (searchParams.get("type") as "movie" | "tv") ?? "movie";

    if (mediaType !== "movie" && mediaType !== "tv") {
      return NextResponse.json(
        { success: false, error: "Parameter type harus movie atau tv" },
        { status: 400 }
      );
    }

    const genres = await getGenres(mediaType);

    return NextResponse.json(
      { success: true, genres },
      {
        headers: { "Cache-Control": "public, max-age=86400" }, // cache 24 jam
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server";
    console.error("[API] /movies/genres error:", err);
    const status = message.includes("authentication") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
