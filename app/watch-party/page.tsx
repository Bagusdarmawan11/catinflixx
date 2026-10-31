"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Link2, Play, ArrowRight, Loader2, Film, Radio } from "lucide-react";
import { isValidVideoUrl, detectVideoType } from "@/lib/utils";

const VIDEO_EXAMPLES = [
  { label: "YouTube", placeholder: "https://www.youtube.com/watch?v=..." },
  { label: "HLS Stream", placeholder: "https://example.com/stream.m3u8" },
  { label: "Direct MP4", placeholder: "https://example.com/video.mp4" },
];

function VideoTypeHint({ url }: { url: string }) {
  if (!url.trim()) return null;
  const type = detectVideoType(url);
  const map: Record<string, { label: string; color: string }> = {
    youtube: { label: "YouTube", color: "text-red-400" },
    hls: { label: "HLS Stream", color: "text-blue-400" },
    direct: { label: "Video Langsung (MP4/WebM)", color: "text-green-400" },
    unknown: { label: "Format tidak dikenali", color: "text-yellow-400" },
  };
  const info = map[type];
  return (
    <p className={`text-xs mt-1 ${info.color}`}>
      Terdeteksi: {info.label}
      {type === "unknown" && " — coba URL YouTube, .m3u8, atau .mp4"}
    </p>
  );
}

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
    const trimmedUrl = videoUrl.trim();

    if (!trimmedUrl) {
      setCreateError("Masukkan URL video");
      return;
    }
    if (!isValidVideoUrl(trimmedUrl)) {
      setCreateError(
        "URL tidak dikenali. Gunakan link YouTube, file .m3u8, atau .mp4/.webm"
      );
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: trimmedUrl,
          videoTitle: videoTitle.trim() || "Watch Party",
        }),
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

      router.push(
        `/watch-party/${data.room.code}?host=1&videoUrl=${encodeURIComponent(trimmedUrl)}&videoTitle=${encodeURIComponent(videoTitle || "Watch Party")}`
      );
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
    if (code.length !== 6) {
      setJoinError("Kode room terdiri dari 6 karakter");
      return;
    }

    setJoining(true);
    setJoinError("");
    try {
      const res = await fetch(`/api/rooms/${code}`);
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
    <main className="bg-gray-950 min-h-screen pt-20 pb-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600/20 rounded-2xl mb-4">
            <Users className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-white text-3xl font-bold mb-2">Watch Party</h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Nonton bareng teman secara real-time. Dukung YouTube, HLS stream,
            dan video langsung (MP4/WebM).
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-900 rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === "create"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Buat Room
          </button>
          <button
            onClick={() => setTab("join")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === "join"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Gabung Room
          </button>
        </div>

        {/* Create Tab */}
        {tab === "create" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
              <Play className="w-5 h-5 text-purple-400" />
              Buat Room Baru
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 block">
                  URL Video <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => {
                    setVideoUrl(e.target.value);
                    setCreateError("");
                  }}
                  placeholder="https://www.youtube.com/watch?v=... atau stream.m3u8"
                  className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
                />
                <VideoTypeHint url={videoUrl} />

                {/* Format hints */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {VIDEO_EXAMPLES.map((ex) => (
                    <span
                      key={ex.label}
                      className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded"
                    >
                      {ex.label}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 block">
                  Judul Room (opsional)
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="mis. Film Sabtu Malam"
                  maxLength={100}
                  className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
                />
              </div>

              {createError && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-900/30 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {creating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Buat Room
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Info cards */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-gray-800">
              {[
                { icon: "▶️", label: "YouTube", desc: "Link video YouTube" },
                { icon: "📡", label: "HLS", desc: "Stream .m3u8" },
                { icon: "🎬", label: "Direct", desc: "File .mp4 / .webm" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-gray-800/60 rounded-lg p-3 text-center"
                >
                  <div className="text-xl mb-1">{item.icon}</div>
                  <p className="text-white text-xs font-medium">{item.label}</p>
                  <p className="text-gray-500 text-[10px] mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Join Tab */}
        {tab === "join" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-400" />
              Gabung Room
            </h2>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 block">
                  Kode Room (6 karakter)
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                    setJoinError("");
                  }}
                  placeholder="mis. AB3X9K"
                  maxLength={6}
                  className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600 tracking-[0.3em] text-center text-lg font-mono uppercase"
                />
              </div>

              {joinError && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-900/30 rounded-lg px-3 py-2">
                  {joinError}
                </p>
              )}

              <button
                type="submit"
                disabled={joining || joinCode.length !== 6}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {joining ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Gabung Sekarang
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-gray-600 text-xs text-center mt-5">
              Minta kode room dari teman yang sudah membuat room.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
