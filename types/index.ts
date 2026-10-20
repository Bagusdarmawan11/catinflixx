// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: Date;
}

export interface AuthPayload {
  userId: number;
  email: string;
  name: string;
}

export interface SessionData {
  user: User;
  token: string;
}

// ─── TMDB ────────────────────────────────────────────────────────────────────

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
  popularity: number;
  adult: boolean;
}

export interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
  popularity: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBMovieDetail extends TMDBMovie {
  genres: TMDBGenre[];
  runtime: number | null;
  status: string;
  tagline: string | null;
  budget: number;
  revenue: number;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ iso_639_1: string; name: string }>;
  videos?: {
    results: TMDBVideo[];
  };
  credits?: {
    cast: TMDBCastMember[];
    crew: TMDBCrewMember[];
  };
}

export interface TMDBTVDetail extends TMDBTVShow {
  genres: TMDBGenre[];
  number_of_episodes: number;
  number_of_seasons: number;
  status: string;
  tagline: string | null;
  networks: Array<{ id: number; name: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  videos?: {
    results: TMDBVideo[];
  };
  credits?: {
    cast: TMDBCastMember[];
    crew: TMDBCrewMember[];
  };
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// ─── Watchlist ───────────────────────────────────────────────────────────────

export interface WatchlistItem {
  id: number;
  userId: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  voteAverage: number;
  releaseDate: string | null;
  addedAt: Date;
}

// ─── Watch Party ─────────────────────────────────────────────────────────────

export interface WatchRoom {
  id: string;
  inviteCode: string;
  hostId: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  currentTime: number;
  isPlaying: boolean;
  createdAt: Date;
  expiresAt: Date;
}

export interface RoomMember {
  userId: number;
  name: string;
  socketId: string;
  isHost: boolean;
  joinedAt: Date;
}

export interface ChatMessage {
  id: string;
  userId: number;
  userName: string;
  text: string;
  sentAt: Date;
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── UI ──────────────────────────────────────────────────────────────────────

export type MediaType = "movie" | "tv";

export interface FilterParams {
  genre?: string;
  year?: string;
  language?: string;
  sortBy?: string;
  page?: number;
}
