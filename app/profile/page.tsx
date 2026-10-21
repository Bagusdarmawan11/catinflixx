"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { User, Mail, Calendar, Bookmark, Users, Edit2, Loader2 } from "lucide-react";

interface UserData {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, wlRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/watchlist"),
        ]);

        if (meRes.status === 401) {
          window.location.href = "/login?redirect=/profile";
          return;
        }

        if (meRes.ok) {
          const data = await meRes.json();
          setUser(data.user);
        }

        if (wlRes.ok) {
          const wlData = await wlRes.json();
          setWatchlistCount((wlData.items || []).length);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <main className="bg-gray-950 min-h-screen pt-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </main>
    );
  }

  if (!user) return null;

  const joinDate = new Date(user.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="bg-gray-950 min-h-screen pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Profile card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
          {/* Cover */}
          <div className="h-28 bg-gradient-to-r from-red-900/50 via-gray-800 to-gray-900" />

          {/* Avatar + info */}
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-10 mb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl border-4 border-gray-900 flex items-center justify-center shadow-xl flex-shrink-0">
                <span className="text-white text-2xl font-bold">{initials}</span>
              </div>
              <div className="pb-1">
                <h1 className="text-white text-xl font-bold">{user.name}</h1>
                <p className="text-gray-400 text-sm">{user.email}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Link
                href="/watchlist"
                className="bg-gray-800/60 hover:bg-gray-800 border border-gray-700 rounded-xl p-4 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-600/20 rounded-lg flex items-center justify-center">
                    <Bookmark className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">{watchlistCount}</p>
                    <p className="text-gray-500 text-xs">Film di Watchlist</p>
                  </div>
                </div>
              </Link>
              <Link
                href="/watch-party"
                className="bg-gray-800/60 hover:bg-gray-800 border border-gray-700 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">—</p>
                    <p className="text-gray-500 text-xs">Watch Party</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold mb-2">Informasi Akun</h2>

          {[
            { icon: User, label: "Nama Lengkap", value: user.name },
            { icon: Mail, label: "Email", value: user.email },
            { icon: Calendar, label: "Bergabung", value: joinDate },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 py-3 border-b border-gray-800 last:border-0">
              <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-500 text-xs mb-0.5">{label}</p>
                <p className="text-white text-sm font-medium truncate">{value}</p>
              </div>
            </div>
          ))}

          <button
            disabled
            className="w-full flex items-center justify-center gap-2 bg-gray-800 text-gray-500 cursor-not-allowed px-4 py-3 rounded-xl text-sm font-medium mt-2"
            title="Segera hadir"
          >
            <Edit2 className="w-4 h-4" />
            Edit Profil (Segera Hadir)
          </button>
        </div>

        {/* Quick links */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href="/watchlist"
            className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <Bookmark className="w-5 h-5 text-red-500" />
            <span className="text-white text-sm font-medium">Lihat Watchlist</span>
          </Link>
          <Link
            href="/browse"
            className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <span className="text-xl">🎬</span>
            <span className="text-white text-sm font-medium">Jelajahi Film</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
