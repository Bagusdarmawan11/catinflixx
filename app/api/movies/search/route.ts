import { NextRequest, NextResponse } from "next/server";
import { searchMulti } from "@/lib/tmdb/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const query = searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

    if (!query) {
      return NextResponse.json(
        { success: false, error: "Parameter q (query) tidak boleh kosong" },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        { success: false, error: "Query minimal 2 karakter" },
        { status: 400 }
      );
    }

    const data = await searchMulti(query, page);

    return NextResponse.json({ success: true, query, ...data, page });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server";
    console.error("[API] /movies/search error:", err);
    const status = message.includes("rate limit") ? 429
      : message.includes("authentication") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
