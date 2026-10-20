import { NextRequest, NextResponse } from "next/server";
import { getTrending } from "@/lib/tmdb/client";
import type { MediaType } from "@/lib/tmdb/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const mediaType = (searchParams.get("type") as MediaType | "all") ?? "all";
    const timeWindow = (searchParams.get("window") as "day" | "week") ?? "week";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

    const validTypes = ["all", "movie", "tv"];
    if (!validTypes.includes(mediaType)) {
      return NextResponse.json(
        { success: false, error: "Parameter type tidak valid. Gunakan: all, movie, atau tv" },
        { status: 400 }
      );
    }

    const data = await getTrending(mediaType, timeWindow, page);

    return NextResponse.json({ success: true, ...data, page });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server";
    console.error("[API] /movies/trending error:", err);
    const status = message.includes("rate limit") ? 429
      : message.includes("authentication") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
