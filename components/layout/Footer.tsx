import Link from "next/link";
import { Film, Github, Twitter, Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800/50 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold text-xl">
                Catin<span className="text-red-500">Flix</span>
              </span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed">
              Platform streaming film dan serial dengan fitur Watch Party untuk nonton bareng teman-teman.
            </p>
            <div className="flex gap-3">
              <a href="#" className="text-gray-600 hover:text-gray-400 transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-400 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Jelajahi */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Jelajahi</h4>
            <ul className="space-y-2">
              {[
                { href: "/browse?type=movie", label: "Film" },
                { href: "/browse?type=tv", label: "Serial TV" },
                { href: "/browse", label: "Semua Konten" },
                { href: "/browse?sort=vote_average.desc", label: "Top Rating" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Akun */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Akun</h4>
            <ul className="space-y-2">
              {[
                { href: "/login", label: "Masuk" },
                { href: "/register", label: "Daftar" },
                { href: "/watchlist", label: "Watchlist" },
                { href: "/watch-party", label: "Watch Party" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
                    {item.label}
                  </Link>
                </li>
            ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Info</h4>
            <ul className="space-y-2">
              {[
                { href: "#", label: "Tentang Kami" },
                { href: "#", label: "Kebijakan Privasi" },
                { href: "#", label: "Syarat & Ketentuan" },
                { href: "#", label: "Hubungi Kami" },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800/50 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-600 text-sm">
            © 2024 CatinFlix. Data film disediakan oleh{" "}
            <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300">
              TMDB
            </a>
            .
          </p>
          <p className="text-gray-700 text-xs">
            Dibuat dengan ❤️ untuk penggemar film Indonesia
          </p>
        </div>
      </div>
    </footer>
  );
}
