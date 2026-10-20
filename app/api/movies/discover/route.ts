import { NextRequest, NextResponse } from "next/server";
import { discoverMedia } from "@/lib/tmdb/client";
import type { MediaType } from "@/lib/tmdb/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const mediaType = (searchParams.get("type") as MediaType) ?? "movie";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const genreId = searchParams.get("genre") ? parseInt(searchParams.get("genre")!, 10) : undefined;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;
    const sortBy = searchParams.get("sort") ?? "popularity.desc";
    const withOriginalLanguage = searchParams.get("lang") ?? undefined;

    if (mediaType !== "movie" && mediaType !== "tv") {
      return NextResponse.json(
        { success: false, error: "Parameter type harus movie atau tv" },
        { status: 400 }
      );
    }

    const validSorts = [
      "popularity.desc", "popularity.asc",
      "vote_average.desc", "vote_average.asc",
      "release_date.desc", "release_date.asc",
    ];
    if (!validSorts.includes(sortBy)) {
      return NextResponse.json(
        { success: false, error: "Parameter sort tidak valid" },
        { status: 400 }
      );
    }

    const data = await discoverMedia(mediaType, {
      page, genreId, year, sortBy, withOriginalLanguage,
    });

    return NextResponse.json({ success: true, ...data, page });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server";
    console.error("[API] /movies/discover error:", err);
    const status = message.includes("rate limit") ? 429
      : message.includes("authentication") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
