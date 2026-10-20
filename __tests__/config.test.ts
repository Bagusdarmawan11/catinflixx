import { describe, it, expect } from "vitest";
import { APP_CONFIG, TMDB_CONFIG, WATCH_PARTY_CONFIG } from "@/config";

describe("Application Config", () => {
  it("APP_CONFIG has required fields", () => {
    expect(APP_CONFIG.name).toBe("CatinFlix");
    expect(APP_CONFIG.version).toBeDefined();
  });

  it("TMDB_CONFIG has valid image URLs", () => {
    expect(TMDB_CONFIG.imageBaseUrl).toContain("image.tmdb.org");
    expect(TMDB_CONFIG.posterSizes.medium).toBe("w342");
    expect(TMDB_CONFIG.backdropSizes.large).toBe("w1280");
  });

  it("WATCH_PARTY_CONFIG has sensible limits", () => {
    expect(WATCH_PARTY_CONFIG.maxMembers).toBeGreaterThan(0);
    expect(WATCH_PARTY_CONFIG.maxMessageLength).toBeGreaterThan(0);
    expect(WATCH_PARTY_CONFIG.maxMessageLength).toBeLessThanOrEqual(500);
  });
});
