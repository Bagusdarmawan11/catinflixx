# 🎬 CatinFlix

Platform katalog dan streaming film modern dengan fitur **Watch Party** — nonton film bareng secara real-time bersama teman-teman.

**Live demo:** [https://catinflixx.onrender.com](https://catinflixx.onrender.com)

---

## ✨ Fitur Utama

- **Katalog Film & Serial** — Browse film populer, drakor, dracin, film Indonesia, Hollywood, dan lainnya via TMDB API
- **Pencarian & Filter** — Cari judul, filter genre, negara, tahun, dan rating
- **Detail Film** — Poster, sinopsis, rating, trailer YouTube, cast, dan metadata lengkap
- **Autentikasi** — Register, login, logout, manajemen sesi dengan JWT httpOnly cookie
- **Watchlist** — Simpan film favorit ke daftar tontonan pribadi
- **Watch Party** — Buat atau gabung room menonton bersama dengan sinkronisasi play/pause real-time, chat, dan video call
- **Responsif** — Tampilan optimal di desktop dan mobile

---

## 🛠️ Tech Stack

| Kategori | Teknologi |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Server | Node.js custom server + Socket.IO |
| Database | Neon PostgreSQL (serverless) |
| ORM | Drizzle ORM |
| Auth | JWT (jose) + bcrypt |
| UI | Tailwind CSS + Radix UI |
| API Film | TMDB API |
| Testing | Vitest (unit) + Playwright (E2E) |
| Deploy | Render (Web Service) |

---

## 🚀 Setup Lokal

### Prasyarat

- Node.js v22+
- npm v10+
- Akun [Neon](https://neon.tech) (database)
- Akun [TMDB](https://www.themoviedb.org/settings/api) (API film)

### Langkah-langkah

**1. Clone repository**

```bash
git clone https://github.com/USERNAME/catinflixx.git
cd catinflixx
```

**2. Install dependencies**

```bash
npm install
```

**3. Buat file environment**

```bash
cp .env.example .env.local
```

Isi `.env.local` dengan nilai yang sebenarnya (lihat bagian [Environment Variables](#-environment-variables) di bawah).

**4. Setup database**

Jalankan migrasi untuk membuat semua tabel di Neon:

```bash
npm run db:push
```

**5. Jalankan development server**

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## 🔑 Environment Variables

Buat file `.env.local` dari `.env.example` dan isi semua variabel berikut:

| Variabel | Keterangan | Cara mendapatkan |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | [console.neon.tech](https://console.neon.tech) → Connection string (pooler) |
| `JWT_SECRET` | Secret key JWT minimal 32 karakter | `openssl rand -hex 32` |
| `TMDB_API_TOKEN` | TMDB API Read Access Token (Bearer) | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| `NEXT_PUBLIC_APP_URL` | URL aplikasi (tanpa trailing slash) | `http://localhost:3000` untuk lokal |
| `NEXT_PUBLIC_SOCKET_URL` | URL Socket.IO server | Sama dengan `APP_URL` |
| `NODE_ENV` | Environment (`development` / `production`) | Set otomatis saat deploy |
| `PORT` | Port server (default: 3000) | `3000` |

> ⚠️ **Jangan pernah commit `.env.local` ke GitHub.** File ini sudah ada di `.gitignore`.

---

## 📦 Script NPM

```bash
npm run dev          # Jalankan development server
npm run build        # Build production
npm run start        # Jalankan production server
npm run type-check   # Cek TypeScript tanpa build
npm test             # Jalankan semua unit test (Vitest)
npm run test:watch   # Unit test mode watch
npm run test:e2e     # Jalankan E2E test (Playwright)
npm run db:push      # Push schema ke database Neon
npm run db:studio    # Buka Drizzle Studio (GUI database)
```

---

## 🗄️ Arsitektur Database

Tabel-tabel di Neon PostgreSQL:

```
users          — Akun pengguna (id, name, email, password_hash, created_at)
watchlist      — Daftar tontonan per user (tmdb_id, media_type, title, poster_path)
watch_rooms    — Room Watch Party (code, host_id, video_url, status, expires_at)
room_members   — Keanggotaan room (room_id, user_id, joined_at)
room_messages  — Pesan chat di dalam room (room_id, user_id, message, created_at)
```

---

## 🏗️ Struktur Proyek

```
catinflixx/
├── app/                    # Next.js App Router
│   ├── (main)/             # Route group dengan layout utama
│   │   ├── browse/         # Halaman katalog
│   │   ├── movie/[id]/     # Halaman detail film
│   │   ├── watch-party/    # Halaman Watch Party
│   │   └── watchlist/      # Daftar tontonan
│   ├── api/                # API Routes
│   │   ├── auth/           # Register, login, logout, me
│   │   ├── movies/         # Trending, search, detail, genres, discover
│   │   ├── rooms/          # Watch Party room management
│   │   ├── watchlist/      # Watchlist CRUD
│   │   └── health/         # Health check endpoint
│   └── profile/            # Halaman profil user
├── components/
│   ├── layout/             # Navbar, Footer
│   ├── movie/              # HeroBanner, MediaCard, MediaRow, MediaGrid
│   └── watch-party/        # VideoPlayer, Chat, VideoCall
├── hooks/                  # useWatchParty, useVideoCall
├── lib/
│   ├── auth/               # jwt.ts, password.ts
│   ├── db/                 # schema.ts, index.ts, migrate.ts
│   ├── security/           # rateLimit.ts, headers.ts
│   └── tmdb/               # client.ts
├── server/
│   └── index.ts            # Custom Node.js server + Socket.IO
├── __tests__/              # Unit test (Vitest)
├── e2e/                    # E2E test (Playwright)
├── .env.example            # Template environment variables
├── render.yaml             # Konfigurasi deploy Render
└── vitest.config.ts        # Konfigurasi test
```

---

## 🌐 Deploy ke Render

### 1. Push ke GitHub

```bash
git add .
git commit -m "feat: production ready"
git push origin main
```

### 2. Buat Web Service di Render

1. Login ke [render.com](https://render.com)
2. New → **Web Service** → Connect GitHub repo
3. Isi konfigurasi:

| Setting | Value |
|---|---|
| Runtime | Node |
| Region | Singapore |
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start` |

4. Tambahkan **Environment Variables** di Render Dashboard:

```
DATABASE_URL        = [Neon connection string (pooler)]
JWT_SECRET          = [output dari: openssl rand -hex 32]
TMDB_API_TOKEN      = [Bearer token dari TMDB]
NEXT_PUBLIC_APP_URL = https://NAMA-APP.onrender.com
NEXT_PUBLIC_SOCKET_URL = https://NAMA-APP.onrender.com
NODE_ENV            = production
PORT                = 3000
```

5. Klik **Deploy** — Render akan build dan deploy otomatis.

### 3. Setup database setelah deploy pertama

Setelah deploy berhasil, jalankan migrasi sekali dari lokal dengan `DATABASE_URL` production:

```bash
DATABASE_URL="postgresql://..." npm run db:push
```

### Health Check

Setelah deploy, verifikasi dengan membuka:
```
https://NAMA-APP.onrender.com/api/health
```

Response yang diharapkan:
```json
{"status":"ok","app":"CatinFlix","timestamp":"..."}
```

> ℹ️ **Render free tier** akan sleep setelah 15 menit tidak ada aktivitas. Request pertama setelah sleep membutuhkan waktu ~30 detik untuk wake up.

---

## 🧪 Testing

### Unit Test (Vitest)

```bash
npm test
```

Coverage: 8 test file, 59 test case — auth, TMDB client, watchlist API, rate limiter, security headers, database schema.

### E2E Test (Playwright)

```bash
# Install browser Playwright (sekali)
npx playwright install chromium

# Jalankan E2E test (butuh server berjalan)
npm run test:e2e
```

E2E test mencakup: alur register/login/logout, browse katalog, tambah watchlist, dan Watch Party.

---

## 🔒 Keamanan

- Password di-hash dengan **bcrypt** (10 rounds) — tidak pernah disimpan plaintext
- Session via **JWT httpOnly cookie** — tidak accessible dari JavaScript
- **Rate limiting** di endpoint login (10x/15min per IP, 5x/15min per email) dan register (5x/jam per IP)
- **HTTP Security Headers** di semua response: X-Frame-Options, CSP, HSTS, X-Content-Type-Options
- **Chat spam throttle** di Socket.IO (cooldown 1 detik per koneksi)
- Validasi input di server — tidak mengandalkan validasi frontend
- Isolasi data antar user dan antar room Watch Party

---

## 📄 Lisensi

MIT License — bebas digunakan untuk keperluan pribadi dan edukasi.

---

*Dibuat sebagai proyek full-stack — Next.js, Socket.IO, Neon PostgreSQL, dan TMDB API.*
