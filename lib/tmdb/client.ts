import { TMDB_CONFIG } from "@/config";
import type {
  TmdbMovie,
  TmdbTvShow,
  TmdbMovieDetail,
  TmdbTvDetail,
  TmdbGenre,
  TmdbVideo,
  TmdbPaginatedResponse,
  MediaCard,
  MediaDetail,
  MediaType,
} from "./types";

// ─── Auth Helper ─────────────────────────────────────────────────────────────

function getAuthHeader(): Record<string, string> {
  const bearerToken = process.env.TMDB_API_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  if (bearerToken && bearerToken.startsWith("eyJ")) {
    // API Read Access Token (JWT)
    return { Authorization: `Bearer ${bearerToken}` };
  }

  if (apiKey) {
    // Fallback ke API Key v3 via header tidak didukung — perlu query param
    // Kembalikan header kosong, fetchTmdb akan tambahkan ke URL
    return {};
  }

  throw new Error("TMDB credentials not configured. Set TMDB_API_TOKEN or TMDB_API_KEY.");
}

function getApiKeyParam(): string {
  const bearerToken = process.env.TMDB_API_TOKEN;
  if (bearerToken && bearerToken.startsWith("eyJ")) return ""; // bearer token, tidak perlu key param

  const apiKey = process.env.TMDB_API_KEY ?? process.env.TMDB_API_TOKEN;
  if (apiKey) return `&api_key=${apiKey}`;

  return "";
}

// ─── Fetch Utility ────────────────────────────────────────────────────────────

async function fetchTmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const queryString = new URLSearchParams({
    language: TMDB_CONFIG.defaultLanguage,
    ...params,
  }).toString();

  const url = `${TMDB_CONFIG.baseUrl}${path}?${queryString}${getApiKeyParam()}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    next: { revalidate: 300 }, // cache 5 menit
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("TMDB rate limit exceeded");
    if (res.status === 401) throw new Error("TMDB authentication failed");
    if (res.status === 404) throw new Error("Not found");
    throw new Error(`TMDB API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeMovie(movie: TmdbMovie, mediaType: MediaType = "movie"): MediaCard {
  return {
    id: movie.id,
    mediaType,
    title: "title" in movie ? movie.title : (movie as unknown as TmdbTvShow).name,
    overview: movie.overview,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    releaseDate: "release_date" in movie ? movie.release_date : (movie as unknown as TmdbTvShow).first_air_date,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    genreIds: movie.genre_ids ?? [],
  };
}

function getBestTrailer(videos: TmdbVideo[]): TmdbVideo | null {
  const youtubeTrailers = videos.filter(
    (v) => v.site === "YouTube" && v.type === "Trailer" && v.official
  );
  return youtubeTrailers[0] ?? videos.find((v) => v.site === "YouTube") ?? null;
}

// ─── Public API Functions ─────────────────────────────────────────────────────

export async function getTrending(
  mediaType: MediaType | "all" = "all",
  timeWindow: "day" | "week" = "week",
  page = 1
): Promise<{ results: MediaCard[]; totalPages: number; totalResults: number }> {
  const data = await fetchTmdb<TmdbPaginatedResponse<TmdbMovie & { media_type?: string }>>(
    `/trending/${mediaType}/${timeWindow}`,
    { page: String(page) }
  );

  const results = data.results.map((item) => {
    const type: MediaType = (item.media_type as MediaType) ?? mediaType === "all" ? "movie" : (mediaType as MediaType);
    return normalizeMovie(item, type);
  });

  return { results, totalPages: data.total_pages, totalResults: data.total_results };
}

export async function searchMulti(
  query: string,
  page = 1
): Promise<{ results: MediaCard[]; totalPages: number; totalResults: number }> {
  const data = await fetchTmdb<TmdbPaginatedResponse<(TmdbMovie | TmdbTvShow) & { media_type: string }>>(
    "/search/multi",
    { query, page: String(page), include_adult: "false" }
  );

  const results = data.results
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .map((item) => normalizeMovie(item as TmdbMovie, item.media_type as MediaType));

  return { results, totalPages: data.total_pages, totalResults: data.total_results };
}

export async function getMovieDetail(id: number): Promise<MediaDetail> {
  const data = await fetchTmdb<TmdbMovieDetail>(`/movie/${id}`, {
    append_to_response: "videos",
  });

  return {
    id: data.id,
    mediaType: "movie",
    title: data.title,
    overview: data.overview,
    posterPath: data.poster_path,
    backdropPath: data.backdrop_path,
    releaseDate: data.release_date,
    voteAverage: data.vote_average,
    voteCount: data.vote_count,
    genreIds: data.genres.map((g) => g.id),
    genres: data.genres,
    runtime: data.runtime,
    status: data.status,
    tagline: data.tagline,
    originalLanguage: data.original_language,
    trailer: getBestTrailer(data.videos?.results ?? []),
  };
}

export async function getTvDetail(id: number): Promise<MediaDetail> {
  const data = await fetchTmdb<TmdbTvDetail>(`/tv/${id}`, {
    append_to_response: "videos",
  });

  return {
    id: data.id,
    mediaType: "tv",
    title: data.name,
    overview: data.overview,
    posterPath: data.poster_path,
    backdropPath: data.backdrop_path,
    releaseDate: data.first_air_date,
    voteAverage: data.vote_average,
    voteCount: data.vote_count,
    genreIds: data.genres.map((g) => g.id),
    genres: data.genres,
    runtime: data.episode_run_time[0] ?? null,
    status: data.status,
    tagline: data.tagline,
    originalLanguage: data.original_language,
    trailer: getBestTrailer(data.videos?.results ?? []),
  };
}

export async function getGenres(mediaType: "movie" | "tv" = "movie"): Promise<TmdbGenre[]> {
  const data = await fetchTmdb<{ genres: TmdbGenre[] }>(`/genre/${mediaType}/list`);
  return data.genres;
}

export async function discoverMedia(
  mediaType: MediaType,
  params: {
    page?: number;
    genreId?: number;
    year?: number;
    sortBy?: string;
    withOriginalLanguage?: string;
  } = {}
): Promise<{ results: MediaCard[]; totalPages: number; totalResults: number }> {
  const query: Record<string, string> = {
    page: String(params.page ?? 1),
    sort_by: params.sortBy ?? "popularity.desc",
    include_adult: "false",
  };

  if (params.genreId) query.with_genres = String(params.genreId);
  if (params.year) {
    if (mediaType === "movie") query.primary_release_year = String(params.year);
    else query.first_air_date_year = String(params.year);
  }
  if (params.withOriginalLanguage) query.with_original_language = params.withOriginalLanguage;

  const data = await fetchTmdb<TmdbPaginatedResponse<TmdbMovie | TmdbTvShow>>(
    `/discover/${mediaType}`,
    query
  );

  const results = data.results.map((item) => normalizeMovie(item as TmdbMovie, mediaType));
  return { results, totalPages: data.total_pages, totalResults: data.total_results };
}
