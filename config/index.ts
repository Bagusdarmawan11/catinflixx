export const APP_CONFIG = {
  name: "CatinFlix",
  description: "Platform katalog dan streaming film modern",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  version: "1.0.0",
} as const;

export const AUTH_CONFIG = {
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: "7d",
  cookieName: "catinflix_session",
  cookieMaxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  bcryptRounds: 12,
} as const;

export const TMDB_CONFIG = {
  baseUrl: "https://api.themoviedb.org/3",
  imageBaseUrl: "https://image.tmdb.org/t/p",
  posterSizes: {
    small: "w185",
    medium: "w342",
    large: "w500",
    original: "original",
  },
  backdropSizes: {
    small: "w300",
    medium: "w780",
    large: "w1280",
    original: "original",
  },
  defaultLanguage: "id-ID",
  fallbackLanguage: "en-US",
} as const;

export const WATCH_PARTY_CONFIG = {
  maxMembers: 10,
  maxMessageLength: 300,
  messageRateLimitMs: 1000,
  roomExpiryHours: 8,
  inviteCodeLength: 8,
} as const;

export const PAGINATION_CONFIG = {
  defaultPageSize: 20,
  maxPageSize: 40,
} as const;

export const RATE_LIMIT_CONFIG = {
  authWindowMs: 15 * 60 * 1000, // 15 minutes
  authMaxRequests: 10,
  apiWindowMs: 60 * 1000, // 1 minute
  apiMaxRequests: 60,
} as const;
