import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext config for Cloudflare Workers. Every page is prerendered demo content,
 * so the default (no external incremental cache) is enough.
 */
export default defineCloudflareConfig({});
