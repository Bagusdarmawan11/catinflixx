import { NextRequest, NextResponse } from "next/server";
import { discoverMedia } from "@/lib/tmdb/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "movie") as "movie" | "tv";
  const page = parseInt(searchParams.get("page") || "1");
  const genre = searchParams.get("genre") || undefined;
  const year = searchParams.get("year") || undefined;
  const sort = searchParams.get("sort") || "popularity.desc";
  const lang = searchParams.get("lang") || undefined;

  try {
    const data = await discoverMedia({ type, page, genre, year, sort, lang });
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    if (err.message?.includes("401")) {
      return NextResponse.json({ success: false, error: "Autentikasi TMDB gagal" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Gagal mengambil data" }, { status: 500 });
  }
}
