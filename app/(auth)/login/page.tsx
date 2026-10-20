"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Email
        </label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="kamu@email.com"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Password
        </label>
        <input
          type="password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="••••••••"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
      >
        {loading ? "Masuk..." : "Masuk"}
      </button>

      <p className="text-center text-zinc-400 text-sm">
        Belum punya akun?{" "}
        <Link href="/register" className="text-red-400 hover:text-red-300 font-medium">
          Daftar sekarang
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Catin<span className="text-red-500">Flix</span>
          </h1>
          <p className="text-zinc-400 mt-2">Masuk ke akunmu</p>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
          <Suspense fallback={<div className="text-zinc-400 text-sm text-center">Memuat...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
