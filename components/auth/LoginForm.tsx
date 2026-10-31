"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2, LogIn } from "lucide-react";

interface Props {
  redirectTo?: string;
}

export default function LoginForm({ redirectTo = "/browse" }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Email atau password salah");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      {/* Email */}
      <div>
        <label className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 block">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            required
            autoComplete="email"
            placeholder="nama@email.com"
            className="w-full bg-gray-800 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-red-500 transition-colors placeholder:text-gray-600"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 block">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full bg-gray-800 border border-gray-700 text-white pl-10 pr-10 py-3 rounded-xl focus:outline-none focus:border-red-500 transition-colors placeholder:text-gray-600"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-900/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !email.trim() || !password}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <LogIn className="w-4 h-4" />
            Masuk
          </>
        )}
      </button>

      <p className="text-center text-gray-500 text-sm">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="text-red-400 hover:text-red-300 font-medium"
        >
          Daftar sekarang
        </Link>
      </p>
    </form>
  );
}
