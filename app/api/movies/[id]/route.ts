import { NextRequest, NextResponse } from "next/server";
import { getMovieDetail, getTvDetail } from "@/lib/tmdb/client";
import type { MediaType } from "@/lib/tmdb/types";

export const runtime = "nodejs";

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: "ID film tidak valid" },
        { status: 400 }
      );
    }

    const { searchParams } = req.nextUrl;
    const mediaType = (searchParams.get("type") as MediaType) ?? "movie";

    if (mediaType !== "movie" && mediaType !== "tv") {
      return NextResponse.json(
        { success: false, error: "Parameter type harus movie atau tv" },
        { status: 400 }
      );
    }

    const detail = mediaType === "movie"
      ? await getMovieDetail(id)
      : await getTvDetail(id);

    return NextResponse.json({ success: true, data: detail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server";
    console.error(`[API] /movies/${params.id} error:`, err);
    const status = message === "Not found" ? 404
      : message.includes("rate limit") ? 429
      : message.includes("authentication") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
