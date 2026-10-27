import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { comparePassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { AUTH_CONFIG } from "@/config";
import { eq } from "drizzle-orm";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rateLimit";
import { withSecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password tidak boleh kosong"),
});

// Helper ambil IP dari request
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Rate limit: 10 percobaan per 15 menit per IP, block 15 menit
  const ipCheck = checkRateLimit(
    `login:ip:${ip}`,
    10,
    15 * 60_000,
    15 * 60_000
  );
  if (!ipCheck.allowed) {
    const res = NextResponse.json(
      {
        success: false,
        error: `Terlalu banyak percobaan login. Coba lagi dalam ${ipCheck.retryAfterSeconds} detik.`,
      },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(ipCheck.retryAfterSeconds));
    return withSecurityHeaders(res);
  }

  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, error: result.error.issues[0].message },
          { status: 400 }
        )
      );
    }

    const { email, password } = result.data;

    // Rate limit per email: 5 percobaan per 15 menit, block 30 menit
    const emailCheck = checkRateLimit(
      `login:email:${email.toLowerCase()}`,
      5,
      15 * 60_000,
      30 * 60_000
    );
    if (!emailCheck.allowed) {
      const res = NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan untuk akun ini. Coba lagi dalam ${emailCheck.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
      res.headers.set("Retry-After", String(emailCheck.retryAfterSeconds));
      return withSecurityHeaders(res);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    // Pesan error yang sama untuk keamanan (tidak bocorkan mana yang salah)
    const invalidMsg = "Email atau password salah";

    if (!user) {
      return withSecurityHeaders(
        NextResponse.json({ success: false, error: invalidMsg }, { status: 401 })
      );
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return withSecurityHeaders(
        NextResponse.json({ success: false, error: invalidMsg }, { status: 401 })
      );
    }

    // Login berhasil — reset rate limit untuk email ini
    resetRateLimit(`login:email:${email.toLowerCase()}`);
    resetRateLimit(`login:ip:${ip}`);

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });

    response.cookies.set(AUTH_CONFIG.cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: AUTH_CONFIG.cookieMaxAge,
      path: "/",
    });

    return withSecurityHeaders(response);
  } catch (err) {
    console.error("[Auth] Login error:", err);
    return withSecurityHeaders(
      NextResponse.json(
        { success: false, error: "Terjadi kesalahan server" },
        { status: 500 }
      )
    );
  }
}
