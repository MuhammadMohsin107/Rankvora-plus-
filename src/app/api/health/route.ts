import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";

export async function GET() {
  // Cache Components replaces `export const dynamic = "force-dynamic"`:
  // awaiting connection() defers this handler to request time, so the
  // database is never touched during `next build`.
  await connection();

  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", db: "connected" });
  } catch {
    return Response.json(
      { status: "error", db: "disconnected" },
      { status: 500 },
    );
  }
}
