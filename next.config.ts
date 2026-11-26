import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * Cache Components stays off: Cloudflare Workers (OpenNext) cannot yet run it reliably, and website
 * pages use real ids that only exist for a signed-in person, so they cannot be prerendered from a
 * fixed list. Pages are thin shells; their data comes from /api/v1 in the browser.
 */
const nextConfig: NextConfig = {
  // The Portfolio page was removed: the root URL goes to the websites list (a real 307, no page at "/").
  async redirects() {
    return [{ source: "/", destination: "/stores", permanent: false }];
  },
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
 */
export default async function config(phase: string): Promise<NextConfig> {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    try {
      const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
      await initOpenNextCloudflareForDev();
    } catch (error) {
      console.warn("[d1] Local D1 binding unavailable:", error instanceof Error ? error.message : error);
    }
  }
  return nextConfig;
}
