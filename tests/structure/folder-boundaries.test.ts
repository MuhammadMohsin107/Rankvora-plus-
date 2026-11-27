import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

// Checks the frontend/backend import rules in eslint.config.mjs against example imports.
// The example files do not need to exist.
const eslint = new ESLint({
  cwd: fileURLToPath(new URL("../..", import.meta.url)),
});

async function isBlocked(file: string, imported: string) {
  const [result] = await eslint.lintText(
    `import ${JSON.stringify(imported)};\n`,
    { filePath: file },
  );
  return result.messages.some((m) => m.ruleId === "no-restricted-imports");
}

const blocked: [file: string, imported: string][] = [
  ["src/features/x/a.ts", "@/server/modules/prompts"],
  ["src/components/a.ts", "../server/db/client"],
  ["src/lib/a.ts", "../../workers/jobs/src/index"],
  ["src/demo-state/a.ts", "@/server/core/env"],
  ["src/app/a.ts", "@/server/db/client"],
  ["src/app/a.ts", "../../workers/jobs/src/index"],
  ["src/server/modules/x/a.ts", "next/headers"],
  ["src/server/modules/x/a.ts", "@/components/ui/card"],
  ["src/server/modules/x/a.ts", "@/server/next/actor"],
  ["src/server/modules/x/a.ts", "../../next/actor"],
  ["src/server/next/a.ts", "@/features/prompts/text"],
  ["src/domain/metrics/a.ts", "react"],
  ["src/domain/metrics/a.ts", "next/navigation"],
  ["src/domain/metrics/a.ts", "@/server/core/ids"],
  ["src/contracts/a.ts", "@/features/prompts/text"],
  ["src/contracts/a.ts", "@/server/db/client"],
  ["workers/jobs/src/a.ts", "@/features/prompts/text"],
  ["workers/jobs/src/a.ts", "../../../src/components/ui/card"],
  ["workers/jobs/src/a.ts", "@/server/next/actor"],
  ["workers/jobs/src/a.ts", "next/server"],
];

const allowed: [file: string, imported: string][] = [
  ["src/features/x/a.ts", "@/domain/metrics"],
  ["src/features/x/a.ts", "@/contracts/prompts"],
  ["src/features/x/a.ts", "react-dom/server"],
  ["src/app/a.ts", "@/server/next/loaders"],
  ["src/app/api/v1/prompts/route.ts", "@/server/http/handler"],
  ["src/server/next/a.ts", "next/headers"],
  ["src/server/modules/x/a.ts", "@/server/db/client"],
  ["src/server/modules/x/a.ts", "@/domain/metrics"],
  ["src/domain/metrics/a.ts", "@/domain/status"],
  ["src/contracts/a.ts", "@/domain/status"],
  ["workers/jobs/src/a.ts", "@/server/modules/runs"],
  ["workers/jobs/src/a.ts", "@/domain/metrics"],
];

describe("frontend and backend folder boundaries", () => {
  // The first lint loads the whole ESLint setup. On a cold start that can pass the normal test time limit.
  beforeAll(async () => {
    await isBlocked("src/features/x/a.ts", "@/domain/metrics");
  }, 120_000);

  it.each(blocked)("blocks %s from importing %s", async (file, imported) => {
    expect(await isBlocked(file, imported)).toBe(true);
  });

  it.each(allowed)("lets %s import %s", async (file, imported) => {
    expect(await isBlocked(file, imported)).toBe(false);
  });

  it("can load the server-only guard outside Next.js", async () => {
    await expect(import("server-only")).resolves.toBeDefined();
  });
});
