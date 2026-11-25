import { defineConfig } from "drizzle-kit";

/**
 * Cloudflare D1 migrations. `drizzle-kit generate` writes plain SQL files into
 * ./migrations, the folder wrangler reads (`migrations_dir` in wrangler.jsonc).
 * They are applied with `wrangler d1 migrations apply`, not drizzle-kit migrate,
 * so no credentials are needed here.
 */
export default defineConfig({
  dialect: "sqlite",
  // `db-d1` is the older demo-state table; `server/db` is the application schema.
  schema: ["./src/db-d1/schema.ts", "./src/server/db/schema/index.ts"],
  out: "./migrations",
});
