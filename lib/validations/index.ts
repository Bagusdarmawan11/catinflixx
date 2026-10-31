import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid").max(255),
  password: z.string().min(6, "Password minimal 6 karakter").max(128),
});

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama maksimal 100 karakter")
    .regex(/^[a-zA-Z0-9 _'-]+$/, "Nama mengandung karakter tidak valid"),
  email: z.string().email("Email tidak valid").max(255),
  password: z
    .string()
    .min(6, "Password minimal 6 karakter")
    .max(128, "Password terlalu panjang"),
});

export const profileUpdateSchema = z
  .object({
    name: z
      .string()
      .min(2, "Nama minimal 2 karakter")
      .max(100, "Nama maksimal 100 karakter")
      .optional(),
    currentPassword: z.string().min(1, "Password lama diperlukan").optional(),
    newPassword: z
      .string()
      .min(6, "Password baru minimal 6 karakter")
      .max(128)
      .optional(),
  })
  .refine(
    (data) => {
      // Jika newPassword diisi, currentPassword wajib ada
      if (data.newPassword && !data.currentPassword) return false;
      return true;
    },
    { message: "Password lama diperlukan untuk mengganti password", path: ["currentPassword"] }
  );

// ─── Watch Party ─────────────────────────────────────────────────────────────

export const createRoomSchema = z.object({
  videoUrl: z.string().url("URL tidak valid").max(2000),
  videoTitle: z.string().max(500).optional(),
});

export const joinRoomSchema = z.object({
  code: z
    .string()
    .min(6, "Kode room 6 karakter")
    .max(6, "Kode room 6 karakter")
    .toUpperCase(),
});

// ─── Watchlist ────────────────────────────────────────────────────────────────

export const watchlistItemSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  title: z.string().min(1).max(500),
  posterPath: z.string().max(500).nullable().optional(),
  voteAverage: z.number().min(0).max(10).default(0),
  releaseDate: z.string().max(20).optional(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type WatchlistItemInput = z.infer<typeof watchlistItemSchema>;
