"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bookmark, Star, Trash2, Play, Film, Tv, Loader2 } from "lucide-react";

interface WatchlistItem {
  id: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  addedAt: string;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-5">
        <Bookmark className="w-10 h-10 text-gray-600" />
      </div>
      <h2 className="text-white text-xl font-bold mb-2">Watchlist Kosong</h2>
      <p className="text-gray-500 mb-6 max-w-xs">
        Belum ada film atau serial yang kamu simpan. Mulai tambahkan dari halaman film!
      </p>
      <Link
        href="/browse"
        className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        Jelajahi Film
      </Link>
    </div>
  );
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");

  useEffect(() => {
    fetchWatchlist();
  }, []);

  async function fetchWatchlist() {
    try {
      const res = await fetch("/api/watchlist");
      if (res.status === 401) {
        window.location.href = "/login?redirect=/watchlist";
        return;
      }
      if (res.ok) {
        const data = await res.json();
        // Reverse so newest first
        setItems((data.items || []).reverse());
      }
    } catch {}
    setLoading(false);
  }

  async function removeItem(tmdbId: number, mediaType: string) {
    setRemoving(tmdbId);
    try {
      const res = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, mediaType }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => !(i.tmdbId === tmdbId && i.mediaType === mediaType)));
      }
    } catch {}
    setRemoving(null);
  }

  const filtered = filter === "all" ? items : items.filter((i) => i.mediaType === filter);
  const movieCount = items.filter((i) => i.mediaType === "movie").length;
  const tvCount = items.filter((i) => i.mediaType === "tv").length;

  return (
    <main className="bg-gray-950 min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-red-600/20 rounded-xl flex items-center justify-center">
                <Bookmark className="w-5 h-5 text-red-500" />
              </div>
              <h1 className="text-white text-2xl sm:text-3xl font-bold">Watchlist Saya</h1>
            </div>
            <p className="text-gray-500 text-sm ml-12">
              {loading ? "Memuat..." : `${items.length} item tersimpan`}
            </p>
          </div>

          {/* Stats chips */}
          {!loading && items.length > 0 && (
            <div className="flex gap-2 ml-12 sm:ml-0">
              <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 flex items-center gap-2">
                <Film className="w-4 h-4 text-red-500" />
                <span className="text-white text-sm font-medium">{movieCount} Film</span>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 flex items-center gap-2">
                <Tv className="w-4 h-4 text-blue-500" />
                <span className="text-white text-sm font-medium">{tvCount} Serial</span>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex gap-2 mb-6">
              {(["all", "movie", "tv"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === f
                      ? "bg-red-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {f === "all" ? `Semua (${items.length})` : f === "movie" ? `Film (${movieCount})` : `Serial (${tvCount})`}
                </button>
              ))}
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                Tidak ada {filter === "movie" ? "film" : "serial"} di watchlist.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filtered.map((item) => (
                  <div key={`${item.mediaType}-${item.tmdbId}`} className="group relative">
                    <Link href={`/movie/${item.tmdbId}?type=${item.mediaType}`}>
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-800">
                        {item.posterPath ? (
                          <Image
                            src={`${TMDB_IMAGE_BASE}/w342${item.posterPath}`}
                            alt={item.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 50vw, 20vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {item.mediaType === "tv" ? (
                              <Tv className="w-12 h-12 text-gray-600" />
                            ) : (
                              <Film className="w-12 h-12 text-gray-600" />
                            )}
                          </div>
                        )}

                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg">
                            <Play className="w-4 h-4 text-white fill-white" />
                            <span className="text-white text-xs font-medium">Detail</span>
                          </div>
                        </div>

                        {/* Type badge */}
                        <div className="absolute top-2 left-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            item.mediaType === "tv" ? "bg-blue-600/80 text-white" : "bg-red-600/80 text-white"
                          }`}>
                            {item.mediaType === "tv" ? "Serial" : "Film"}
                          </span>
                        </div>
                      </div>
                    </Link>

                    {/* Remove button */}
                    <button
                      onClick={() => removeItem(item.tmdbId, item.mediaType)}
                      disabled={removing === item.tmdbId}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                      title="Hapus dari watchlist"
                    >
                      {removing === item.tmdbId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Title */}
                    <div className="mt-2">
                      <p className="text-gray-200 text-sm font-medium line-clamp-1 group-hover:text-white transition-colors">
                        {item.title}
                      </p>
                      <p className="text-gray-600 text-xs mt-0.5">
                        {new Date(item.addedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
