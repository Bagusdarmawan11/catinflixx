# Database Setup — CatinFlix

## Prasyarat
- Akun Neon di [console.neon.tech](https://console.neon.tech)
- `DATABASE_URL` tersedia di environment

## Skema Tabel

| Tabel | Deskripsi |
|-------|-----------|
| `users` | Akun pengguna — email, name, password hash |
| `watchlist` | Daftar tontonan per pengguna — tmdb_id, media_type |
| `watch_rooms` | Ruang Watch Party — invite_code, host, state pemutaran |
| `room_members` | Keanggotaan ruang Watch Party |

## Setup Awal (jalankan sekali)

### 1. Push schema ke Neon
```bash
DATABASE_URL="postgresql://..." npm run db:push
```

`db:push` langsung mendorong schema ke database **tanpa file migrasi**.
Cocok untuk development awal dan tahap ini.

### 2. Membuat file migrasi (opsional, untuk production tracking)
```bash
DATABASE_URL="postgresql://..." npm run db:generate
DATABASE_URL="postgresql://..." npm run db:migrate
```

## Cara update schema
1. Edit `lib/db/schema.ts`
2. Jalankan `npm run db:push` (development) atau `npm run db:generate` lalu `npm run db:migrate` (production)

## Connection URL

Gunakan **pooler URL** dari Neon untuk Next.js (bukan direct connection):
```
postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
```

## Indeks yang dibuat

- `users`: unique index pada `email`
- `watchlist`: unique composite index pada `(user_id, tmdb_id, media_type)` — mencegah duplikasi
- `watch_rooms`: unique index pada `invite_code`, index pada `expires_at`
- `room_members`: unique composite index pada `(room_id, user_id)`
