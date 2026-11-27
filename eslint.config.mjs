import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Folder boundaries between frontend and backend (docs/backend/backend-plan.md, sections 3.3 and 4).
// Imports are matched by their text, which covers both "@/…" and relative paths.
// This checks `import` and `export … from`, not `import()`.
const into = (...folders) =>
  `^(@/|(\\.\\.?/)+(.*/)?)(${folders.join("|")})(/|$)`;
const ban = (regex, message) => ({ regex, message });
const boundary = (files, ...patterns) => ({
  files,
  rules: { "no-restricted-imports": ["error", { patterns }] },
});

const screenFolders = [
  "app",
  "features",
  "components",
  "services",
  "demo",
  "demo-state",
];
const framework = "^(react|react-dom|next)(/|$)";

const serverBans = [
  ban(
    into(...screenFolders),
    "Backend code must not import screens or demo data.",
  ),
  ban(into("workers"), "Shared backend code must not import the Jobs Worker."),
];
const sharedBans = [
  ban(
    into(...screenFolders),
    "Shared code must not import screens or demo data.",
  ),
  ban(
    into("server", "workers"),
    "Shared code reaches the browser, so it must not import backend code.",
  ),
  ban(framework, "Shared code must not depend on React or Next.js."),
];

const folderBoundaries = [
  boundary(
    ["src/{components,features,services,demo,demo-state,lib,types}/**"],
    ban(
      into("server", "workers"),
      "Screens must not import backend code. Share rules in src/domain and data shapes in src/contracts.",
    ),
  ),
  boundary(
    ["src/app/**"],
    ban(into("workers"), "The web app must not import the Jobs Worker."),
    ban(
      into("server/db"),
      "Reach the database through src/server/next or src/server/modules.",
    ),
  ),
  boundary(
    ["src/server/**"],
    ...serverBans,
    ban("^next(/|$)", "Only src/server/next may import Next.js."),
    ban(
      "^(@/server/next|(\\.\\.?/)+(.*/)?next)(/|$)",
      "Jobs has no Next.js, so only the web app may import src/server/next.",
    ),
  ),
  // Must come after the src/server rule: it replaces it for this folder.
  boundary(["src/server/next/**"], ...serverBans),
  boundary(["src/domain/**", "src/contracts/**"], ...sharedBans),
  boundary(
    ["workers/**"],
    ban(
      into(...screenFolders),
      "The Jobs Worker must not import screens or demo data.",
    ),
    ban(framework, "The Jobs Worker has no React or Next.js."),
    ban(
      into("server/next"),
      "src/server/next needs Next.js, which the Jobs Worker does not have.",
    ),
  ),
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...folderBoundaries,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-*/**",
    "out/**",
    "build/**",
    ".open-next/**",
    "**/.wrangler/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
