import { NextRequest, NextResponse } from "next/server";
import { getMovieDetail, getTvDetail } from "@/lib/tmdb/client";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(_req.url);
  const type = searchParams.get("type") || "movie";
  const id = parseInt(params.id);

  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });
  }

  try {
    let detail;
    if (type === "tv") {
      detail = await getTvDetail(id);
    } else {
      detail = await getMovieDetail(id);
    }

    // Fetch credits (cast) from TMDB
    const TMDB_BASE_URL = "https://api.themoviedb.org/3";
    const endpoint = type === "tv" ? "tv" : "movie";
    const creditsRes = await fetch(
      `${TMDB_BASE_URL}/${endpoint}/${id}/credits?language=id-ID`,
      {
        headers: getAuthHeader(),
        next: { revalidate: 300 },
      }
    );

    if (creditsRes.ok) {
      const credits = await creditsRes.json();
      detail.cast = (credits.cast || [])
        .slice(0, 15)
        .map((person: any) => ({
          id: person.id,
          name: person.name,
          character: person.character,
          profilePath: person.profile_path,
        }));
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (err: any) {
    if (err.message?.includes("404")) {
      return NextResponse.json({ success: false, error: "Konten tidak ditemukan" }, { status: 404 });
    }
    if (err.message?.includes("401")) {
      return NextResponse.json({ success: false, error: "Autentikasi TMDB gagal" }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: "Gagal mengambil detail" },
      { status: 500 }
    );
  }
}

function getAuthHeader(): HeadersInit {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) throw new Error("TMDB_API_TOKEN not set");
  if (token.startsWith("eyJ")) {
    return { Authorization: `Bearer ${token}` };
  }
  return {}; // will be handled via query param fallback
}
