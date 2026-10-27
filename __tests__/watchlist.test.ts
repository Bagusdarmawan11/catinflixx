/**
 * Unit test untuk logika watchlist.
 *
 * Karena route handler memakai `cookies()` dari next/headers dan Drizzle DB,
 * kita mock keduanya agar test berjalan tanpa infrastruktur nyata.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock next/headers ──────────────────────────────────────────────────────────
const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => ({ get: mockCookieGet }),
}));

// ── Mock JWT ───────────────────────────────────────────────────────────────────
const mockVerifyToken = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

// ── Mock Drizzle DB ────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockDbSelect(),
    insert: () => ({ values: mockDbInsert }),
    delete: () => ({ where: mockDbDelete }),
  },
}));

// ── Import route setelah mock siap ────────────────────────────────────────────
const { GET, POST, DELETE } = await import("@/app/api/watchlist/route");

// ── Helpers ───────────────────────────────────────────────────────────────────
const userPayload = { userId: 1, email: "test@catinflix.id", name: "Test User" };

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest("http://localhost/api/watchlist", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : {},
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengembalikan 401 jika tidak ada cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("mengembalikan 401 jika token tidak valid", async () => {
    mockCookieGet.mockReturnValue({ value: "token-tidak-valid" });
    mockVerifyToken.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("mengembalikan daftar watchlist untuk user yang valid", async () => {
    const items = [
      { id: 1, userId: 1, tmdbId: 550, mediaType: "movie", title: "Fight Club", posterPath: null },
    ];
    mockCookieGet.mockReturnValue({ value: "valid-token" });
    mockVerifyToken.mockResolvedValue(userPayload);
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(items),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.items).toHaveLength(1);
  });
});

describe("POST /api/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengembalikan 401 jika tidak ada cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const req = makeRequest("POST", { tmdbId: 550, mediaType: "movie", title: "Fight Club" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("mengembalikan 400 jika body tidak lengkap", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-token" });
    mockVerifyToken.mockResolvedValue(userPayload);
    const req = makeRequest("POST", { tmdbId: 550 }); // kurang mediaType & title
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("menambahkan item baru ke watchlist", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-token" });
    mockVerifyToken.mockResolvedValue(userPayload);
    // Simulate not duplicate
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });
    mockDbInsert.mockResolvedValue(undefined);

    const req = makeRequest("POST", { tmdbId: 550, mediaType: "movie", title: "Fight Club", posterPath: "/poster.jpg" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("mengembalikan success jika item sudah ada (duplikat tidak di-insert ulang)", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-token" });
    mockVerifyToken.mockResolvedValue(userPayload);
    // Simulate existing item
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: 1 }]),
        }),
      }),
    });

    const req = makeRequest("POST", { tmdbId: 550, mediaType: "movie", title: "Fight Club" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengembalikan 401 jika tidak ada cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const req = makeRequest("DELETE", { tmdbId: 550, mediaType: "movie" });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("mengembalikan 400 jika body tidak lengkap", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-token" });
    mockVerifyToken.mockResolvedValue(userPayload);
    const req = makeRequest("DELETE", { tmdbId: 550 }); // kurang mediaType
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("menghapus item dari watchlist", async () => {
    mockCookieGet.mockReturnValue({ value: "valid-token" });
    mockVerifyToken.mockResolvedValue(userPayload);
    mockDbDelete.mockResolvedValue(undefined);

    const req = makeRequest("DELETE", { tmdbId: 550, mediaType: "movie" });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
