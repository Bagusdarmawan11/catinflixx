import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-gray-950 min-h-screen flex items-center justify-center pt-16">
      <div className="text-center px-4">
        <div className="text-8xl mb-6">🎬</div>
        <h1 className="text-white text-4xl font-bold mb-3">404</h1>
        <p className="text-gray-400 text-lg mb-2">Halaman Tidak Ditemukan</p>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          Maaf, halaman yang kamu cari tidak ada atau sudah dipindahkan.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-xl transition-colors"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
