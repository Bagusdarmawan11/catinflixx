/**
 * Menjalankan migrasi database ke Neon.
 * Jalankan dengan: npm run db:migrate
 *
 * Pastikan DATABASE_URL sudah diset di environment.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";
import path from "path";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL tidak ditemukan.");
    console.error("   Set environment variable sebelum menjalankan migrasi.");
    process.exit(1);
  }

  console.log("🔄 Menjalankan migrasi database...");

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });

  console.log("✅ Migrasi selesai.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migrasi gagal:", err);
  process.exit(1);
});
