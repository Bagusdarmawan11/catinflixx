import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  let overallOk = true;

  // Check database
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch (err) {
    checks.database = "error";
    overallOk = false;
    console.error("[Health] Database check failed:", err);
  }

  return NextResponse.json(
    {
      status: overallOk ? "ok" : "degraded",
      app: "CatinFlix",
      version: "1.0.0",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: overallOk ? 200 : 503 }
  );
}
