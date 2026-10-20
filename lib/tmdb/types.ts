// ─── TMDB Base Types ─────────────────────────────────────────────────────────

export type MediaType = "movie" | "tv";

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  adult: boolean;
  video: boolean;
  media_type?: "movie";
}

export interface TmdbTvShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
  media_type?: "tv";
}

export type TmdbMediaItem = (TmdbMovie & { media_type: "movie" }) | (TmdbTvShow & { media_type: "tv" });

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
}

// ─── TMDB Response Types ─────────────────────────────────────────────────────

export interface TmdbPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbMovieDetail extends TmdbMovie {
  genres: TmdbGenre[];
  runtime: number | null;
  status: string;
  tagline: string;
  homepage: string;
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { iso_639_1: string; name: string }[];
  videos?: { results: TmdbVideo[] };
}

export interface TmdbTvDetail extends TmdbTvShow {
  genres: TmdbGenre[];
  episode_run_time: number[];
  status: string;
  tagline: string;
  homepage: string;
  number_of_episodes: number;
  number_of_seasons: number;
  videos?: { results: TmdbVideo[] };
}

// ─── Normalized Types (untuk API response CatinFlix) ─────────────────────────

export interface MediaCard {
  id: number;
  mediaType: MediaType;
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
  genres: TmdbGenre[];
  runtime: number | null;
  status: string;
  tagline: string;
  originalLanguage: string;
  trailer: TmdbVideo | null;
}
