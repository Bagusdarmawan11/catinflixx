"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaCard from "./MediaCard";

interface MediaItem {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseDate: string;
  voteAverage: number;
  overview?: string;
}

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  viewAllHref?: string;
  loading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="flex-none w-36 sm:w-44 space-y-2">
      <div className="aspect-[2/3] rounded-xl bg-gray-800 animate-pulse" />
      <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
      <div className="h-3 bg-gray-800 rounded animate-pulse w-1/2" />
    </div>
  );
}

export default function MediaRow({ title, items, viewAllHref, loading }: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = 400;
    scrollRef.current.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  }

  return (
    <section className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-white text-xl font-bold">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-red-500 hover:text-red-400 text-sm font-medium transition-colors flex items-center gap-1">
            Lihat Semua
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Scroll container */}
      <div className="relative group">
        {/* Left button */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-8 z-10 w-10 flex items-center justify-center bg-gradient-to-r from-gray-950 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Scroll kiri"
        >
          <div className="bg-black/60 hover:bg-black/80 p-2 rounded-full backdrop-blur-sm">
            <ChevronLeft className="w-5 h-5 text-white" />
          </div>
        </button>

        {/* Right button */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-8 z-10 w-10 flex items-center justify-center bg-gradient-to-l from-gray-950 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Scroll kanan"
        >
          <div className="bg-black/60 hover:bg-black/80 p-2 rounded-full backdrop-blur-sm">
            <ChevronRight className="w-5 h-5 text-white" />
          </div>
        </button>

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map((item) => (
                <div key={`${item.mediaType}-${item.id}`} className="flex-none w-36 sm:w-44">
                  <MediaCard {...item} />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
