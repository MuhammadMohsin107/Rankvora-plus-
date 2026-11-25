# Runbook: configure, deploy, verify

## Before anything goes live

1. **Workers plan.** The account is on Free: 10 ms CPU per request. Password hashing (native scrypt,
   about 32 MB of memory per hash) needs far more, so **sign-up and sign-in are expected to fail**.
   Upgrade to Workers Paid before turning accounts on. Free also limits D1 to 500 MB and 50 queries
   per request. Do not solve this by weakening the password hash.
2. **No UI pages yet.** The invitation email links to `/invitations/accept` and a password reset needs
   a page for the new password. Neither exists, so do not send these to real people yet.
3. **Websites are untested.** The migrations are applied to the test database only; live has `0001` to
   `0003` pending. Finish the checklist below before using live. History tables are append-only: test
   rows written to live stay there.

Pushing `main` deploys the code. Without the settings below the new API answers "not configured";
the existing demo screens are unaffected.

## Settings

Names and meanings are in [.dev.vars.example](../../.dev.vars.example). This login has two Cloudflare
accounts, so set `CLOUDFLARE_ACCOUNT_ID=4a36991256542f145b006329cb04abd3` for wrangler commands.

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
holds the test accounts from 2026-11-25. Delete it with `npx wrangler d1 delete rankvora-plus-test`
when it is no longer needed.

To run the app against it without touching live: copy `wrangler.jsonc` to a file outside the repo,
change the Worker name and the service binding to `rankvora-plus-test`, use the test database name
and id with `"remote": true`, set `account_id`, make `main`, `assets.directory` and `migrations_dir`
absolute paths, and add vars `APP_URL=http://localhost:8787`, `MAIL_TRANSPORT=console`. Put a random
`BETTER_AUTH_SECRET` in a `.dev.vars` beside it. Then run `npx opennextjs-cloudflare build` (with
`DEPLOY_TARGET=cloudflare`) and `npx wrangler dev --config <that file> --port 8787`.

## Verification checklist

✔ passed in the live test of 2026-11-25 · ☐ not run. Details in [status.md](status.md#live-test-2026-11-25).

**Authentication.** ✔ Sign up, confirm, sign in, sign out, wrong password, unconfirmed account,
revoked sessions, reset ends sessions, existing address, two-factor and backup codes, sole owner
cannot delete the account. ☐ Expired sessions and links.

**Tenant isolation.** ✔ Customer B gets 404 on A's organization, members, invitations, history, logs
and usage, and cannot add a website to it. ✔ Viewer and admin refusals. ☐ A's websites and domains.
☐ Every row of the role table in [api.md](api.md).

**Team.** ✔ Invited address only; revoked, rejected and reused links fail; an invitation fails once
its sender is demoted or removed; the last owner cannot leave or step down; the daily limit per
recipient holds. ☐ Expired links, member limit, simultaneous requests.

☐ **Websites.** Create, edit, stale `version`, website limit, duplicate domain, each lifecycle step and
each refused one, remove. Domain alias, main-domain change and history. Verify a real domain you own
with the TXT record; a second organization cannot verify the same one.

**Logs.** ✔ `activity_logs` and `security_audit_logs` refuse updates and deletes. ☐ `usage_ledger`
(it has no rows yet).

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
