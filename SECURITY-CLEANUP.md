# 🔒 Security Fix & Cleanup Guide

## Langkah 1 — Hapus Folder Kosong dari Repo

Jalankan perintah ini di root project kamu:

```bash
# Hapus direktori kosong (tidak ada file di dalamnya, aman dihapus)
git rm -r --cached "app/(main)/" 2>/dev/null || rm -rf "app/(main)/"
git rm -r --cached "app/watch-party/[code]/" 2>/dev/null || rm -rf "app/watch-party/[code]/"
git rm -r --cached "app/api/watch-party/" 2>/dev/null || rm -rf "app/api/watch-party/"

# Buat ulang folder kosong tidak akan di-track git
# (git tidak track folder kosong, jadi cukup hapus saja)
```

Atau kalau lebih suka manual via File Explorer / VS Code, cukup hapus ketiga folder ini:
- `app/(main)/`
- `app/watch-party/[code]/`
- `app/api/watch-party/`

---

## Langkah 2 — Replace package.json

Copy file `package.json` dari zip ini ke root project, replace yang lama.

**Yang berubah:**
| Package | Sebelum | Sesudah |
|---------|---------|---------|
| `next` | `14.2.29` | `latest` ⬆️ |
| `postcss` | `^8` | `latest` ⬆️ |
| `eslint-config-next` | `14.2.29` | `latest` ⬆️ |
| `overrides.glob` | ❌ | `>=11.0.0` ✅ |
| `overrides.minimatch` | ❌ | `>=11.0.1` ✅ |
| `overrides.esbuild` | ❌ | `>=0.25.0` ✅ |
| `overrides.flat-cache` | ❌ | `>=6.0.0` ✅ |
| `overrides.file-entry-cache` | ❌ | `>=9.0.0` ✅ |

---

## Langkah 3 — Install ulang dependency

```bash
# Hapus node_modules dan lock file lama
rm -rf node_modules package-lock.json

# Install ulang dengan versi baru
npm install
```

---

## Langkah 4 — Test lokal dulu sebelum push

> ⚠️ Next.js mungkin naik ke versi 15 atau 16 yang punya sedikit breaking change.
> Wajib test dulu sebelum push ke production!

```bash
# Test build
npm run build

# Kalau build sukses, coba jalankan
npm run dev
```

Cek fitur-fitur utama:
- [ ] Login / Register
- [ ] Browse film
- [ ] Halaman detail film
- [ ] Watch Party (buat room, join, video sync)
- [ ] Profil (edit nama, ganti password)
- [ ] Watchlist

---

## Langkah 5 — Push ke GitHub

```bash
git add .
git commit -m "security: upgrade next & deps, fix vulnerabilities, cleanup empty dirs"
git push
```

---

## Vulnerabilities yang Diatasi

| Severity | Package | CVE/Issue | Status |
|----------|---------|-----------|--------|
| 🔴 CRITICAL | `next` | Cache poisoning, SSRF, RCE di image optimizer | ✅ Upgrade ke latest |
| 🟠 HIGH | `postcss` | Path traversal via sourceMappingURL | ✅ Upgrade ke latest |
| 🟠 HIGH | `glob` | Command injection via --cmd flag | ✅ Override >=11.0.0 |
| 🟠 HIGH | `eslint-config-next` | Terikat versi Next.js | ✅ Upgrade ke latest |
| 🟡 MODERATE | `esbuild` | Dev server request forgery | ✅ Override >=0.25.0 |
| 🟡 MODERATE | `minimatch` | DoS via globparts amplification | ✅ Override >=11.0.1 |
| 🟡 MODERATE | `flat-cache`/`file-entry-cache` | Path traversal | ✅ Override latest |
