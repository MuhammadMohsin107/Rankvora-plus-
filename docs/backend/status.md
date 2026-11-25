# Backend status against the blueprint (2026-11-25)

**Built** means the code exists. Marks: ✅ built · 🟡 partly built · ⬜ not started. A ✅ is not by
itself proof; what has actually been run is listed under [Live test](#live-test-2026-11-25).

## Live test (2026-11-25)

How: the Cloudflare build ran on a local PC in the Workers runtime (`wrangler dev`), saving to a separate
remote D1 database, `rankvora-plus-test`. Emails were printed to the terminal. Requests were sent from
visible browser windows, one per person. The live site and live database were not changed.

**Result: 130 of 130 checks passed. No code change was needed.**

| Area | Checks | Covered |
| --- | :-: | --- |
| Signed out and cross-site | 5 | Protected endpoints; foreign-origin write refused |
| Accounts | 15 | Sign-up, confirmation, sign-in refusals, existing address, no sign-in on confirm |
| Organizations | 16 | Create, double-submit replay, key reuse, bad input, stale edit, usage, history |
| Isolation between customers | 17 | 15 reads and writes on another customer's organization all answered 404; data unchanged |
| Team | 43 | Invitations, roles, last owner, invitation dies with its sender's authority, daily email limit, deactivation, logs and paging |
| Account security | 34 | Device list and sign-out, password reset, two-factor and backup codes, account and organization deletion |

Also confirmed: D1 accepted all four migrations (19 tables, 36 indexes, 12 triggers); update and delete
were refused on `activity_logs` and `security_audit_logs`; no foreign-key violations; no organization
without an owner; passwords and invitation tokens stored only hashed; no test password in logs; no
server error in the app log.

**Not run:** every website and domain feature (including DNS ownership), real email delivery, the Free
plan CPU limit (the local runtime does not enforce it), a deployment, usage reserve and settle, the
other triggers, simultaneous requests, and expiry after days. There are no automated tests in the repo.

## Roadmap (Part 24)

| Phase | State | Note |
| --- | --- | --- |
| 0 Discovery | ✅ | [phase-0-discovery.md](phase-0-discovery.md), [traceability.md](traceability.md) |
| 1 Foundation | 🟡 | Accounts, organizations, team and isolation between organizations passed the live test. Exit condition **not yet proven**: websites are untested |
| 2-11 | ⬜ | Not started |

## Parts 1-3: scope, discovery, architecture

| Point | State | Note |
| --- | --- | --- |
| 1.3 No fake data or success in the backend | ✅ | No seed data. A failed sign-up or invitation email is reported. The old demo UI is unchanged and still shows demo data |
| 2.1-2.2 Stack and repository inspection | ✅ | `pg` and PostgreSQL are no longer in the project |
| 2.3 Traceability | 🟡 | Phase 1 per action; later modules per action group |
| 3.1 Modular monolith | ✅ | `src/server` (modules), `src/app/api/v1` (routes) |
| 3.2 Database | ✅ | **D1 only** (owner's decision; replaces the PostgreSQL and Hyperdrive recommendation) |
| 3.3 Queues, Workflows, Cron, R2 | ⬜ | Phase 3 onward |
| 3.3 Secrets and observability | 🟡 | Secrets via Worker secrets; structured logs with request ids. No error tracking, tracing or alerts |

## Part 4: authentication and tenancy

| Point | State | Note |
| --- | --- | --- |
| 4.1 Register, verify email, sign in, sign out, reset password | ✅ | API only. Needs an email provider. No UI pages yet |
| 4.1 Password storage | ✅ | scrypt (Better Auth). **Expected to exceed the Free plan CPU limit** |
| 4.1 Sessions: create, expire (7 days), revoke, device list | ✅ | The expiry slides daily; the session token itself is not rotated |
| 4.1 Optional MFA | ✅ | TOTP and backup codes |
| 4.1 Account status | 🟡 | Suspension is enforced; there is no operator screen (SQL in the runbook) |
| 4.1 Account deletion | ✅ | Blocked for a sole owner |
| 4.2 Organizations, members, invitations with expiry, removal | ✅ | |
| 4.2 Organization switching | 🟡 | Every request names its organization; the switcher UI is not wired |
| 4.2 Suspension | 🟡 | Writes blocked; operator action by SQL |
| 4.2 Organization audit log | ✅ | Append-only |
| 4.3 Five roles, granular permissions, separate approval | ✅ | The matrix is code (`tenancy/permissions.ts`), not `roles`/`permissions` tables |
| 4.4 Tenant isolation in APIs and queries | ✅ | Guard scopes, plus composite foreign keys. Organizations tested; **websites not yet** |
| 4.4 Isolation in jobs, providers, exports, R2, webhooks | ⬜ | Those do not exist yet. API responses are `no-store` |

## Part 5: websites and brands

| Point | State | Note |
| --- | --- | --- |
| 5.1 Add, edit, verify ownership, pause, resume, archive, restore, remove, history | ✅ | Removal is a soft delete of an archived website |
| 5.2 Profile fields | 🟡 | All except tracking configuration (Phase 3/6) |
| 5.3 Canonical validation, DNS ownership, aliases, redirects, former domains, history, change log | ✅ | |
| 5.3 HTTPS check, redirect inspection | ⬜ | Needs the SSRF-safe fetcher (Phase 2) |
| 5.3 Runs keep the domain used at the time | ⬜ | No runs yet (Phase 3) |
| 5.4 Brand knowledge · 5.5 Competitors · 5.6 Products | ⬜ | Phase 2 |

## Parts 6-16

| Part | State | Phase |
| --- | --- | --- |
| 6 Prompt Library | ⬜ | 2 |
| 7 Providers (OpenAI, Gemini, Perplexity) · 8 Response analysis | ⬜ | 3, 4 |
| 9 Crawler, PageSpeed, CrUX, Search Console · 10 Audit · 11 Findings | ⬜ | 5 (Search Console also 10) |
| 12 Fixes · 13 Monitoring · 14 Comparison · 15 Reports | ⬜ | 6, 7, 8, 9 |
| 16 CMS and analytics integrations | ⬜ | 5, 6, 10 |

## Parts 17-18: team, notifications, billing

| Point | State | Note |
| --- | --- | --- |
| 17.1 Team | ✅ | Invite, accept, reject, roles, deactivate, remove, history |
| 17.2 Notifications · 17.4 Support tickets | ⬜ | Phase 9; support scope undecided |
| 17.3 Email | 🟡 | Resend and Cloudflare transports; verification, reset, invitation and "account exists" mail. No alert, billing or security mail, bounces or webhooks |
| 18.1 Subscriptions, payment provider | ⬜ | Phase 10 |
| 18.2 Limits | 🟡 | Website and member limits enforced. Prompt, AI and search limits stored. Other limits not modelled |
| 18.3-18.4 Usage ledger, reserve, settle, release | 🟡 | Built; nothing calls it until Phase 3. Cost estimation and limit notices not built |

## Parts 19-20: data and API

| Point | State | Note |
| --- | --- | --- |
| Identity, website domain and usage tables, logs, idempotency | ✅ | `migrations/0001`-`0003`. Website profile and settings are columns on `websites` |
| Foreign keys, unique rules, indexes, atomic writes, immutable history | ✅ | |
| Retention policy | ⬜ | **Needs your decision**; logs cannot be pruned without a migration |
| Outbox table | ⬜ | Arrives with queues (Phase 3) |
| Backup and restore | 🟡 | Commands in the runbook; restore never tried |
| Other entity groups | ⬜ | With their phases |
| 20 API: auth, organizations, websites, domains | ✅ | [api.md](api.md). Auth paths use Better Auth's names |
| 20 API: other groups | ⬜ | With their phases |

## Parts 21-23, 25: security, operations, QA, done

| Point | State | Note |
| --- | --- | --- |
| Auth, roles, object-level checks, secure cookies, CSRF, input validation, email escaping, account deletion | ✅ | Mostly covered by the live test. Secure cookies (HTTPS) and email HTML not exercised |
| Rate limiting | 🟡 | Auth endpoints and invitation emails. No general API limit (Phase 11) |
| Provider credential encryption, webhook signatures, SSRF, file access, exports, customer data export, provider terms review, secret rotation | ⬜ | Their phases, or Phase 11 |
| 22 Structured logs, request ids, error codes | ✅ | Metrics, job and queue monitoring, outbox ⬜ |
| 23 QA | 🟡 | One manual live test: 23.1 and the organization part of 23.2. 23.3 not run. No automated tests |
| 25 Definition of done | ⬜ | Not met |

## Other checks

Type check, ESLint, `next build` and the OpenNext Cloudflare build. An independent read-only code
review found no fault in the hand-written SQL and reported 16 other findings, among them an invitation
that outlived its sender's access and a pre-registration account takeover. All 16 have changes; the
takeover is **reduced, not closed** (below). The changes have not had a second review; the live test
exercised the invitation fix.

## Known limits that remain

- **Sign-up with someone else's address.** If a stranger signs up with your email and you open the
  confirmation link, their password still works until you reset it. Confirming no longer signs anyone
  in, a sign-in attempt no longer resends the link, and the email says not to open it if you did not
  sign up. Closing it fully means choosing or re-entering the password on the confirmation page, which
  needs the UI pages. Do this before real users sign up.
- Password reset and resend-confirmation answer the same even if the email fails (otherwise they
  reveal which addresses have accounts). The failure is written to the security log. The response time
  of resend-confirmation can still differ.
- Account deletion can be left half done if two requests of the same account race in a very narrow window.
- A repeated `Idempotency-Key` is replayed before permissions are re-checked: for 24 hours a removed
  member can still get their own earlier response.
- Signed-in users can add many "permission denied" log rows.
- Expired idempotency and rate-limit rows are not cleaned up yet (needs Cron, Phase 3).
- Still unproven: the Resend and Cloudflare email calls, and the conflict messages for domains (they
  depend on D1's error text; the same method worked for invitations).
