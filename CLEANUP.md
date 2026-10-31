# 🧹 Cleanup — Direktori & File yang Perlu Dihapus

Setelah mengapply semua file dari update ini, hapus direktori berikut
karena sudah tidak digunakan (empty route group & duplikat routes):

## Hapus Direktori Kosong

```bash
# Route group (main) yang tidak punya layout & isinya kosong
rm -rf app/(main)/

# Duplikat route watch-party dengan nama param berbeda [code] vs [roomCode]
rm -rf app/watch-party/[code]/

# API route watch-party stub yang tidak diimplementasi
rm -rf app/api/watch-party/
```

> **Catatan:** Route yang aktif dan berisi kode berada di:
> - `app/browse/page.tsx`
> - `app/movie/[id]/page.tsx`
> - `app/watch-party/[roomCode]/page.tsx`  ← pakai ini
> - `app/watchlist/page.tsx`
> - `app/api/rooms/` ← dipakai untuk Watch Party

---

## Setelah Apply Update — Jalankan Ini

```bash
# 1. Install dependency baru (hls.js untuk video player)
npm install hls.js
npm install -D @types/hls.js

# 2. Push schema baru ke database (tambah tabel watch_party_rooms)
npm run db:push

# 3. Build dan deploy
npm run build
```

---

## Ringkasan Perubahan

| File | Aksi |
|------|------|
| `lib/db/schema.ts` | ✅ Tambah tabel `watch_party_rooms` |
| `lib/utils/index.ts` | ✅ Baru — utility functions |
| `lib/validations/index.ts` | ✅ Baru — Zod schemas |
| `components/auth/LoginForm.tsx` | ✅ Baru — reusable login form |
| `components/auth/RegisterForm.tsx` | ✅ Baru — reusable register form |
| `components/watch-party/VideoPlayer.tsx` | ✅ Update — support HLS + MP4 |
| `app/watch-party/page.tsx` | ✅ Update — terima semua URL |
| `app/api/auth/me/route.ts` | ✅ Update — tambah PATCH |
| `app/profile/page.tsx` | ✅ Update — edit nama & password |
| `app/api/rooms/route.ts` | ✅ Update — gunakan DB |
| `app/api/rooms/[code]/route.ts` | ✅ Update — DB + in-memory |
| `server/index.ts` | ✅ Update — load rooms dari DB |
| `server/socket/watchPartyHandlers.ts` | ✅ Cleanup — hapus duplikat handler |
| `app/(main)/` | ❌ Hapus (kosong) |
| `app/watch-party/[code]/` | ❌ Hapus (duplikat) |
| `app/api/watch-party/` | ❌ Hapus (stub kosong) |
