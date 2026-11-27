# workers/jobs — Jobs Worker (backend)

The second Cloudflare Worker, for background work and AI provider calls. **It is a placeholder:** it has no
bindings and no background work, and it has not been deployed.

- No public address (`workers_dev` and `preview_urls` are off, and there are no routes).
- It may use `src/server`, `src/domain` and `src/contracts`. It must not use screens or Next.js.
- `wrangler.jsonc` swaps the `server-only` guard for `shims/server-only.ts`. Without this, the real guard
  throws as soon as the Worker starts. A successful build does not catch that, so also start the Worker.
- It has its own type check, with Worker settings instead of the web app's browser settings.
  `npm run typecheck` checks both. The `WebWorker` types are a stand-in until `wrangler types` is added.

Planned layout: `docs/backend/backend-plan.md`, sections 4 and 14.2.
