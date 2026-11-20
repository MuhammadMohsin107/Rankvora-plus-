import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * Cloudflare Workers (OpenNext) cannot yet run Cache Components reliably: the
 * adapter has open issues with hangs, 500s and hydration errors. On Cloudflare
 * the app builds as plain prerendered pages instead (every page is static demo
 * content). Local `next dev` and `next build` keep Cache Components on.
 *
 * Cloudflare Workers Builds sets WORKERS_CI=1; `npm run deploy` / `preview` set
 * DEPLOY_TARGET=cloudflare.
 */
const onCloudflare = process.env.DEPLOY_TARGET === "cloudflare" || process.env.WORKERS_CI === "1";

const nextConfig: NextConfig = {
  cacheComponents: !onCloudflare,
  partialPrefetching: !onCloudflare,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

/**
 * Only `next dev` loads the Cloudflare bindings (D1 `DB`) so local development
 * can use a SQLite file under .wrangler/state. Builds never touch wrangler.
 * If the binding cannot start, the app keeps working on localStorage alone.
 */
export default async function config(phase: string): Promise<NextConfig> {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    try {
      const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
      await initOpenNextCloudflareForDev();
    } catch (error) {
      console.warn("[d1] Local D1 binding unavailable, demo state stays in localStorage:", error instanceof Error ? error.message : error);
    }
  }
  return nextConfig;
}
