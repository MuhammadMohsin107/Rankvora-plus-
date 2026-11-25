import { connection } from "next/server";

import { backendHealth } from "@/server/api/health";
import { databaseUnavailable, resolveDeps } from "@/server/http/next";

export async function GET() {
  await connection();
  const deps = await resolveDeps();
  return deps ? backendHealth(deps) : databaseUnavailable();
}
