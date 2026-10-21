"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Info, Star, ChevronLeft, ChevronRight } from "lucide-react";

interface HeroItem {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  releaseDate: string;
  voteAverage: number;
  genreIds: number[];
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export default function HeroBanner({ items }: { items: HeroItem[] }) {
  const [current, setCurrent] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const goTo = useCallback(
    (idx: number) => {
      if (transitioning || idx === current) return;
      setTransitioning(true);
      setTimeout(() => {
        setCurrent(idx);
        setTransitioning(false);
      }, 300);
    },
    [current, transitioning]
  );

  const next = useCallback(() => goTo((current + 1) % items.length), [current, goTo, items.length]);
  const prev = useCallback(
    () => goTo((current - 1 + items.length) % items.length),
    [current, goTo, items.length]
  );

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(next, 8000);
    return () => clearInterval(timer);
  }, [next, items.length]);

  if (!items || items.length === 0) return null;

  const item = items[current];
  const backdropUrl = item.backdropPath
    ? `${TMDB_IMAGE_BASE}/original${item.backdropPath}`
    : null;
  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : "";

  return (
    <div className="relative w-full h-[75vh] min-h-[500px] overflow-hidden bg-gray-950">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          transitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        {backdropUrl ? (
          <Image
            src={backdropUrl}
            alt={item.title}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="w-full h-full bg-gray-900" />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div
        className={`relative z-10 h-full flex items-end pb-20 transition-opacity duration-500 ${
          transitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
          <div className="max-w-2xl">
            {/* Type badge */}
            <span
              className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${
                item.mediaType === "tv"
                  ? "bg-blue-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {item.mediaType === "tv" ? "Serial" : "Film"}
            </span>

            {/* Title */}
            <h1 className="text-white text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-3 drop-shadow-lg">
              {item.title}
            </h1>

            {/* Meta */}
            <div className="flex items-center gap-4 mb-4">
              {item.voteAverage > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-yellow-400 font-semibold">
                    {item.voteAverage.toFixed(1)}
                  </span>
                </div>
              )}
              {year && <span className="text-gray-300 text-sm">{year}</span>}
            </div>

            {/* Overview */}
            <p className="text-gray-300 text-sm sm:text-base line-clamp-3 mb-6 leading-relaxed">
              {item.overview}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/movie/${item.id}?type=${item.mediaType}`}
                className="flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-bold px-6 py-3 rounded-xl transition-colors"
              >
                <Play className="w-5 h-5 fill-gray-900" />
                Tonton Sekarang
              </Link>
              <Link
                href={`/movie/${item.id}?type=${item.mediaType}`}
                className="flex items-center gap-2 bg-gray-600/70 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors backdrop-blur-sm"
              >
                <Info className="w-5 h-5" />
                Info Detail
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-3 rounded-full transition-colors backdrop-blur-sm"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-3 rounded-full transition-colors backdrop-blur-sm"
            aria-label="Berikutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {items.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`transition-all duration-300 rounded-full ${
                i === current
                  ? "bg-white w-6 h-2"
                  : "bg-gray-500 hover:bg-gray-400 w-2 h-2"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
