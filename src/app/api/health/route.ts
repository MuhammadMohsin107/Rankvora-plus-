import { connection } from "next/server";

import { getD1 } from "@/db-d1/client";

/**
 * Health check for the Cloudflare D1 binding: `select 1`, then a probe of the
 * `workspaces` table (fails when migrations have not been applied).
 * 200 { status: "ok", d1: "connected" } or 503 { status: "error", d1: "unavailable", detail }.
 * `detail` is one of a fixed set of strings, never an error message.
 */
export async function GET() {
  // Runs at request time with Cache Components on (local) or off (Cloudflare):
  // the database is never touched during `next build`.
  await connection();

  const headers = { "Cache-Control": "no-store" };
  const unavailable = (detail: "binding_missing" | "migrations_not_applied" | "query_failed") =>
    Response.json({ status: "error", d1: "unavailable", detail }, { status: 503, headers });

  const d1 = await getD1();
  if (!d1) return unavailable("binding_missing");

  try {
    await d1.prepare("select 1").first();
  } catch {
    return unavailable("query_failed");
  }
  try {
    await d1.prepare("select 1 from workspaces limit 1").first();
  } catch {
    return unavailable("migrations_not_applied");
  }
  return Response.json({ status: "ok", d1: "connected" }, { headers });
}
