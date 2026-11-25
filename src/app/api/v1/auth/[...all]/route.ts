import { connection } from "next/server";

import { handleAuthRequest } from "@/server/auth/endpoint";
import { databaseUnavailable, resolveDeps } from "@/server/http/next";

/** Better Auth: sign-up, sign-in, verification, password reset, sessions, two-factor, account deletion. */
async function handle(request: Request): Promise<Response> {
  await connection();
  const deps = await resolveDeps();
  return deps ? handleAuthRequest(request, deps) : databaseUnavailable();
}

export const GET = handle;
export const POST = handle;
