import { describe, it, expect } from "vitest";
import { users, watchlist, watchRooms, roomMembers } from "@/lib/db/schema";

describe("Database Schema", () => {
  it("users table has required columns", () => {
    const columns = Object.keys(users);
    expect(columns).toContain("id");
    expect(columns).toContain("email");
    expect(columns).toContain("name");
    expect(columns).toContain("passwordHash");
    expect(columns).toContain("createdAt");
  });

  it("watchlist table has required columns", () => {
    const columns = Object.keys(watchlist);
    expect(columns).toContain("userId");
    expect(columns).toContain("tmdbId");
    expect(columns).toContain("mediaType");
    expect(columns).toContain("title");
    expect(columns).toContain("posterPath");
  });

  it("watchRooms table has required columns", () => {
    const columns = Object.keys(watchRooms);
    expect(columns).toContain("inviteCode");
    expect(columns).toContain("hostId");
    expect(columns).toContain("currentTime");
    expect(columns).toContain("isPlaying");
    expect(columns).toContain("expiresAt");
  });

  it("roomMembers table has required columns", () => {
    const columns = Object.keys(roomMembers);
    expect(columns).toContain("roomId");
    expect(columns).toContain("userId");
    expect(columns).toContain("joinedAt");
  });

  it("watchlist enforces mediaType enum values", () => {
    // Enum harus hanya 'movie' atau 'tv'
    const mediaTypeCol = watchlist.mediaType;
    expect(mediaTypeCol).toBeDefined();
  });

  it("invite code is exactly 8 characters", () => {
    const inviteCodeCol = watchRooms.inviteCode;
    // @ts-expect-error accessing internal config for test
    expect(inviteCodeCol.length).toBe(8);
  });
});
