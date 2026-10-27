import { describe, it, expect } from "vitest";
import { signToken, verifyToken, type JWTPayload } from "@/lib/auth/jwt";
import { hashPassword, comparePassword } from "@/lib/auth/password";

const samplePayload: JWTPayload = {
  userId: 42,
  email: "catin@flix.id",
  name: "Catin User",
};

describe("JWT — signToken & verifyToken", () => {
  it("signToken menghasilkan string JWT", async () => {
    const token = await signToken(samplePayload);
    expect(typeof token).toBe("string");
    // JWT format: header.payload.signature
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifyToken mengembalikan payload yang benar", async () => {
    const token = await signToken(samplePayload);
    const result = await verifyToken(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe(samplePayload.userId);
    expect(result!.email).toBe(samplePayload.email);
    expect(result!.name).toBe(samplePayload.name);
  });

  it("verifyToken mengembalikan null untuk token tidak valid", async () => {
    const result = await verifyToken("token.tidak.valid");
    expect(result).toBeNull();
  });

  it("verifyToken mengembalikan null untuk token kosong", async () => {
    const result = await verifyToken("");
    expect(result).toBeNull();
  });

  it("verifyToken mengembalikan null untuk token yang dimanipulasi", async () => {
    const token = await signToken(samplePayload);
    const parts = token.split(".");
    parts[1] = Buffer.from(JSON.stringify({ userId: 999, email: "hacker@evil.com", name: "Hacker" })).toString("base64url");
    const tampered = parts.join(".");
    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });
});

describe("Password — hashPassword & comparePassword", () => {
  it("hashPassword menghasilkan string hash", async () => {
    const hash = await hashPassword("password123");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("hash berbeda setiap kali (karena salt)", async () => {
    const hash1 = await hashPassword("password123");
    const hash2 = await hashPassword("password123");
    expect(hash1).not.toBe(hash2);
  });

  it("comparePassword mengembalikan true untuk password benar", async () => {
    const hash = await hashPassword("rahasia123");
    const result = await comparePassword("rahasia123", hash);
    expect(result).toBe(true);
  });

  it("comparePassword mengembalikan false untuk password salah", async () => {
    const hash = await hashPassword("rahasia123");
    const result = await comparePassword("passwordSalah", hash);
    expect(result).toBe(false);
  });

  it("comparePassword mengembalikan false untuk string kosong", async () => {
    const hash = await hashPassword("rahasia123");
    const result = await comparePassword("", hash);
    expect(result).toBe(false);
  });
});
