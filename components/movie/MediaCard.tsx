"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Play, Bookmark, BookmarkCheck, Tv, Film } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface MediaCardProps {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseDate: string;
  voteAverage: number;
  overview?: string;
  inWatchlist?: boolean;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export default function MediaCard({
  id,
  mediaType,
  title,
  posterPath,
  releaseDate,
  voteAverage,
  overview,
  inWatchlist = false,
}: MediaCardProps) {
  const [hovered, setHovered] = useState(false);
  const [watchlisted, setWatchlisted] = useState(inWatchlist);
  const [loadingWl, setLoadingWl] = useState(false);
  const { toast } = useToast();

  const year = releaseDate ? new Date(releaseDate).getFullYear() : "—";
  const rating = voteAverage ? voteAverage.toFixed(1) : "N/A";
  const posterUrl = posterPath ? `${TMDB_IMAGE_BASE}/w342${posterPath}` : null;

  async function handleWatchlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loadingWl) return;
    setLoadingWl(true);

    const willAdd = !watchlisted;
    setWatchlisted(willAdd); // optimistic

    try {
      const method = watchlisted ? "DELETE" : "POST";
      const res = await fetch("/api/watchlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: id, mediaType, title, posterPath }),
      });

      if (res.status === 401) {
        setWatchlisted(!willAdd);
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        setWatchlisted(!willAdd);
        toast("Gagal memperbarui watchlist. Coba lagi.", "error");
      } else {
        toast(
          willAdd ? `"${title}" ditambahkan ke Watchlist` : `"${title}" dihapus dari Watchlist`,
          willAdd ? "success" : "info"
        );
      }
    } catch {
      setWatchlisted(!willAdd);
      toast("Koneksi gagal. Coba lagi.", "error");
    }

    setLoadingWl(false);
  }

  return (
    <Link href={`/movie/${id}?type=${mediaType}`} className="group block">
      <div
        className="relative rounded-xl overflow-hidden bg-gray-900 aspect-[2/3] cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Poster */}
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 gap-2">
            {mediaType === "tv" ? (
              <Tv className="w-12 h-12 text-gray-600" />
            ) : (
              <Film className="w-12 h-12 text-gray-600" />
            )}
            <span className="text-gray-600 text-xs text-center px-2 line-clamp-2">{title}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300 ${
            hovered ? "opacity-100" : "opacity-60"
          }`}
        />

        {/* Media type badge */}
        <div className="absolute top-2 left-2">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              mediaType === "tv" ? "bg-blue-600/80 text-white" : "bg-red-600/80 text-white"
            }`}
          >
            {mediaType === "tv" ? "Serial" : "Film"}
          </span>
        </div>

        {/* Rating badge — hidden on hover OR when watchlisted (button takes its place) */}
        {voteAverage > 0 && !watchlisted && (
          <div
            className={`absolute top-2 right-2 transition-opacity duration-200 pointer-events-none ${
              hovered ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-white text-xs font-medium">{rating}</span>
            </div>
          </div>
        )}

        {/* Watchlist button — always visible if in watchlist, else on hover */}
        <button
          onClick={handleWatchlist}
          disabled={loadingWl}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-all duration-200 z-10 ${
            watchlisted
              ? "bg-red-600 text-white opacity-100"
              : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
          } disabled:opacity-60`}
          title={watchlisted ? "Hapus dari Watchlist" : "Tambah ke Watchlist"}
        >
          {watchlisted ? (
            <BookmarkCheck className="w-4 h-4" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </button>

        {/* Hover overlay content */}
        <div
          className={`absolute inset-0 flex flex-col justify-end p-3 transition-opacity duration-300 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          {overview && (
            <p className="text-gray-300 text-xs line-clamp-3 mb-2">{overview}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs">{year}</span>
            {voteAverage > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-400 text-xs font-medium">{rating}</span>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2">
            <Play className="w-4 h-4 text-white fill-white" />
            <span className="text-white text-sm font-medium">Lihat Detail</span>
          </div>
        </div>
      </div>

      {/* Title below card */}
      <div className="mt-2 px-0.5">
        <p className="text-gray-200 text-sm font-medium line-clamp-1 group-hover:text-white transition-colors">
          {title}
        </p>
        <p className="text-gray-500 text-xs mt-0.5">{year}</p>
      </div>
    </Link>
  );
}
