import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTrending,
  searchMulti,
  getMovieDetail,
  getGenres,
  discoverMedia,
} from "@/lib/tmdb/client";

// ── helper mock fetch ──────────────────────────────────────────────────────────

function mockFetch(...responses: object[]) {
  let callCount = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    const data = responses[callCount] ?? responses[responses.length - 1];
    callCount++;
    return {
      ok: true,
      json: async () => data,
    };
  }));
}

function mockFetchFail() {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: false,
    status: 404,
    json: async () => ({}),
  })));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

// ── Data fixture ───────────────────────────────────────────────────────────────

const movieItem = {
  id: 1,
  media_type: "movie",
  title: "Film Satu",
  overview: "Deskripsi film",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  release_date: "2024-01-01",
  vote_average: 7.5,
  vote_count: 1000,
  genre_ids: [28, 12],
};

const tvItem = {
  id: 2,
  media_type: "tv",
  name: "Serial Dua",
  overview: "Deskripsi serial",
  poster_path: "/poster2.jpg",
  backdrop_path: "/backdrop2.jpg",
  first_air_date: "2024-02-01",
  vote_average: 8.0,
  vote_count: 500,
  genre_ids: [18],
};

const paginatedResponse = (results: object[]) => ({
  results,
  page: 1,
  total_results: results.length,
  total_pages: 1,
});

// ── getTrending ────────────────────────────────────────────────────────────────

describe("getTrending", () => {
  it("mengembalikan daftar media yang ternormalisasi", async () => {
    mockFetch(paginatedResponse([movieItem, tvItem]));
    const result = await getTrending();
    expect(result.results).toHaveLength(2);
    expect(result.results[0].mediaType).toBe("movie");
    expect(result.results[0].title).toBe("Film Satu");
    expect(result.results[1].mediaType).toBe("tv");
    expect(result.results[1].title).toBe("Serial Dua");
  });

  it("mengembalikan paginasi yang benar", async () => {
    mockFetch({ results: [movieItem], page: 2, total_results: 100, total_pages: 5 });
    const result = await getTrending("all", "week", 2);
    expect(result.page).toBe(2);
    expect(result.total).toBe(100);
    expect(result.totalPages).toBe(5);
  });

  it("mengembalikan array kosong jika results tidak ada", async () => {
    mockFetch({ page: 1, total_results: 0, total_pages: 0 });
    const result = await getTrending();
    expect(result.results).toHaveLength(0);
  });

  it("melempar error jika fetch gagal", async () => {
    mockFetchFail();
    await expect(getTrending()).rejects.toThrow("TMDB 404");
  });
});

// ── searchMulti ───────────────────────────────────────────────────────────────

describe("searchMulti", () => {
  it("memfilter hasil hanya movie dan tv", async () => {
    const personItem = { id: 3, media_type: "person", name: "Aktor" };
    mockFetch(paginatedResponse([movieItem, tvItem, personItem]));
    const result = await searchMulti("action");
    expect(result.results).toHaveLength(2);
    expect(result.results.map((r) => r.mediaType)).toEqual(["movie", "tv"]);
  });

  it("mengembalikan hasil kosong untuk query yang tidak cocok", async () => {
    mockFetch(paginatedResponse([]));
    const result = await searchMulti("xyznotfound");
    expect(result.results).toHaveLength(0);
  });

  it("menormalisasi field mediaType dengan benar", async () => {
    mockFetch(paginatedResponse([movieItem]));
    const result = await searchMulti("film");
    expect(result.results[0].id).toBe(1);
    expect(result.results[0].posterPath).toBe("/poster.jpg");
    expect(result.results[0].voteAverage).toBe(7.5);
  });
});

// ── getMovieDetail ────────────────────────────────────────────────────────────

describe("getMovieDetail", () => {
  const movieDetail = {
    id: 1,
    title: "Film Detail",
    original_title: "Film Original",
    overview: "Deskripsi panjang",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    release_date: "2024-01-01",
    vote_average: 8.0,
    vote_count: 2000,
    genres: [{ id: 28, name: "Action" }],
    runtime: 120,
    original_language: "id",
    status: "Released",
    tagline: "Tagline film",
    budget: 10000000,
    revenue: 50000000,
  };

  const videosResponse = {
    results: [
      { key: "abc123", site: "YouTube", type: "Trailer", name: "Official Trailer" },
    ],
  };

  it("menggabungkan detail film dan video dalam satu objek", async () => {
    // getMovieDetail membuat 2 fetch call sekaligus (Promise.all)
    mockFetch(movieDetail, videosResponse);
    const result = await getMovieDetail(1);
    expect(result.id).toBe(1);
    expect(result.mediaType).toBe("movie");
    expect(result.title).toBe("Film Detail");
    expect(result.runtime).toBe(120);
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].key).toBe("abc123");
  });

  it("genres tersedia sebagai array objek", async () => {
    mockFetch(movieDetail, videosResponse);
    const result = await getMovieDetail(1);
    expect(result.genres).toHaveLength(1);
    expect(result.genres[0].name).toBe("Action");
  });

  it("videos kosong jika tidak ada trailer", async () => {
    mockFetch(movieDetail, { results: [] });
    const result = await getMovieDetail(1);
    expect(result.videos).toHaveLength(0);
  });

  it("melempar error jika fetch detail gagal", async () => {
    mockFetchFail();
    await expect(getMovieDetail(999)).rejects.toThrow("TMDB 404");
  });
});

// ── getGenres ─────────────────────────────────────────────────────────────────

describe("getGenres", () => {
  it("mengembalikan daftar genre film", async () => {
    mockFetch({ genres: [{ id: 28, name: "Action" }, { id: 12, name: "Adventure" }] });
    const result = await getGenres("movie");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(28);
    expect(result[0].name).toBe("Action");
  });

  it("mengembalikan array kosong jika tidak ada genre", async () => {
    mockFetch({});
    const result = await getGenres("tv");
    expect(result).toHaveLength(0);
  });
});

// ── discoverMedia ─────────────────────────────────────────────────────────────

describe("discoverMedia", () => {
  it("menormalisasi movie dari discover", async () => {
    mockFetch(paginatedResponse([{ ...movieItem, media_type: undefined }]));
    const result = await discoverMedia({ type: "movie" });
    expect(result.results[0].mediaType).toBe("movie");
    expect(result.results[0].title).toBe("Film Satu");
  });

  it("menormalisasi tv dari discover", async () => {
    mockFetch(paginatedResponse([{ ...tvItem, media_type: undefined }]));
    const result = await discoverMedia({ type: "tv" });
    expect(result.results[0].mediaType).toBe("tv");
    expect(result.results[0].title).toBe("Serial Dua");
  });
});
