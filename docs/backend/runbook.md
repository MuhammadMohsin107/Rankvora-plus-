# Runbook: configure, deploy, verify

## Before anything goes live

1. **Workers plan.** The account is on Free: 10 ms CPU per request. Password hashing (native scrypt,
   about 32 MB of memory per hash) needs far more, so **sign-up and sign-in are expected to fail**.
   Upgrade to Workers Paid before turning accounts on. Free also limits D1 to 500 MB and 50 queries
   per request. Do not solve this by weakening the password hash.
2. **Account pages exist** (sign-up, sign-in with two-step codes, confirmation, password reset,
   invitations, new organization). Confirming an email takes the password.
3. **Live has the tables but no secrets yet.** `0001` to `0005` were applied on 2026-11-26. Checked
   afterwards: same structure as the tested database (37 tables, 64 indexes, 35 triggers), all new
   tables empty, no broken links, the 45 rows of the old `workspaces` table unchanged (the app no
   longer uses it). The backup taken just before is outside the repo, in the owner's
   `Documents/rankvora-backups/`; Time Travel bookmark before the change:
   `00000066-00000000-0000512f-4e8ead6d4764d4c1b28f6fcc6e73dcba` (kept for a limited time). History
   tables are append-only: test rows written to live stay there.

Pushing `main` deploys the code. **Until the settings below are in place, the whole live app shows only
"Accounts are not set up on this server yet"**: the earlier demo screens were removed.

## Settings

Names and meanings are in [.dev.vars.example](../../.dev.vars.example). This login has two Cloudflare
accounts, so set `CLOUDFLARE_ACCOUNT_ID=4a36991256542f145b006329cb04abd3` for wrangler commands.

**Never put a secret in a `.env` file.** The OpenNext build copies `.env*` files into the Worker.
On a PC, secrets go in `.dev.vars` (ignored by git, not copied by the build).

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put APP_URL
npx wrangler secret put MAIL_TRANSPORT      # resend
npx wrangler secret put MAIL_FROM
npx wrangler secret put RESEND_API_KEY
```

Email: set up your sending domain with the provider. Cloudflare Email Service is in beta and on Free
delivers only to addresses you have verified. Resend's free tier allows 100 emails a day.

## Apply the migrations (changes the live database)

```bash
npx wrangler d1 export rankvora-plus --remote --output backup.sql   # keep this file out of git
npx wrangler d1 time-travel info rankvora-plus                      # note the bookmark
npx wrangler d1 migrations apply DB --remote
```

Then open `/api/v1/health`. All checks must be `true`.

## Test database

`rankvora-plus-test` (id `8c420681-f5e4-4356-9d2a-904918f73f13`, APAC) has all migrations applied and
holds the test data of 2026-11-25 and 2026-11-26, which must never be copied to live. Delete it with
`npx wrangler d1 delete rankvora-plus-test` when it is no longer needed.

To run the app against it without touching live: copy `wrangler.jsonc` to a file outside the repo,
change the Worker name and the service binding to `rankvora-plus-test`, use the test database name
and id with `"remote": true`, set `account_id`, make `main`, `assets.directory` and `migrations_dir`
absolute paths, and add vars `APP_URL=http://localhost:8787`, `MAIL_TRANSPORT=console`. Put a random
`BETTER_AUTH_SECRET` in a `.dev.vars` beside it. Then run `npx opennextjs-cloudflare build` (with
`DEPLOY_TARGET=cloudflare`) and `npx wrangler dev --config <that file> --port 8787`.

## Verification checklist

✔ passed in the live tests of 2026-11-25 and 2026-11-26 · ☐ not run. Details in
[status.md](status.md#live-tests).

**Authentication.** ✔ Sign up, confirm, sign in, sign out, wrong password, unconfirmed account,
revoked sessions, reset ends sessions, existing address, two-factor and backup codes, sole owner
cannot delete the account, expired sessions, reset links and confirmation links, confirming takes the
password, a stranger signing up with someone else's address gains nothing, attempt limit.

**Tenant isolation.** ✔ Customer B gets 404 on A's organization, members, invitations, history, logs,
usage, websites and domains, and cannot add a website to it. ✔ The role table in [api.md](api.md) on
every built endpoint.

**Team.** ✔ Invited address only; revoked, rejected, reused and expired links fail; an invitation fails
once its sender is demoted or removed; the last owner cannot leave or step down; the daily limit per
recipient holds; the member limit holds, also with simultaneous requests.

**Websites.** ✔ Create, edit, stale `version`, website limit, duplicate domain, each lifecycle step and
each refused one, remove, domain alias, main-domain change and history, expired DNS record,
simultaneous requests. ☐ Verify a real domain you own with the TXT record; a second organization
cannot verify the same one.

**Logs.** ✔ `activity_logs` and `security_audit_logs` refuse updates and deletes. ☐ `usage_ledger`
(it has no rows yet).

**Brand, competitors, products, prompts.** ✔ Brand versions and facts with evidence and verification
rules; competitors with suggestion, confirmation and history; optional products; prompt versions,
approval, assignments, duplicates, CSV import, bulk actions and the active limit; domain HTTPS and
redirect checks; roles, other-customer refusals and simultaneous requests; append-only history.
☐ Runs that use these (Phase 3).

## Operator actions (no admin screen yet)

```sql
-- Suspend an organization (it can be read, not changed). Reinstate with status = 'active'.
update organizations set status = 'suspended', suspended_reason = '<reason>',
  suspended_at = cast(unixepoch('subsec') * 1000 as integer) where id = '<org id>';

-- Suspend an account and sign it out.
update users set status = 'suspended' where id = '<user id>';
delete from user_sessions where user_id = '<user id>';

-- Change one organization's limits.
update organization_entitlements set max_websites = 20, source = 'manual',
  updated_at = cast(unixepoch('subsec') * 1000 as integer) where organization_id = '<org id>';
```

Run with `npx wrangler d1 execute DB --remote --command "<sql>"`. Do not rotate `BETTER_AUTH_SECRET`
casually: it signs sessions and encrypts two-factor secrets.
