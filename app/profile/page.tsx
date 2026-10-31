"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  User, Mail, Calendar, Bookmark, Users, Edit2, Loader2,
  Eye, EyeOff, Check, X, KeyRound,
} from "lucide-react";

interface UserData {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

type EditMode = "none" | "name" | "password";

// ─── Modal Edit Nama ──────────────────────────────────────────────────────────

function EditNameModal({
  current,
  onSave,
  onClose,
}: {
  current: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || trimmed === current) { onClose(); return; }
    if (trimmed.length < 2) { setError("Nama minimal 2 karakter"); return; }
    if (trimmed.length > 100) { setError("Nama maksimal 100 karakter"); return; }

    setLoading(true);
    setError("");
    try {
      await onSave(trimmed);
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-purple-400" />
            Ubah Nama
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 block">
              Nama Baru
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(""); }}
              maxLength={100}
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          {error && (
            <p className="text-red-400 text-xs bg-red-900/20 border border-red-900/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !value.trim() || value.trim() === current}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Simpan</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Ganti Password ─────────────────────────────────────────────────────

function EditPasswordModal({
  onSave,
  onClose,
}: {
  onSave: (currentPass: string, newPass: string) => Promise<void>;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) { setError("Masukkan password lama"); return; }
    if (newPassword.length < 6) { setError("Password baru minimal 6 karakter"); return; }
    if (newPassword !== confirmPassword) { setError("Konfirmasi password tidak cocok"); return; }
    if (newPassword === currentPassword) { setError("Password baru harus berbeda dari yang lama"); return; }

    setLoading(true);
    setError("");
    try {
      await onSave(currentPassword, newPassword);
    } catch (err: any) {
      setError(err.message || "Gagal mengganti password");
    } finally {
      setLoading(false);
    }
  }

  const strengthScore = newPassword.length >= 12 ? 3 : newPassword.length >= 8 ? 2 : newPassword.length >= 6 ? 1 : 0;
  const strengthLabel = ["", "Lemah", "Sedang", "Kuat"][strengthScore];
  const strengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-green-500"][strengthScore];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-purple-400" />
            Ganti Password
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password lama */}
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 block">
              Password Lama
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setError(""); }}
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 pr-10 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password baru */}
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 block">
              Password Baru
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 pr-10 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Strength indicator */}
            {newPassword && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strengthScore ? strengthColor : "bg-gray-700"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-500">{strengthLabel}</span>
              </div>
            )}
          </div>

          {/* Konfirmasi */}
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 block">
              Konfirmasi Password Baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
              className={`w-full bg-gray-800 border text-white px-4 py-3 rounded-xl focus:outline-none transition-colors ${
                confirmPassword && confirmPassword !== newPassword
                  ? "border-red-500 focus:border-red-500"
                  : "border-gray-700 focus:border-purple-500"
              }`}
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-900/20 border border-red-900/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Simpan</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [successMsg, setSuccessMsg] = useState("");

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

  async function handleSaveName(name: string) {
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Gagal menyimpan");
    setUser(data.user);
    setEditMode("none");
    showSuccess("Nama berhasil diperbarui!");
  }

  async function handleSavePassword(currentPassword: string, newPassword: string) {
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Gagal mengganti password");
    setEditMode("none");
    showSuccess("Password berhasil diperbarui!");
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

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

  return (
    <main className="bg-gray-950 min-h-screen pt-20 pb-16">
      {/* Edit modals */}
      {editMode === "name" && (
        <EditNameModal
          current={user.name}
          onSave={handleSaveName}
          onClose={() => setEditMode("none")}
        />
      )}
      {editMode === "password" && (
        <EditPasswordModal
          onSave={handleSavePassword}
          onClose={() => setEditMode("none")}
        />
      )}

      <div className="max-w-2xl mx-auto px-4">
        {/* Success toast */}
        {successMsg && (
          <div className="mb-4 flex items-center gap-2 bg-green-900/30 border border-green-700/40 text-green-300 rounded-xl px-4 py-3 text-sm">
            <Check className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Header avatar */}
        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-red-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold select-none">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold">{user.name}</h1>
            <p className="text-gray-400 text-sm">{user.email}</p>
            <p className="text-gray-600 text-xs mt-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Bergabung {joinDate}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link
            href="/watchlist"
            className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 flex items-center gap-3 transition-colors group"
          >
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <Bookmark className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">{watchlistCount}</p>
              <p className="text-gray-500 text-xs">Watchlist</p>
            </div>
          </Link>
          <Link
            href="/watch-party"
            className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 flex items-center gap-3 transition-colors group"
          >
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Party</p>
              <p className="text-gray-500 text-xs">Watch Party</p>
            </div>
          </Link>
        </div>

        {/* Info akun */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold text-sm">Informasi Akun</h2>
          </div>

          {/* Nama */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-gray-500 text-xs">Nama</p>
                <p className="text-white text-sm font-medium">{user.name}</p>
              </div>
            </div>
            <button
              onClick={() => setEditMode("name")}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-600/10 hover:bg-purple-600/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              Ubah
            </button>
          </div>

          {/* Email */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800/60">
            <Mail className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-gray-500 text-xs">Email</p>
              <p className="text-white text-sm font-medium">{user.email}</p>
            </div>
          </div>

          {/* Password */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <KeyRound className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-gray-500 text-xs">Password</p>
                <p className="text-white text-sm font-medium tracking-widest">••••••••</p>
              </div>
            </div>
            <button
              onClick={() => setEditMode("password")}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-600/10 hover:bg-purple-600/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              Ganti
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl px-5 py-4">
          <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Sesi</h3>
          <Link
            href="/api/auth/logout"
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors"
          >
            Keluar dari akun
          </Link>
        </div>
      </div>
    </main>
  );
}
