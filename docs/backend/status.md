# Backend status against the blueprint (2026-11-26)

**Built** means the code exists. Marks: ✅ built · 🟡 partly built · ⬜ not started. A ✅ is not by
itself proof; what has actually been run is listed under [Live tests](#live-tests).

## Live tests

How: the Cloudflare build ran on a local PC in the Workers runtime (`wrangler dev`), saving to a separate
remote D1 database, `rankvora-plus-test`. Emails were printed to the terminal. Requests were sent from
visible browser windows, one per person. The live site and live database were not changed. The test
people use `@example.com` addresses. The real website is `tetralogicx.com`; other hosts under it were
temporary entries for limit and race checks, removed through the app (removal keeps the history row).
For expiry and lower-limit checks, values in the test database were changed with SQL.

### 2026-11-25: 219 checks, 0 failed

| Area | Checks | Covered |
| --- | :-: | --- |
| Signed out and cross-site | 5 | Protected endpoints; foreign-origin write refused |
| Accounts | 15 | Sign-up, confirmation, sign-in refusals, existing address, no sign-in on confirm |
| Organizations | 16 | Create, double-submit replay, key reuse, bad input, stale edit, usage, history |
| Isolation between customers | 17 | 15 reads and writes on another customer's organization all answered 404; data unchanged |
| Team | 43 | Invitations, roles, last owner, invitation dies with its sender's authority, daily email limit, deactivation, logs and paging |
| Account security | 34 | Device list and sign-out, password reset, two-factor and backup codes, account and organization deletion |
| Accounts for the website run | 10 | Owner, team member and a second customer |
| Websites and domains | 72 | Bad input, create and replay, edits, every lifecycle step, domains and history, member refusals, second customer gets 404, removal, 5-website limit |
| Ownership check, first half | 7 | DNS record issued; real lookup says not published, so not verified |

### 2026-11-26: 192 checks, one bug found and fixed

188 passed. Of the 4 that failed, 2 showed the bug below and 2 were mistakes in the test itself (a
wrong expected error name; an Idempotency-Key used again, so the app rightly replayed its saved answer).
Each was run again and passed.

| Area | Covered |
| --- | --- |
| Restart | Test people signed back in by password reset; earlier data and the open DNS record unchanged |
| Roles | Manager: reported permissions match; 9 actions allowed, 18 refused, nothing changed by the refused ones. Admin: pause, resume, domains, add website, settings, security log; cannot remove a website or delete the organization. Viewer: reads websites, cannot edit them or read history |
| Member limit | 10-member default, a freed seat, reactivation, own open invitation, limit checked again on accept |
| Simultaneous requests | Same domain, same Idempotency-Key, last website place, two edits, pause with archive, starting verification, five invitations for two seats, double accept, two owners demoting each other, both owners leaving. One winner or the limit held each time; the rerun also confirmed the requests were in flight together |
| Expiry | Invitation (and revival by resend), DNS record, session, password reset link |

**Bug fixed:** reactivating a member counted only active members, so
the seat rule could be broken (2 members and 9 open invitations with a limit of 10), and the person's
own open invitation kept holding a second seat. Reactivation now follows the invitation rule and closes
that invitation.

Also confirmed over both days: D1 accepted all four migrations (19 tables, 36 indexes, 12 triggers);
update and delete were refused on `activity_logs` and `security_audit_logs`; a website's organization
and a domain row's host could not be changed; no foreign-key violations; no organization without an
owner or over its member or website limit; passwords and invitation tokens stored only hashed; no test
password in logs; no server error in the app logs.

### 2026-11-26, Phase 2: 212 checks, 0 failed

Content is real: brand text, FAQs, source pages, service and products were taken word for word from
tetralogicx.com; the three competitors were named by the owner and each homepage checked first
(browntech.co, hazelsoft.net, intelliwebsolution.com). The owner approved test questions written from
the site's services. Role, race and refusal checks also used short throwaway values and temporary
entries.

| Area | Checks | Covered |
| --- | :-: | --- |
| Brand knowledge | 27 | Profile versions and stale saves, facts with sources, verification rules, a real contradiction on the site (80+ vs 250+ stores), source pages |
| Competitors and products | 39 | Own domain refused, suggestion and confirm, archive, remove and history, product price rules, product facts |
| Prompt library | 38 | Groups, duplicates and near-duplicates, per-market wording, filters and paging, versions and approval, status rules, soft delete |
| Assignments, import, bulk | 31 | Latest-approved vs pinned, editing never changes what runs, CSV preview and all-or-nothing import, bulk actions with skip reasons |
| Roles and isolation | 55 | Member, manager and viewer rules; all 32 requests of a second customer answered 404; borrowing its ids refused; archived website read-only |
| Domain checks | 7 | Real requests: www redirects to tetralogicx.com, HTTPS works, HTTP upgrades; saved results cannot be changed |
| Simultaneous requests and consistency | 11 | One winner each time; no missing version, unapproved active prompt, verified fact without basis, gap in history or broken link |
| Fixes after review (rebuilt app) | 4 | `www.` competitor domain refused as a duplicate; health check covers Phase 2 |

The database refused to change or delete saved brand versions, competitor history, domain checks and
approved prompt versions, to delete a prompt, or to move a competitor domain. No server error and no
test password in the logs. After the run, a review found that `www.` and bare competitor domains could
be listed twice; they are now stored as one (unit test, and re-checked in the app).

### 2026-11-26, screens on real data: 35 checks, 0 failed

The sample data and demo storage were removed from the app. Walked through in a visible browser against
the test database: sign-in and its refusals (an off-site redirect in the link is ignored), password
reset by the emailed link, the real website list and overview, every screen without a backend showing
"Not available yet", an old sample page returning not found, Help without sample content, search, add
website refusals shown at their fields, the account menu and sign-out, the new-organization form for
an account without one, a broken invitation and confirmation link, and sign-in and websites on a
375px phone without sideways scrolling. No browser or server errors. Not exercised through the screens:
creating an organization or website, accepting an invitation and two-step sign-in (their API calls
passed the earlier tests).

### 2026-11-26, confirming an email takes the password: 30 checks, 0 failed

This closes the sign-up weakness. Sign-up and the confirm page were used through the screens. The old
one-click address answers not found; opening the link confirms nothing; a wrong password, a changed
link and an expired link are refused; the right password confirms and signs nobody in. A stranger who
signs up with someone else's address gets nothing: without that password the owner's click confirms
nothing, and the owner's password reset confirms the address and replaces the stranger's password. The
sixth attempt within a minute is refused. Confirmations and refusals are in the security log. The first
run of this test found that the new code refused every link; fixed before it was committed, with a
unit test on a link made by the library.

**Not run:** a successful DNS ownership check (waiting for the owner to publish the record, which
expires 2026-12-02) and what follows from it (the second account refused, proof kept when the domain
becomes the main one); usage reserve and settle (nothing calls them until Phase 3) and the usage
triggers; real email delivery; the Free plan limits (the local runtime does not enforce CPU or query
limits). The 93 unit tests pass (tests of the removed demo screens went with them); database behaviour
is covered only by the live tests. Phase 2 code and the new screens have not had a separate review.

## Roadmap (Part 24)

| Phase | State | Note |
| --- | --- | --- |
| 0 Discovery | ✅ | [phase-0-discovery.md](phase-0-discovery.md), [traceability.md](traceability.md) |
| 1 Foundation | 🟡 | Passed the live tests except a successful DNS ownership check and usage reserve and settle. Exit condition (several websites, no cross-tenant access) met in the test setup |
| 2 Website and prompt management | 🟡 | Backend built and live-tested; exit condition (configuration persists correctly) met in the test setup. The screens do not use it yet. Model choice waits for Phase 3 |
| 3-11 | ⬜ | Not started |

## Parts 1-3: scope, discovery, architecture

| Point | State | Note |
| --- | --- | --- |
| 1.3 No fake data or success | ✅ | No seed data. The demo UI and its data were removed on 2026-11-26; screens show only API data or "Not available yet". Earlier designs are in `design-archive/` |
| 2.1-2.2 Stack and repository inspection | ✅ | `pg` and PostgreSQL are no longer in the project |
| 2.3 Traceability | 🟡 | Phase 1 per action; later modules per action group |
| 3.1 Modular monolith | ✅ | `src/server` (modules), `src/app/api/v1` (routes) |
| 3.2 Database | ✅ | **D1 only** (owner's decision; replaces the PostgreSQL and Hyperdrive recommendation) |
| 3.3 Queues, Workflows, Cron, R2 | ⬜ | Phase 3 onward |
| 3.3 Secrets and observability | 🟡 | Secrets via Worker secrets; structured logs with request ids. No error tracking, tracing or alerts |

## Part 4: authentication and tenancy

| Point | State | Note |
| --- | --- | --- |
| 4.1 Register, verify email, sign in, sign out, reset password | ✅ | API and screens. Confirming takes the password. Needs an email provider |
| 4.1 Password storage | ✅ | scrypt (Better Auth). **Expected to exceed the Free plan CPU limit** |
| 4.1 Sessions: create, expire (7 days), revoke, device list | ✅ | The expiry slides daily; the session token itself is not rotated |
| 4.1 Optional MFA | ✅ | TOTP and backup codes |
| 4.1 Account status | 🟡 | Suspension is enforced; there is no operator screen (SQL in the runbook) |
| 4.1 Account deletion | ✅ | Blocked for a sole owner |
| 4.2 Organizations, members, invitations with expiry, removal | ✅ | |
| 4.2 Organization switching | 🟡 | Every request names its organization; the switcher UI is not wired |
| 4.2 Suspension | 🟡 | Writes blocked; operator action by SQL |
| 4.2 Organization audit log | ✅ | Append-only |
| 4.3 Five roles, granular permissions, separate approval | ✅ | The matrix is code (`tenancy/permissions.ts`), not `roles`/`permissions` tables. Tested on every built endpoint; module permissions wait for their modules |
| 4.4 Tenant isolation in APIs and queries | ✅ | Guard scopes, plus composite foreign keys. Organizations and websites tested |
| 4.4 Isolation in jobs, providers, exports, R2, webhooks | ⬜ | Those do not exist yet. API responses are `no-store` |

## Part 5: websites and brands

| Point | State | Note |
| --- | --- | --- |
| 5.1 Add, edit, verify ownership, pause, resume, archive, restore, remove, history | ✅ | Removal is a soft delete of an archived website. Tested, except a successful ownership check |
| 5.2 Profile fields | 🟡 | All except tracking configuration (Phase 3/6) |
| 5.3 Canonical validation, DNS ownership, aliases, redirects, former domains, history, change log | ✅ | |
| 5.3 HTTPS check, redirect inspection | ✅ | Every hop must be a public host with only public addresses. Tested on tetralogicx.com |
| 5.3 Runs keep the domain used at the time | ⬜ | No runs yet (Phase 3) |
| 5.4 Brand knowledge | ✅ | Immutable profile versions; facts with sources, five statuses, last-verified date and history. Verified needs a source or an owner or admin |
| 5.5 Competitors | ✅ | Aliases, domains, market, category, confirmation, evidence, history. AI suggestions arrive in Phase 3 |
| 5.6 Products and services | ✅ | Optional. Verified specifications are product facts |

## Parts 6-16

| Part | State | Phase |
| --- | --- | --- |
| 6.1-6.3 Prompt library, versions, assignments | ✅ | 2. Search, filters, intent and topic categories, groups, tags, bulk actions, CSV import, duplicate detection, immutable versions with approval, latest-approved or pinned assignments. Model choice with Phase 3. Delete is a soft delete of an archived prompt (retention policy still open). Copying prompts to another website is not built |
| 6.4 AI prompt suggestions | ⬜ | 3 |
| 7 Providers (OpenAI, Gemini, Perplexity) · 8 Response analysis | ⬜ | 3, 4. `GEMINI_API_KEY` is named in `.dev.vars.example`; nothing reads it yet |
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
| 18.2 Limits | 🟡 | Website, member and active-prompt limits enforced and tested, including simultaneous requests. AI and search limits stored. Other limits not modelled |
| 18.3-18.4 Usage ledger, reserve, settle, release | 🟡 | Built; nothing calls it until Phase 3. Cost estimation and limit notices not built |

## Parts 19-20: data and API

| Point | State | Note |
| --- | --- | --- |
| Identity, website domain and usage tables, logs, idempotency | ✅ | `migrations/0001`-`0003`. Website profile and settings are columns on `websites` |
| Website brand, competitor, product and prompt tables | ✅ | `migrations/0004`-`0005`: 17 tables, 23 triggers. Aliases are lists inside the immutable brand profile version |
| Foreign keys, unique rules, indexes, atomic writes, immutable history | ✅ | |
| Retention policy | ⬜ | **Needs your decision**; logs cannot be pruned without a migration |
| Outbox table | ⬜ | Arrives with queues (Phase 3) |
| Backup and restore | 🟡 | Commands in the runbook; restore never tried |
| Other entity groups | ⬜ | With their phases |
| 20 API: auth, organizations, websites, domains, brand, competitors, products, prompts | ✅ | [api.md](api.md). Auth paths use Better Auth's names. Products live at `/products-services` |
| 20 API: other groups | ⬜ | With their phases |

## Parts 21-23, 25: security, operations, QA, done

| Point | State | Note |
| --- | --- | --- |
| Auth, roles, object-level checks, secure cookies, CSRF, input validation, email escaping, account deletion | ✅ | Mostly covered by the live test. Secure cookies (HTTPS) and email HTML not exercised |
| Rate limiting | 🟡 | Auth endpoints and invitation emails. No general API limit (Phase 11) |
| Provider credential encryption, webhook signatures, SSRF, file access, exports, customer data export, provider terms review, secret rotation | ⬜ | Their phases, or Phase 11 |
| 22 Structured logs, request ids, error codes | ✅ | Metrics, job and queue monitoring, outbox ⬜ |
| 23 QA | 🟡 | Manual live tests: 23.1 (confirmation-link expiry not run), the organization and website parts of 23.2, 23.3 (successful verification not run) and 23.4 except runs and schedules (none exist yet). Automated tests cover only pure rules |
| 25 Definition of done | ⬜ | Not met |

## Other checks

Type check, ESLint, `next build` and the OpenNext Cloudflare build. An independent read-only code
review found no fault in the hand-written SQL and reported 16 other findings, among them an invitation
that outlived its sender's access and a pre-registration account takeover. All 16 have changes; the
takeover was closed on 2026-11-26 (confirming an email takes the password, see the live tests). The
changes have not had a second review; the live tests exercised the invitation and takeover fixes. The
review also did not catch the seat-rule bug found on 2026-11-26.

## Known limits that remain

- If a stranger signed up with an address first, the name they typed stays on the account after the
  owner takes it back by password reset. There is no screen to change a name yet.
- Password reset and resend-confirmation answer the same even if the email fails (otherwise they
  reveal which addresses have accounts). The failure is written to the security log. The response time
  of resend-confirmation can still differ.
- Account deletion can be left half done if two requests of the same account race in a very narrow window.
- A repeated `Idempotency-Key` is replayed before permissions are re-checked: for 24 hours a removed
  member can still get their own earlier response.
- Signed-in users can add many "permission denied" log rows.
- Expired idempotency and rate-limit rows are not cleaned up yet (needs Cron, Phase 3).
- Still unproven: the Resend and Cloudflare email calls, and the "verified elsewhere" domain conflict
  (it depends on D1's error text; the same method worked for "domain in use", also under
  simultaneous requests, and for invitations).
