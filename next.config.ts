import type { NextConfig } from "next";

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

export default nextConfig;
