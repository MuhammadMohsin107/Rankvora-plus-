# API v1: Phase 1

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

`GET /health` (public) answers 200 only when the database, migrations, auth secret, app URL and email
are all ready.

## Roles

| Permission | Owner | Admin | Manager | Member | Viewer |
| --- | :-: | :-: | :-: | :-: | :-: |
| Read organization, members, websites and module results | ● | ● | ● | ● | ● |
| Edit prompts and tasks, start audits, comparisons, export reports | ● | ● | ● | ● | |
| Edit website profile, configure monitoring, **approve fixes**, history, usage, integrations (view) | ● | ● | ● | | |
| Organization settings, team, add websites, lifecycle, domains, integrations, **publish fixes**, security log, view billing | ● | ● | | | |
| Delete organization, remove website, manage billing, manage owners | ● | | | | |

The exact list is `src/server/tenancy/permissions.ts`. Module permissions are defined for later phases.

## Limits (`src/server/config/limits.ts`)

**These are defaults I chose; confirm or change them.** Per organization: 5 websites, 10 members
(open invitations count), 100 active prompts, 1,000 AI requests and 1,000 search calls a month.
Also: 5 owned organizations per user, 20 active domains per website. Invitations last 7 days; at most
5 sends each, one a minute, and per day 30 per organization, 30 per sender and 5 per recipient.
