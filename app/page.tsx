import { Suspense } from "react";
import HeroBanner from "@/components/movie/HeroBanner";
import MediaRow from "@/components/movie/MediaRow";
import { Film, Tv, TrendingUp, Star } from "lucide-react";
import { getTrending, discoverMedia } from "@/lib/tmdb/client";

async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const [
    trendingAllData,
    trendingMoviesData,
    trendingTVData,
    popularMoviesData,
    popularTVData,
    topRatedMoviesData,
  ] = await Promise.all([
    safeCall(() => getTrending("all", "week"), { results: [], total: 0, totalPages: 0, page: 1 }),
    safeCall(() => getTrending("movie", "week"), { results: [], total: 0, totalPages: 0, page: 1 }),
    safeCall(() => getTrending("tv", "week"), { results: [], total: 0, totalPages: 0, page: 1 }),
    safeCall(() => discoverMedia({ type: "movie", sort: "popularity.desc", page: 1 }), { results: [], total: 0, totalPages: 0, page: 1 }),
    safeCall(() => discoverMedia({ type: "tv", sort: "popularity.desc", page: 1 }), { results: [], total: 0, totalPages: 0, page: 1 }),
    safeCall(() => discoverMedia({ type: "movie", sort: "vote_average.desc", page: 1 }), { results: [], total: 0, totalPages: 0, page: 1 }),
  ]);

  const trendingAll = trendingAllData.results;
  const trendingMovies = trendingMoviesData.results;
  const trendingTV = trendingTVData.results;
  const popularMovies = popularMoviesData.results;
  const popularTV = popularTVData.results;
  const topRatedMovies = topRatedMoviesData.results;

  const heroItems = trendingAll.filter((item: any) => item.backdropPath).slice(0, 8);

  return (
    <main className="bg-gray-950 min-h-screen">
      {/* Hero Banner */}
      <Suspense fallback={<div className="h-[75vh] bg-gray-900 animate-pulse" />}>
        <HeroBanner items={heroItems} />
      </Suspense>

      {/* Content sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-12">
        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: TrendingUp, label: "Trending Minggu Ini", value: trendingAll.length + "+", color: "text-red-500" },
            { icon: Film, label: "Film Populer", value: popularMovies.length + "+", color: "text-blue-500" },
            { icon: Tv, label: "Serial Populer", value: popularTV.length + "+", color: "text-green-500" },
            { icon: Star, label: "Top Rating", value: topRatedMovies.length + "+", color: "text-yellow-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color} flex-shrink-0`} />
              <div>
                <p className="text-white font-bold text-lg">{value}</p>
                <p className="text-gray-500 text-xs">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {trendingAll.length > 0 && (
          <MediaRow title="🔥 Trending Minggu Ini" items={trendingAll.slice(0, 20)} viewAllHref="/browse?sort=popularity.desc" />
        )}
        {popularMovies.length > 0 && (
          <MediaRow title="🎬 Film Populer" items={popularMovies.slice(0, 20)} viewAllHref="/browse?type=movie" />
        )}
        {popularTV.length > 0 && (
          <MediaRow title="📺 Serial Populer" items={popularTV.slice(0, 20)} viewAllHref="/browse?type=tv" />
        )}
        {trendingMovies.length > 0 && (
          <MediaRow title="🎥 Film Trending" items={trendingMovies.slice(0, 20)} viewAllHref="/browse?type=movie&sort=popularity.desc" />
        )}
        {topRatedMovies.length > 0 && (
          <MediaRow title="⭐ Film Rating Tertinggi" items={topRatedMovies.slice(0, 20)} viewAllHref="/browse?type=movie&sort=vote_average.desc" />
        )}
        {trendingTV.length > 0 && (
          <MediaRow title="📡 Serial Trending" items={trendingTV.slice(0, 20)} viewAllHref="/browse?type=tv&sort=popularity.desc" />
        )}

        {/* CTA */}
        <div className="relative overflow-hidden bg-gradient-to-r from-red-900/40 to-gray-900 border border-red-900/30 rounded-2xl p-8 sm:p-12 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent" />
          <div className="relative">
            <h2 className="text-white text-2xl sm:text-3xl font-bold mb-3">Nonton Bareng Teman?</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Buat Watch Party sekarang dan nikmati film favorit bersama teman-teman secara sinkron!
            </p>
            <a href="/watch-party" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-xl transition-colors">
              Mulai Watch Party
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
