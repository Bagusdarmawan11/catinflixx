const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function getAuthHeader(): HeadersInit {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) throw new Error("TMDB_API_TOKEN is not configured");
  if (token.startsWith("eyJ")) {
    return { Authorization: `Bearer ${token}` };
  }
  // Fallback: API key v3 via query param (handled in fetchTmdb)
  return {};
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const token = process.env.TMDB_API_TOKEN;
  const url = new URL(`${TMDB_BASE_URL}${path}`);

  // Always add language
  url.searchParams.set("language", "id-ID");

  // If not bearer token, use api_key param
  if (token && !token.startsWith("eyJ")) {
    url.searchParams.set("api_key", token);
  }

  for (const [key, val] of Object.entries(params)) {
    if (val) url.searchParams.set(key, val);
  }

  return url.toString();
}

async function fetchTmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    headers: getAuthHeader(),
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`TMDB ${res.status}: ${path}`);
  }

  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaCard {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  genreIds: number[];
}

export interface MediaDetail extends MediaCard {
  originalTitle: string;
  genres: { id: number; name: string }[];
  runtime: number | null;
  language: string;
  status: string;
  tagline: string | null;
  budget: number | null;
  revenue: number | null;
  seasons: number | null;
  episodes: number | null;
  videos: { key: string; site: string; type: string; name: string }[];
  cast?: { id: number; name: string; character: string; profilePath: string | null }[];
}

export interface PaginatedResponse<T> {
  results: T[];
  page: number;
  total: number;
  totalPages: number;
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeMovie(m: any): MediaCard {
  return {
    id: m.id,
    mediaType: "movie",
    title: m.title || m.original_title || "Unknown",
    overview: m.overview || "",
    posterPath: m.poster_path || null,
    backdropPath: m.backdrop_path || null,
    releaseDate: m.release_date || "",
    voteAverage: m.vote_average || 0,
    voteCount: m.vote_count || 0,
    genreIds: m.genre_ids || [],
  };
}

function normalizeTv(t: any): MediaCard {
  return {
    id: t.id,
    mediaType: "tv",
    title: t.name || t.original_name || "Unknown",
    overview: t.overview || "",
    posterPath: t.poster_path || null,
    backdropPath: t.backdrop_path || null,
    releaseDate: t.first_air_date || "",
    voteAverage: t.vote_average || 0,
    voteCount: t.vote_count || 0,
    genreIds: t.genre_ids || [],
  };
}

function normalizeItem(item: any): MediaCard {
  const type = item.media_type || (item.title ? "movie" : "tv");
  return type === "movie" ? normalizeMovie(item) : normalizeTv(item);
}

// ─── API Functions ─────────────────────────────────────────────────────────────

export async function getTrending(
  type: "all" | "movie" | "tv" = "all",
  window: "day" | "week" = "week",
  page = 1
): Promise<PaginatedResponse<MediaCard>> {
  const data = await fetchTmdb<any>(`/trending/${type}/${window}`, {
    page: String(page),
  });
  return {
    results: (data.results || []).map(normalizeItem),
    page: data.page || 1,
    total: data.total_results || 0,
    totalPages: data.total_pages || 1,
  };
}

export async function searchMulti(
  query: string,
  page = 1
): Promise<PaginatedResponse<MediaCard>> {
  const data = await fetchTmdb<any>("/search/multi", {
    query,
    page: String(page),
    include_adult: "false",
  });
  return {
    results: (data.results || [])
      .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
      .map(normalizeItem),
    page: data.page || 1,
    total: data.total_results || 0,
    totalPages: data.total_pages || 1,
  };
}

export async function getMovieDetail(id: number): Promise<MediaDetail> {
  const [detail, videos] = await Promise.all([
    fetchTmdb<any>(`/movie/${id}`),
    fetchTmdb<any>(`/movie/${id}/videos`),
  ]);

  return {
    id: detail.id,
    mediaType: "movie",
    title: detail.title || detail.original_title,
    originalTitle: detail.original_title || "",
    overview: detail.overview || "",
    posterPath: detail.poster_path || null,
    backdropPath: detail.backdrop_path || null,
    releaseDate: detail.release_date || "",
    voteAverage: detail.vote_average || 0,
    voteCount: detail.vote_count || 0,
    genreIds: (detail.genres || []).map((g: any) => g.id),
    genres: detail.genres || [],
    runtime: detail.runtime || null,
    language: detail.original_language || "",
    status: detail.status || "",
    tagline: detail.tagline || null,
    budget: detail.budget || null,
    revenue: detail.revenue || null,
    seasons: null,
    episodes: null,
    videos: (videos.results || []).map((v: any) => ({
      key: v.key,
      site: v.site,
      type: v.type,
      name: v.name,
    })),
  };
}

export async function getTvDetail(id: number): Promise<MediaDetail> {
  const [detail, videos] = await Promise.all([
    fetchTmdb<any>(`/tv/${id}`),
    fetchTmdb<any>(`/tv/${id}/videos`),
  ]);

  return {
    id: detail.id,
    mediaType: "tv",
    title: detail.name || detail.original_name,
    originalTitle: detail.original_name || "",
    overview: detail.overview || "",
    posterPath: detail.poster_path || null,
    backdropPath: detail.backdrop_path || null,
    releaseDate: detail.first_air_date || "",
    voteAverage: detail.vote_average || 0,
    voteCount: detail.vote_count || 0,
    genreIds: (detail.genres || []).map((g: any) => g.id),
    genres: detail.genres || [],
    runtime: detail.episode_run_time?.[0] || null,
    language: detail.original_language || "",
    status: detail.status || "",
    tagline: detail.tagline || null,
    budget: null,
    revenue: null,
    seasons: detail.number_of_seasons || null,
    episodes: detail.number_of_episodes || null,
    videos: (videos.results || []).map((v: any) => ({
      key: v.key,
      site: v.site,
      type: v.type,
      name: v.name,
    })),
  };
}

export async function getGenres(type: "movie" | "tv"): Promise<{ id: number; name: string }[]> {
  const data = await fetchTmdb<any>(`/genre/${type}/list`);
  return data.genres || [];
}

export interface DiscoverParams {
  type?: "movie" | "tv";
  page?: number;
  genre?: string;
  year?: string;
  sort?: string;
  lang?: string;
}

export async function discoverMedia(
  params: DiscoverParams = {}
): Promise<PaginatedResponse<MediaCard>> {
  const { type = "movie", page = 1, genre, year, sort = "popularity.desc", lang } = params;

  const queryParams: Record<string, string> = {
    page: String(page),
    sort_by: sort,
    "vote_count.gte": "50",
  };

  if (genre) queryParams.with_genres = genre;
  if (lang) queryParams.with_original_language = lang;
  if (year) {
    if (type === "movie") queryParams.primary_release_year = year;
    else queryParams.first_air_date_year = year;
  }

  const data = await fetchTmdb<any>(`/discover/${type}`, queryParams);

  const normalizer = type === "movie" ? normalizeMovie : normalizeTv;
  return {
    results: (data.results || []).map(normalizer),
    page: data.page || 1,
    total: data.total_results || 0,
    totalPages: data.total_pages || 1,
  };
}
