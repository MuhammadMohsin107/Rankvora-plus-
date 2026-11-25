/**
 * The only file that connects the server layer to Next.js and Cloudflare. Route files under
 * src/app/api/v1 do nothing but call `nextRoute`.
 */
import { connection } from "next/server";

import { readEnv, type Deps } from "../env";
import { newId } from "../ids";
import { ApiError } from "./errors";
import { errorResponse, type ApiHandler } from "./handler";

/** null when there is no D1 binding (`next start`, or a dev server that could not start it). */
export async function resolveDeps(): Promise<Deps | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env, ctx } = await getCloudflareContext({ async: true });
    if (!env.DB) return null;
    return {
      d1: env.DB,
      env: readEnv(env as unknown as Record<string, unknown>),
      now: () => new Date(),
      waitUntil: ctx ? (task) => ctx.waitUntil(task) : undefined,
    };
  } catch {
    return null;
  }
}

export function databaseUnavailable(): Response {
  return errorResponse(new ApiError(503, "database_unavailable", "The database is not available."), newId("req"));
}

export function nextRoute(handler: ApiHandler) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }): Promise<Response> => {
    // Request time only, with Cache Components on (local) or off (Cloudflare).
    await connection();
    const deps = await resolveDeps();
    if (!deps) return databaseUnavailable();
    return handler(request, deps, await context.params);
  };
}
