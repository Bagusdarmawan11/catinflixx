"use client";

import { useState, useEffect } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

interface Props {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
}

export default function WatchlistButton({ tmdbId, mediaType, title, posterPath }: Props) {
  const [inList, setInList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/watchlist");
        if (res.ok) {
          const data = await res.json();
          const found = (data.items || []).some(
            (i: any) => i.tmdbId === tmdbId && i.mediaType === mediaType
          );
          setInList(found);
        }
      } catch {}
      setLoading(false);
    }
    check();
  }, [tmdbId, mediaType]);

  async function toggle() {
    if (submitting) return;
    setSubmitting(true);
    const optimistic = !inList;
    setInList(optimistic);

    try {
      const method = inList ? "DELETE" : "POST";
      const res = await fetch("/api/watchlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, mediaType, title, posterPath }),
      });
      if (res.status === 401) {
        setInList(!optimistic);
        window.location.href = "/login";
        return;
      }
      if (!res.ok) setInList(!optimistic);
    } catch {
      setInList(!optimistic);
    }
    setSubmitting(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading || submitting}
      className={`flex items-center gap-2 font-semibold px-5 py-3 rounded-xl transition-all disabled:opacity-60 ${
        inList
          ? "bg-red-600 hover:bg-red-700 text-white"
          : "bg-gray-800 hover:bg-gray-700 text-white"
      }`}
    >
      {loading || submitting ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : inList ? (
        <BookmarkCheck className="w-5 h-5" />
      ) : (
        <Bookmark className="w-5 h-5" />
      )}
      {inList ? "Di Watchlist" : "Watchlist"}
    </button>
  );
}
