"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Search, Menu, X, Film, LogOut, User, Bookmark, Users } from "lucide-react";

interface UserData {
  id: number;
  email: string;
  name: string;
}

export default function Navbar() {
  const [user, setUser] = useState<UserData | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUser();
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {}
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUserMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  }

  const navLinks = [
    { href: "/", label: "Beranda" },
    { href: "/browse?type=movie", label: "Film" },
    { href: "/browse?type=tv", label: "Serial" },
    { href: "/browse", label: "Jelajahi" },
  ];

  // Liquid glass: saat scroll, pakai backdrop-blur + glass border
  // Saat di atas halaman (belum scroll), transparan dengan gradient bawah
  const navBg = scrolled || menuOpen
    ? "bg-gray-950/60 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_32px_rgba(0,0,0,0.4)]"
    : "bg-gradient-to-b from-black/70 to-transparent";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
      {/* Glass shimmer line saat scrolled */}
      {scrolled && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/50">
              <Film className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              Catin<span className="text-red-500">Flix</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname?.startsWith(link.href.split("?")[0]));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-gray-300 hover:text-white hover:bg-white/8"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {/* Search */}
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center">
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari film, serial..."
                  className="bg-white/10 backdrop-blur-md text-white text-sm px-4 py-2 rounded-l-full border border-white/20 focus:outline-none focus:border-red-400/60 w-44 sm:w-60 placeholder-gray-400"
                />
                <button
                  type="submit"
                  className="bg-red-600 px-3 py-2 rounded-r-full hover:bg-red-500 transition-colors"
                >
                  <Search className="w-4 h-4 text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="ml-2 text-gray-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all"
                aria-label="Cari"
              >
                <Search className="w-5 h-5" />
              </button>
            )}

            {/* Auth */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-full transition-all"
                >
                  <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-white text-xs font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:block text-white text-sm font-medium max-w-24 truncate">
                    {user.name}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Glass top shimmer */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-white text-sm font-medium truncate">{user.name}</p>
                      <p className="text-gray-400 text-xs truncate">{user.email}</p>
                    </div>
                    {[
                      { href: "/profile", icon: User, label: "Profil" },
                      { href: "/watchlist", icon: Bookmark, label: "Watchlist" },
                      { href: "/watch-party", icon: Users, label: "Watch Party" },
                    ].map(({ href, icon: Icon, label }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/8 transition-colors text-sm"
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </Link>
                    ))}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-white/8 transition-colors text-sm border-t border-white/10"
                    >
                      <LogOut className="w-4 h-4" />
                      Keluar
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-gray-300 hover:text-white text-sm font-medium px-3 py-2 rounded-full hover:bg-white/10 transition-all"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all shadow-lg shadow-red-900/30"
                >
                  Daftar
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-gray-300 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all"
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-sm"
              >
                {link.label}
              </Link>
            ))}
            {!user && (
              <div className="flex gap-2 px-2 pt-2">
                <Link href="/login" className="flex-1 text-center py-2 border border-white/20 rounded-full text-gray-300 hover:text-white text-sm backdrop-blur-sm">
                  Masuk
                </Link>
                <Link href="/register" className="flex-1 text-center py-2 bg-red-600 rounded-full text-white text-sm hover:bg-red-500">
                  Daftar
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
