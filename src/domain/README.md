# src/domain — shared rules

Pure rules used by both the screens and the backend, such as metrics, comparison, schedules and text handling.
No code exists here yet.

Rules (`npm run lint` checks the import rules):

- No React, Next.js, database, backend or screen imports.
- Never add secrets: this code can reach the browser.

Planned layout: `docs/backend/backend-plan.md`, section 4.
