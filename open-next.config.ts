import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext config for Cloudflare Workers. Every page today is prerendered demo
 * content, so the default (no external incremental cache) is enough. When the
 * backend phase adds revalidation, plug in the R2 incremental cache here:
 * https://opennext.js.org/cloudflare/caching
 */
export default defineCloudflareConfig({});
