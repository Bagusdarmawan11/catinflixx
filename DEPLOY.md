# Stage 7 – Watch Party: Cara Deploy

## File yang perlu di-copy ke repo kamu:

```
hooks/
  useWatchParty.ts          → hooks/useWatchParty.ts

components/watch-party/
  Chat.tsx                  → components/watch-party/Chat.tsx
  VideoPlayer.tsx           → components/watch-party/VideoPlayer.tsx

app/watch-party/
  page.tsx                  → app/watch-party/page.tsx

app/watch-party/[roomCode]/
  page.tsx                  → app/watch-party/[roomCode]/page.tsx

app/api/rooms/
  route.ts                  → app/api/rooms/route.ts

app/api/rooms/[code]/
  route.ts                  → app/api/rooms/[code]/route.ts

server/
  index.ts                  → server/index.ts  ← sudah ada dari sebelumnya
```

## Install dependencies baru:

```bash
npm install socket.io-client nanoid
```

## Environment variable di Render:

Tambahkan di Render Dashboard → Environment:
```
NEXT_PUBLIC_BASE_URL=https://namaapp.onrender.com
```

## Navbar — tambahkan link Watch Party:

Di `components/layout/Navbar.tsx`, tambahkan link:
```tsx
<Link href="/watch-party">Watch Party</Link>
```

## Push & Deploy:

```bash
git add .
git commit -m "feat: Stage 7 - Watch Party with Socket.IO"
git push
```

## Cara pakai:

1. Buka `/watch-party`
2. Klik "Buat Room" → masukkan URL YouTube → klik buat
3. Bagikan kode 6 huruf ke teman
4. Teman buka `/watch-party` → klik "Gabung Room" → masukkan kode
5. Host bisa play/pause/seek, semua penonton sync otomatis
6. Chat real-time tersedia di sidebar (desktop) atau bawah layar (mobile)
