import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Clock, Calendar, Globe, Play, ArrowLeft, Bookmark, Users } from "lucide-react";
import type { Metadata } from "next";
import MediaRow from "@/components/movie/MediaRow";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

interface PageProps {
  params: { id: string };
  searchParams: { type?: string };
}

async function getDetail(id: string, type: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/movies/${id}?type=${type}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data || null;
  } catch {
    return null;
  }
}

async function getSimilar(id: string, type: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/movies/trending?type=${type}&window=week&page=1`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).filter((item: any) => String(item.id) !== id).slice(0, 20);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const type = searchParams?.type || "movie";
  const detail = await getDetail(params.id, type);
  if (!detail) return { title: "Film Tidak Ditemukan" };
  return {
    title: detail.title,
    description: detail.overview?.slice(0, 160),
    openGraph: {
      title: detail.title,
      description: detail.overview?.slice(0, 160),
      images: detail.backdropPath ? [`${TMDB_IMAGE_BASE}/w1280${detail.backdropPath}`] : [],
    },
  };
}

export default async function MovieDetailPage({ params, searchParams }: PageProps) {
  const type = searchParams?.type || "movie";
  const [detail, similar] = await Promise.all([
    getDetail(params.id, type),
    getSimilar(params.id, type),
  ]);

  if (!detail) notFound();

  const backdropUrl = detail.backdropPath
    ? `${TMDB_IMAGE_BASE}/original${detail.backdropPath}`
    : null;
  const posterUrl = detail.posterPath
    ? `${TMDB_IMAGE_BASE}/w500${detail.posterPath}`
    : null;

  const trailer = detail.videos?.find(
    (v: any) => v.type === "Trailer" && v.site === "YouTube"
  );

  const year = detail.releaseDate ? new Date(detail.releaseDate).getFullYear() : "—";
  const runtime = detail.runtime
    ? `${Math.floor(detail.runtime / 60)}j ${detail.runtime % 60}m`
    : null;

  return (
    <main className="bg-gray-950 min-h-screen">
      {/* Backdrop */}
      <div className="relative w-full h-[60vh] min-h-[400px] overflow-hidden">
        {backdropUrl ? (
          <Image
            src={backdropUrl}
            alt={detail.title}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="w-full h-full bg-gray-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-gray-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/60 to-transparent" />

        {/* Back button */}
        <div className="absolute top-24 left-4 sm:left-6">
          <Link
            href="javascript:history.back()"
            className="flex items-center gap-2 bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-full backdrop-blur-sm transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-40 relative z-10 pb-16">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <div className="flex-none">
            <div className="w-44 sm:w-56 mx-auto md:mx-0">
              {posterUrl ? (
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-gray-800">
                  <Image
                    src={posterUrl}
                    alt={detail.title}
                    fill
                    className="object-cover"
                    sizes="224px"
                  />
                </div>
              ) : (
                <div className="aspect-[2/3] rounded-2xl bg-gray-800 flex items-center justify-center ring-2 ring-gray-700">
                  <span className="text-gray-600 text-5xl">🎬</span>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            {/* Type badge */}
            <span
              className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${
                type === "tv" ? "bg-blue-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {type === "tv" ? "Serial TV" : "Film"}
            </span>

            {/* Title */}
            <h1 className="text-white text-3xl sm:text-4xl font-bold leading-tight mb-2">
              {detail.title}
            </h1>

            {/* Original title */}
            {detail.originalTitle && detail.originalTitle !== detail.title && (
              <p className="text-gray-500 text-sm mb-4">
                Judul Asli: {detail.originalTitle}
              </p>
            )}

            {/* Meta badges */}
            <div className="flex flex-wrap gap-3 mb-5">
              {detail.voteAverage > 0 && (
                <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-full">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-yellow-400 font-semibold text-sm">
                    {detail.voteAverage.toFixed(1)}
                  </span>
                  {detail.voteCount > 0 && (
                    <span className="text-yellow-600 text-xs">
                      ({detail.voteCount.toLocaleString()})
                    </span>
                  )}
                </div>
              )}
              {year && (
                <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-full">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">{year}</span>
                </div>
              )}
              {runtime && (
                <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-full">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">{runtime}</span>
                </div>
              )}
              {detail.language && (
                <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-full">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm uppercase">{detail.language}</span>
                </div>
              )}
            </div>

            {/* Genres */}
            {detail.genres && detail.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {detail.genres.map((g: any) => (
                  <Link
                    key={g.id}
                    href={`/browse?type=${type}&genre=${g.id}`}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1 rounded-full transition-colors border border-gray-700"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Overview */}
            {detail.overview && (
              <div className="mb-6">
                <h2 className="text-white font-semibold mb-2">Sinopsis</h2>
                <p className="text-gray-400 leading-relaxed">{detail.overview}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {trailer ? (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
                >
                  <Play className="w-5 h-5 fill-white" />
                  Tonton Trailer
                </a>
              ) : (
                <button className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
                  <Play className="w-5 h-5 fill-white" />
                  Tonton
                </button>
              )}
              <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors">
                <Bookmark className="w-5 h-5" />
                Watchlist
              </button>
              <Link
                href="/watch-party"
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors"
              >
                <Users className="w-5 h-5" />
                Watch Party
              </Link>
            </div>

            {/* Extra info for TV shows */}
            {type === "tv" && (detail.seasons || detail.episodes) && (
              <div className="mt-5 flex gap-4">
                {detail.seasons && (
                  <div className="bg-gray-800/60 rounded-xl px-4 py-3">
                    <p className="text-white font-bold text-xl">{detail.seasons}</p>
                    <p className="text-gray-500 text-xs">Musim</p>
                  </div>
                )}
                {detail.episodes && (
                  <div className="bg-gray-800/60 rounded-xl px-4 py-3">
                    <p className="text-white font-bold text-xl">{detail.episodes}</p>
                    <p className="text-gray-500 text-xs">Episode</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cast */}
        {detail.cast && detail.cast.length > 0 && (
          <section className="mt-12">
            <h2 className="text-white text-xl font-bold mb-4">Pemeran Utama</h2>
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {detail.cast.slice(0, 12).map((person: any) => (
                <div key={person.id} className="flex-none w-24 text-center">
                  <div className="w-20 h-20 mx-auto rounded-full overflow-hidden bg-gray-800 mb-2">
                    {person.profilePath ? (
                      <Image
                        src={`${TMDB_IMAGE_BASE}/w185${person.profilePath}`}
                        alt={person.name}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                    )}
                  </div>
                  <p className="text-white text-xs font-medium line-clamp-2">{person.name}</p>
                  {person.character && (
                    <p className="text-gray-500 text-xs line-clamp-1 mt-0.5">{person.character}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Similar */}
        {similar.length > 0 && (
          <section className="mt-12">
            <MediaRow
              title={`${type === "tv" ? "Serial" : "Film"} Serupa`}
              items={similar}
              viewAllHref={`/browse?type=${type}`}
            />
          </section>
        )}
      </div>
    </main>
  );
}
