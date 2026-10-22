"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Link2, Play, ArrowRight, Loader2 } from "lucide-react";

export default function WatchPartyPage() {
  const router = useRouter();

  // Create tab
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Join tab
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  const [tab, setTab] = useState<"create" | "join">("create");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!videoUrl.trim()) {
      setCreateError("Masukkan URL video YouTube");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoUrl.trim(), videoTitle: videoTitle.trim() || "Watch Party" }),
      });
      if (res.status === 401) {
        router.push("/login?next=/watch-party");
        return;
      }
      const data = await res.json();
      if (!data.success) {
        setCreateError(data.error || "Gagal membuat room");
        setCreating(false);
        return;
      }
      router.push(`/watch-party/${data.room.code}?host=1&videoUrl=${encodeURIComponent(videoUrl)}&videoTitle=${encodeURIComponent(videoTitle || "Watch Party")}`);
    } catch {
      setCreateError("Terjadi kesalahan. Coba lagi.");
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError("Masukkan kode room");
      return;
    }
    setJoining(true);
    setJoinError("");
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (res.status === 404) {
        setJoinError("Room tidak ditemukan. Periksa kode lagi.");
        setJoining(false);
        return;
      }
      if (res.status === 401) {
        router.push("/login?next=/watch-party");
        return;
      }
      const data = await res.json();
      if (!data.success) {
        setJoinError(data.error || "Room tidak ditemukan");
        setJoining(false);
        return;
      }
      router.push(`/watch-party/${code}`);
    } catch {
      setJoinError("Terjadi kesalahan. Coba lagi.");
      setJoining(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 mb-4">
            <Users className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Watch Party</h1>
          <p className="text-gray-400">Nonton bareng teman secara real-time. Sinkron sempurna.</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-xl bg-gray-900 p-1 mb-6 border border-white/10">
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              tab === "create"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Buat Room
          </button>
          <button
            onClick={() => setTab("join")}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              tab === "join"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Gabung Room
          </button>
        </div>

        {/* Create Form */}
        {tab === "create" && (
          <form onSubmit={handleCreate} className="bg-gray-900 rounded-2xl border border-white/10 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <span className="flex items-center gap-2"><Link2 className="w-4 h-4" /> URL Video YouTube</span>
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <span className="flex items-center gap-2"><Play className="w-4 h-4" /> Judul Video (opsional)</span>
              </label>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Contoh: Avengers: Endgame"
                maxLength={100}
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>
            {createError && (
              <p className="text-red-400 text-sm">{createError}</p>
            )}
            <button
              type="submit"
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              {creating ? "Membuat room..." : "Buat Room"}
            </button>
            <p className="text-xs text-gray-500 text-center">
              Kamu akan menjadi host. Bagikan kode room ke temanmu.
            </p>
          </form>
        )}

        {/* Join Form */}
        {tab === "join" && (
          <form onSubmit={handleJoin} className="bg-gray-900 rounded-2xl border border-white/10 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Kode Room
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Contoh: A3K9XZ"
                maxLength={6}
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm text-center text-xl tracking-[0.3em] uppercase font-mono"
              />
            </div>
            {joinError && (
              <p className="text-red-400 text-sm">{joinError}</p>
            )}
            <button
              type="submit"
              disabled={joining}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
              {joining ? "Bergabung..." : "Gabung Room"}
            </button>
            <p className="text-xs text-gray-500 text-center">
              Minta kode 6 karakter dari host room.
            </p>
          </form>
        )}

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          {[
            { icon: "🎬", label: "Sinkron Real-time" },
            { icon: "💬", label: "Live Chat" },
            { icon: "🎮", label: "Host Kontrol" },
          ].map((f) => (
            <div key={f.label} className="text-center bg-gray-900/60 border border-white/5 rounded-xl py-3 px-2">
              <div className="text-2xl mb-1">{f.icon}</div>
              <p className="text-xs text-gray-400">{f.label}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
