# API v1: Phases 1 and 2

Cookie sessions. Every write needs an `Origin` header matching the host and a JSON body.
Records of another organization answer **404**; a missing permission answers **403**.

- App endpoints: `{ "data": ... }` or `{ "error": { code, message, fields?, details?, requestId } }`.
- Authentication endpoints keep Better Auth's shape (`{ code, message }`) so its client library works.
- Create endpoints accept `Idempotency-Key` (8-128 characters, kept 24 hours).
- Edits send the `version` they read; a stale one answers `409 version_conflict`.
- Logs are paged with `?limit=` (1-100) and `?cursor=`.

## Authentication (`/api/v1/auth`)

| Method and path | Body or note |
| --- | --- |
| POST `/sign-up/email` | `name`, `email`, `password` (12-128) |
| GET `/verify-email?token=` | Link in the email. Does not sign in |
| POST `/send-verification-email` | `email` |
| POST `/sign-in/email` · POST `/sign-out` · GET `/get-session` | |
| POST `/request-password-reset` · POST `/reset-password` | `email`, `redirectTo` · `token`, `newPassword`. Ends all sessions |
| POST `/change-password` · POST `/update-user` | |
| GET `/list-sessions` · POST `/revoke-session` · `/revoke-sessions` · `/revoke-other-sessions` | The last answers `{ data: { revoked } }` |
| POST `/two-factor/enable` · `/disable` · `/verify-totp` · `/verify-backup-code` | |
| POST `/delete-user` | `password`, or a session under 15 minutes old |
| GET `/me` | `{ user, organizations }` |

## Organizations and team

| Method and path | Permission | Body |
| --- | --- | --- |
| GET, POST `/organizations` | signed in | `name`, `timezone` |
| GET `/organizations/:id` | organization.read | |
| PATCH `/organizations/:id` | organization.update | `version`, `name?`, `timezone?` |
| DELETE `/organizations/:id` | organization.delete | `confirmName` |
| POST `/organizations/:id/leave` | any member | |
| GET `.../members` | member.read | |
| PATCH, DELETE `.../members/:memberId` | member.manage | `role?`, `status?` |
| GET, POST `.../invitations` | member.manage | `email`, `role` |
| DELETE `.../invitations/:invitationId` · POST `.../resend` | member.manage | |
| POST `/invitations/lookup` · `/accept` · `/reject` | the invited, verified email | `token` |
| GET `.../activity` | activity.read | |
| GET `.../security-log` | security_log.read | |
| GET `.../usage` | usage.read | |

## Websites

| Method and path | Permission | Body |
| --- | --- | --- |
| GET `/websites?organizationId=&status=` | website.read | |
| POST `/websites` | website.create | `organizationId`, `name`, `domain`, `siteType`, `market`, `language`, `timezone`, `businessCategory?`, `businessDescription?` |
| GET `/websites/:id` | website.read | |
| PATCH `/websites/:id` | website.update | `version` and any profile field |
| DELETE `/websites/:id` | website.remove | `version`, `confirmName`; archived websites only |
| POST `/websites/:id/status` | website.lifecycle | `action` (activate, pause, resume, archive, restore), `version` |
| GET `/websites/:id/activity` | activity.read | |
| GET `.../domains` | website.read | Active domains, history, open verification records |
| POST `.../domains` | website.domain.manage | `domain`, `kind` (alias, redirect) |
| DELETE `.../domains/:domainId` | website.domain.manage | `reason?` |
| POST `.../domains/main` | website.domain.manage | `domain`, `version`, `reason?` |
| POST `.../domains/:domainId/verification` | website.verify | Returns the DNS TXT record to publish |
| POST `.../verification/check` | website.verify | `{ verified: true }`, or `{ verified: false, reason }` |

Lifecycle: draft → active ⇄ paused. Draft, active or paused → archived → restore (to draft if it was
draft, otherwise paused). Only archived → removed.

| Method and path | Permission | Body or note |
| --- | --- | --- |
| POST `.../domains/:domainId/checks` | website.domain.manage | Requests the domain now: HTTPS, whether HTTP upgrades, each redirect, whether it leaves the website. Once per 10 seconds |
| GET `.../domains/:domainId/checks` | website.read | The last 20 results |

Every hop of a domain check must be http or https on the default port, on a public host whose DNS
addresses are all public. No cookies are sent and bodies are not read.

## Brand knowledge (`/websites/:id/brand`)

| Method and path | Permission | Body |
| --- | --- | --- |
| GET `.../brand` | website.read | `{ current, versions }` |
| POST `.../brand` | website.update | `baseVersion` (0 for the first), `officialName`, `displayNames?`, `aliases?`, `abbreviations?`, `description?`, `targetAudience?`, `differentiators?`, `voice?`, `contentSummary?`, `changeNote?`. Each save is a new immutable version |
| GET, POST `.../brand/facts` | read · update | `kind` (business, product, faq), `productId` (product facts only), `label` (the question for FAQs), `value`, `origin?` (owner, website, imported), `sources?` `[{url,title?,note?}]` |
| PATCH, DELETE `.../brand/facts/:factId` | website.update | `version`, `label?`, `value?`, `note?` · `version` |
| POST `.../facts/:factId/status` | website.update | `version`, `status` (unverified, verified, contradicted, outdated, needs_review), `basis` when verified (source, owner_confirmation), `note?` |
| POST `.../facts/:factId/sources` · DELETE `.../sources/:sourceId` | website.update | `version`, `url`, `title?`, `note?` · `version` |
| GET `.../facts/:factId/history` | website.read | Every version |
| GET, POST `.../brand/source-pages` | read · update | `url` (on one of the website's domains), `title`, `pageType?`, `confirmed?` |
| PATCH, DELETE `.../brand/source-pages/:pageId` | website.update | `title?`, `pageType?`, `confirmed?` |

A fact is **verified** only with a linked source (`basis: source`) or an owner or admin vouching for it
(`owner_confirmation`, permission brand.confirm). Editing a verified fact, or removing the last source
that verified it, sets it to **needs_review**.

## Competitors and products (`/websites/:id/...`)

| Method and path | Permission | Body |
| --- | --- | --- |
| GET, POST `/competitors` | read · website.update | `name`, `domains?`, `aliases?`, `market?` (null: all), `businessCategory?`, `evidence?`, `evidenceUrl?`, `status?` (confirmed, suggested), `source?` (owner, imported) |
| PATCH, DELETE `/competitors/:cid` | website.update | `version` and any field · `version` |
| POST `/competitors/:cid/status` | website.update | `version`, `action` (confirm, archive, restore). A dismissed suggestion restores to suggested |
| GET `/competitors/:cid/history` | activity.read | Snapshots, including removal |
| GET, POST `/products-services` | read · website.update | `kind` (product, service, other), `name`, `category?`, `description?`, `attributes?` `[{name,value}]`, `urls?`, `price?` `{amount,currency}`, `availability?`, `source?`, `sourceUrl?` (required when source is website) |
| PATCH, DELETE `/products-services/:pid` | website.update | `version` and any field · `version` |
| POST `/products-services/:pid/status` | website.update | `version`, `action` (archive, restore) |
| GET `/products-services/:pid/history` | activity.read | Snapshots |

Competitor domains are stored without `www.`, cannot be the website's own domains, and one domain
belongs to one competitor.
Products are optional; nothing requires them.

## Prompt library

| Method and path | Permission | Body or note |
| --- | --- | --- |
| GET `/websites/:id/prompts` | prompt.read | `?q=&status=&intent=&scope=&groupId=(id or none)&tag=&isCore=&limit=&cursor=`. Also returns counts and the active limit |
| POST `/websites/:id/prompts` | prompt.write | `text` (8-300), `intent`, `topic?`, `groupId?`, `market?`, `language?`, `searchMode?`, `scope?`, `status?` (draft, active, paused), `isCore?`, `source?` (manual, template, research_derived), `tags?`, `productIds?`, `changeSummary?`, `approve?`. Returns near-duplicates |
| POST `/websites/:id/prompts/bulk` | prompt.write | `action` (activate, pause, archive, restore, move_to_group, add_tags, remove_tags), `promptIds` (up to 100), `groupId?`, `tags?`. Returns applied and skipped with reasons |
| POST `/websites/:id/prompts/import` | prompt.write | `csv`, `dryRun` (default true), `searchMode?`. Columns: prompt_text, intent, topic, group, language, country, status, tracking_scope, is_core, search_mode, tags (`;`). Up to 500 rows; all or nothing |
| GET, POST `/websites/:id/prompt-groups` · PATCH, DELETE `/prompt-groups/:gid` | read · write | `name` · `version`, `name` · `version`. Deleting ungroups its prompts |
| GET, PATCH `/prompts/:pid` | read · write | PATCH: `version`, `intent?`, `topic?`, `groupId?`, `scope?`, `isCore?`, `tags?`, `productIds?` |
| DELETE `/prompts/:pid` | prompt.delete | `version`; archived prompts only. A soft delete: versions and history stay |
| POST `/prompts/:pid/status` | prompt.write | `version`, `action` (activate, pause, resume, archive, restore). Restore gives a draft |
| GET, POST `/prompts/:pid/versions` | read · write | `version`, `text?`, `market?`, `language?`, `searchMode?`, `changeSummary?`, `approve?` |
| POST `/prompts/:pid/versions/:vid/approve` | prompt.approve | |
| GET, POST `/prompts/:pid/assignments` | read · see note | `purpose` (audit, monitoring), `versionRule?` (latest_approved, pinned), `pinnedVersionId?`, `providers` (openai, gemini, perplexity), `samples?` (1-10), `markets?`, `languages?`, `searchModes?`. Returns the version that would run and why not |
| PATCH, DELETE `/prompts/:pid/assignments/:aid` | see note | `version` and any setting · `version` |
| GET `/prompts/:pid/activity` | activity.read | |

**Approval.** Only approved wording can run. Anyone who may write prompts can draft; approving, and so
activating unapproved wording, needs prompt.approve. A new version of an active prompt stays
unapproved until approved: `latest_approved` assignments keep running the previous approved version, and
`pinned` ones never move. An assignment needs audit.create (audit) or monitoring.configure
(monitoring). Model choice and AI suggestions arrive with providers (Phase 3).

`GET /health` (public) answers 200 only when the database, migrations, auth secret, app URL and email
are all ready.

## Roles

| Permission | Owner | Admin | Manager | Member | Viewer |
| --- | :-: | :-: | :-: | :-: | :-: |
| Read organization, members, websites and module results | ● | ● | ● | ● | ● |
| Edit prompts and tasks, start audits, audit assignments, comparisons, export reports | ● | ● | ● | ● | |
| Edit website profile, brand knowledge, competitors and products; **approve and delete prompts**; configure monitoring, **approve fixes**, history, usage, integrations (view) | ● | ● | ● | | |
| Organization settings, team, add websites, lifecycle, domains, **confirm facts without a source**, integrations, **publish fixes**, security log, view billing | ● | ● | | | |
| Delete organization, remove website, manage billing, manage owners | ● | | | | |

The exact list is `src/server/tenancy/permissions.ts`. Module permissions are defined for later phases.

## Limits (`src/server/config/limits.ts`)

**These are defaults I chose; confirm or change them.** Per organization: 5 websites, 10 members
(open invitations count), 100 active prompts, 1,000 AI requests and 1,000 search calls a month.
Inviting, reviving an expired invitation and reactivating a member each need a free seat
(`409 member_limit_reached`). Reactivation does not count the person's own open invitation, and closes it.

Per website (also defaults to confirm): 500 facts, 10 sources a fact, 200 source pages, 50 competitors
with 10 domains each, 500 products and services, 100 prompt groups, 2,000 prompts, 10 tags and 20
products per prompt. Bulk actions take 100 prompts; CSV imports 500 rows (512 KB).
Also: 5 owned organizations per user, 20 active domains per website. Invitations last 7 days; at most
5 sends each, one a minute, and per day 30 per organization, 30 per sender and 5 per recipient.
