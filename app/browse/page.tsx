"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X, ChevronDown, Loader2 } from "lucide-react";
import MediaGrid from "@/components/movie/MediaGrid";

interface Genre {
  id: number;
  name: string;
}

interface MediaItem {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseDate: string;
  voteAverage: number;
  overview?: string;
}

const SORT_OPTIONS = [
  { value: "popularity.desc", label: "Paling Populer" },
  { value: "vote_average.desc", label: "Rating Tertinggi" },
  { value: "release_date.desc", label: "Terbaru" },
  { value: "release_date.asc", label: "Terlama" },
  { value: "revenue.desc", label: "Pendapatan Tertinggi" },
];

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state from URL params
  const query = searchParams.get("q") || "";
  const type = (searchParams.get("type") || "all") as "movie" | "tv" | "all";
  const genre = searchParams.get("genre") || "";
  const sort = searchParams.get("sort") || "popularity.desc";
  const year = searchParams.get("year") || "";

  // Local filter state for UI
  const [localType, setLocalType] = useState(type);
  const [localGenre, setLocalGenre] = useState(genre);
  const [localSort, setLocalSort] = useState(sort);
  const [localYear, setLocalYear] = useState(year);
  const [searchInput, setSearchInput] = useState(query);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    params.delete("page");
    router.push(`/browse?${params.toString()}`);
  }

  function applyFilters() {
    const updates: Record<string, string> = {
      type: localType !== "all" ? localType : "",
      genre: localGenre,
      sort: localSort,
      year: localYear,
    };
    if (searchInput.trim()) updates.q = searchInput.trim();
    else updates.q = "";
    updateParams(updates);
    setShowFilters(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: searchInput.trim() });
  }

  const fetchResults = useCallback(
    async (p: number, append = false) => {
      setLoading(true);
      try {
        let url: string;
        if (query.length >= 2) {
          url = `/api/movies/search?q=${encodeURIComponent(query)}&page=${p}`;
        } else {
          const params = new URLSearchParams({
            page: String(p),
            sort,
          });
          if (type !== "all") params.set("type", type);
          else params.set("type", "movie"); // default for discover
          if (genre) params.set("genre", genre);
          if (year) params.set("year", year);
          url = `/api/movies/discover?${params}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Gagal memuat");
        const data = await res.json();

        const items = data.results || [];
        setTotalResults(data.total || items.length);
        setHasMore(p < (data.totalPages || 1));

        if (append) {
          setResults((prev) => [...prev, ...items]);
        } else {
          setResults(items);
        }
      } catch {
        if (!append) setResults([]);
      }
      setLoading(false);
    },
    [query, type, genre, sort, year]
  );

  // Fetch genres
  useEffect(() => {
    async function fetchGenres() {
      try {
        const t = type === "all" ? "movie" : type;
        const res = await fetch(`/api/movies/genres?type=${t}`);
        if (res.ok) {
          const data = await res.json();
          setGenres(data.genres || []);
        }
      } catch {}
    }
    fetchGenres();
  }, [type]);

  // Fetch on param change
  useEffect(() => {
    setPage(1);
    fetchResults(1, false);
    setLocalType(type);
    setLocalGenre(genre);
    setLocalSort(sort);
    setLocalYear(year);
    setSearchInput(query);
  }, [query, type, genre, sort, year, fetchResults]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchResults(next, true);
  }

  const pageTitle = query
    ? `Hasil pencarian: "${query}"`
    : type === "movie"
    ? "Film"
    : type === "tv"
    ? "Serial TV"
    : "Semua Konten";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-white text-2xl sm:text-3xl font-bold mb-1">{pageTitle}</h1>
        {!loading && totalResults > 0 && (
          <p className="text-gray-500 text-sm">{totalResults.toLocaleString()} hasil ditemukan</p>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari film, serial..."
            className="w-full bg-gray-900 border border-gray-800 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-red-500 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                updateParams({ q: "" });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-semibold transition-colors"
        >
          Cari
        </button>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
            showFilters
              ? "bg-gray-700 border-gray-600 text-white"
              : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700"
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
          <span className="hidden sm:inline text-sm">Filter</span>
        </button>
      </form>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Type */}
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Tipe</label>
              <div className="flex gap-2">
                {(["all", "movie", "tv"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setLocalType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      localType === t
                        ? "bg-red-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {t === "all" ? "Semua" : t === "movie" ? "Film" : "Serial"}
                  </button>
                ))}
              </div>
            </div>

            {/* Genre */}
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Genre</label>
              <div className="relative">
                <select
                  value={localGenre}
                  onChange={(e) => setLocalGenre(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 appearance-none"
                >
                  <option value="">Semua Genre</option>
                  {genres.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Urutkan</label>
              <div className="relative">
                <select
                  value={localSort}
                  onChange={(e) => setLocalSort(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 appearance-none"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Year */}
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Tahun</label>
              <input
                type="number"
                value={localYear}
                onChange={(e) => setLocalYear(e.target.value)}
                placeholder="mis. 2023"
                min="1900"
                max={new Date().getFullYear()}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
            <button
              onClick={() => {
                setLocalType("all");
                setLocalGenre("");
                setLocalSort("popularity.desc");
                setLocalYear("");
              }}
              className="text-gray-400 hover:text-white text-sm px-4 py-2 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={applyFilters}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}

      {/* Quick type filter chips */}
      {!query && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { value: "", label: "Semua" },
            { value: "movie", label: "Film" },
            { value: "tv", label: "Serial" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => updateParams({ type: t.value })}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                type === (t.value || "all")
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <MediaGrid
        items={results}
        loading={loading && page === 1}
        emptyMessage={
          query
            ? `Tidak ada hasil untuk "${query}"`
            : "Tidak ada konten ditemukan dengan filter ini."
        }
      />

      {/* Load more */}
      {!loading && hasMore && results.length > 0 && (
        <div className="flex justify-center mt-10">
          <button
            onClick={loadMore}
            className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Memuat...
              </>
            ) : (
              "Muat Lebih Banyak"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <main className="bg-gray-950 min-h-screen pt-20">
      <Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="h-8 bg-gray-800 rounded animate-pulse w-48 mb-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        }
      >
        <BrowseContent />
      </Suspense>
    </main>
  );
}
