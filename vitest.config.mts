import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js handles this guard in the app; tests run without Next.js, so they get an empty file.
      "server-only": fileURLToPath(
        new URL("./workers/jobs/shims/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    // List every folder that may hold tests: a test outside this list is skipped without any warning.
    include: [
      "src/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "workers/**/*.test.{ts,tsx}",
    ],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
