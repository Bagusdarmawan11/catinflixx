import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="bg-gray-950 min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="text-center max-w-lg w-full">

        {/* Animated film reel decoration */}
        <div className="relative mx-auto w-40 h-40 mb-8 select-none">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-gray-800 animate-spin"
               style={{ animationDuration: "12s" }}>
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <div
                key={deg}
                className="absolute w-3 h-3 bg-gray-700 rounded-full"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: `rotate(${deg}deg) translateX(64px) translate(-50%, -50%)`,
                }}
              />
            ))}
          </div>

          {/* Inner circle */}
          <div className="absolute inset-6 rounded-full border-4 border-gray-800 bg-gray-900 flex items-center justify-center">
            <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-orange-400 leading-none">
              404
            </span>
          </div>
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="CatinFlix" width={160} height={64} className="h-10 w-auto object-contain opacity-70" />
        </div>

        <h1 className="text-white text-2xl sm:text-3xl font-bold mb-3">
          Halaman Tidak Ditemukan
        </h1>
        <p className="text-gray-500 text-sm sm:text-base mb-8 leading-relaxed">
          Sepertinya film yang kamu cari sudah habis masa tayangnya,<br className="hidden sm:block" />
          atau URL yang kamu masukkan tidak tersedia.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            🏠 Kembali ke Beranda
          </Link>
          <Link
            href="/browse"
            className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            🎬 Jelajahi Film
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-10 pt-8 border-t border-gray-800">
          <p className="text-gray-600 text-xs mb-3 uppercase tracking-wider">Halaman populer</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { href: "/browse?type=movie",                label: "Film" },
              { href: "/browse?type=tv",                   label: "Serial TV" },
              { href: "/browse?sort=vote_average.desc",    label: "Top Rating" },
              { href: "/watch-party",                      label: "Watch Party" },
              { href: "/watchlist",                        label: "Watchlist" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
