import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Reset semua entries sebelum tiap test dengan reset key berbeda
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mengizinkan request dalam batas limit", () => {
    const key = `test:allow:${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(key, 5, 60_000);
      expect(result.allowed).toBe(true);
    }
  });

  it("menolak request setelah melewati limit", () => {
    const key = `test:block:${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("mengembalikan retryAfterSeconds saat di-block", () => {
    const key = `test:retry:${Date.now()}`;
    for (let i = 0; i <= 3; i++) {
      checkRateLimit(key, 3, 60_000, 30_000);
    }
    const result = checkRateLimit(key, 3, 60_000, 30_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(30);
  });

  it("mengizinkan request setelah window habis", () => {
    const key = `test:window:${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 1_000);
    }
    // Maju waktu 1.1 detik agar window reset
    vi.advanceTimersByTime(1_100);
    const result = checkRateLimit(key, 3, 1_000);
    expect(result.allowed).toBe(true);
  });

  it("resetRateLimit membersihkan block", () => {
    const key = `test:reset:${Date.now()}`;
    for (let i = 0; i <= 3; i++) {
      checkRateLimit(key, 3, 60_000);
    }
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(false);

    resetRateLimit(key);

    const result = checkRateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("key yang berbeda independen satu sama lain", () => {
    const key1 = `test:independent:a:${Date.now()}`;
    const key2 = `test:independent:b:${Date.now()}`;

    for (let i = 0; i <= 3; i++) {
      checkRateLimit(key1, 3, 60_000);
    }
    // key1 sudah di-block, key2 harus masih boleh
    expect(checkRateLimit(key1, 3, 60_000).allowed).toBe(false);
    expect(checkRateLimit(key2, 3, 60_000).allowed).toBe(true);
  });
});
