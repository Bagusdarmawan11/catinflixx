import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { AUTH_CONFIG } from "@/config";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { withSecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama maksimal 100 karakter")
    .regex(/^[a-zA-Z0-9\s._'-]+$/, "Nama mengandung karakter tidak diizinkan"),
  email: z.string().email("Format email tidak valid").max(255),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(128, "Password terlalu panjang"),
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Rate limit: 5 register per IP per jam
  const ipCheck = checkRateLimit(`register:ip:${ip}`, 5, 60 * 60_000, 60 * 60_000);
  if (!ipCheck.allowed) {
    const res = NextResponse.json(
      {
        success: false,
        error: `Terlalu banyak percobaan registrasi. Coba lagi dalam ${ipCheck.retryAfterSeconds} detik.`,
      },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(ipCheck.retryAfterSeconds));
    return withSecurityHeaders(res);
  }

  try {
    const body = await req.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, error: result.error.issues[0].message },
          { status: 400 }
        )
      );
    }

    const { name, email, password } = result.data;

    // Cek apakah email sudah terdaftar
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, error: "Email sudah terdaftar" },
          { status: 409 }
        )
      );
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      });

    const token = await signToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          createdAt: newUser.createdAt,
        },
      },
      { status: 201 }
    );

    response.cookies.set(AUTH_CONFIG.cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: AUTH_CONFIG.cookieMaxAge,
      path: "/",
    });

    return withSecurityHeaders(response);
  } catch (err) {
    console.error("[Auth] Register error:", err);
    return withSecurityHeaders(
      NextResponse.json(
        { success: false, error: "Terjadi kesalahan server" },
        { status: 500 }
      )
    );
  }
}
