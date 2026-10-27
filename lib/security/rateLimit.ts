/**
 * In-memory rate limiter — tidak perlu Redis untuk free tier.
 * Auto-cleanup setiap 10 menit agar tidak bocor memori.
 */

interface RateLimitEntry {
  count: number;
  firstRequestAt: number;
  blockedUntil?: number; // ms timestamp, jika sedang di-block
}

const store = new Map<string, RateLimitEntry>();

// Cleanup entri lama setiap 10 menit
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    const expired =
      entry.blockedUntil
        ? now > entry.blockedUntil + 60_000 // 1 menit setelah block berakhir
        : now - entry.firstRequestAt > 15 * 60_000; // 15 menit window
    if (expired) store.delete(key);
  });
}, 10 * 60_000);

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Check apakah request diizinkan.
 *
 * @param key       - identifier unik, misal: "login:ip" atau "login:email"
 * @param maxRequests - maksimum request dalam window
 * @param windowMs  - durasi window dalam ms
 * @param blockMs   - durasi block setelah melewati limit (default = windowMs)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  blockMs?: number
): RateLimitResult {
  const now = Date.now();
  const block = blockMs ?? windowMs;

  let entry = store.get(key);

  // Sudah di-block?
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // Reset jika window sudah habis
  if (!entry || now - entry.firstRequestAt > windowMs) {
    entry = { count: 0, firstRequestAt: now };
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    entry.blockedUntil = now + block;
    store.set(key, entry);
    return { allowed: false, retryAfterSeconds: Math.ceil(block / 1000) };
  }

  store.set(key, entry);
  return { allowed: true };
}

/**
 * Reset entri (misal: setelah login berhasil)
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
