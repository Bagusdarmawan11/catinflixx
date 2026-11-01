import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyToken, signToken } from "@/lib/auth/jwt";
import { hashPassword, comparePassword } from "@/lib/auth/password";
import { AUTH_CONFIG } from "@/config";
import { eq } from "drizzle-orm";
import { profileUpdateSchema } from "@/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET /api/auth/me — ambil data user login ─────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_CONFIG.cookieName)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Tidak terautentikasi" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Token tidak valid atau sudah kedaluwarsa" },
        { status: 401 }
      );
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error("[Auth] Me GET error:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/auth/me — update nama dan/atau password ──────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_CONFIG.cookieName)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Tidak terautentikasi" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Token tidak valid atau sudah kedaluwarsa" },
        { status: 401 }
      );
    }

    // Validasi input
    const body = await req.json();
    const result = profileUpdateSchema.safeParse(body);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstError.message },
        { status: 400 }
      );
    }

    const { name, currentPassword, newPassword } = result.data;

    // Tidak ada yang diubah
    if (!name && !newPassword) {
      return NextResponse.json(
        { success: false, error: "Tidak ada data yang diubah" },
        { status: 400 }
      );
    }

    // Ambil data user + passwordHash
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    // Verifikasi password lama jika ingin ganti password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: "Password lama diperlukan" },
          { status: 400 }
        );
      }
      const isValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: "Password lama tidak sesuai" },
          { status: 400 }
        );
      }
    }

    // Buat update object
    const updateData: Partial<typeof users.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (name) updateData.name = name.trim();
    if (newPassword) updateData.passwordHash = await hashPassword(newPassword);

    // Update ke DB
    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, payload.userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      });

    // Jika nama berubah, refresh JWT cookie agar nama di token ikut update
    const response = NextResponse.json({
      success: true,
      user: updated,
      message: "Profil berhasil diperbarui",
    });

    if (name && name !== user.name) {
      const newToken = await signToken({
        userId: updated.id,
        email: updated.email,
        name: updated.name,
      });
      response.cookies.set(AUTH_CONFIG.cookieName, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 hari
        path: "/",
      });
    }

    return response;
  } catch (err) {
    console.error("[Auth] Me PATCH error:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
