/**
 * HTTPS and redirect inspection of a website's own domain.
 *
 * This is the one place the server requests an address chosen by a customer, so every hop is checked
 * first: http or https on the default port, a public host name, and only public IP addresses. No
 * cookies or credentials are sent, redirects are followed one by one, and bodies are not read.
 */
import { DomainError, normalizeHost } from "@/lib/domain";

import { DOMAIN_CHECK_COOLDOWN_MS } from "../../config/limits";
import { atomic, insertedClause, prepare, raw } from "../../db/atomic";
import { ApiError, conflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type WebsiteScope } from "../../tenancy/guard";
import { findActiveDomain } from "./domains";
import { websiteActivity } from "./service";

const RESOLVER = "https://cloudflare-dns.com/dns-query";
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const USER_AGENT = "RankvoraDomainCheck/1.0";

/* ───────── Address safety (pure) ───────── */

function ipv4Parts(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return numbers.every((number) => number >= 0 && number <= 255) ? numbers : null;
}

function isPublicIpv4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, including cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

/** The eight 16-bit groups of an IPv6 address, or null. */
function ipv6Groups(address: string): number[] | null {
  let text = address.toLowerCase();
  const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (tail) {
    const v4 = ipv4Parts(tail);
    if (!v4) return null;
    text = `${text.slice(0, -tail.length)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  return groups.every((group) => /^[0-9a-f]{1,4}$/.test(group)) ? groups.map((group) => parseInt(group, 16)) : null;
}

/** Only global unicast addresses are public. Anything unrecognised is treated as private. */
export function isPublicAddress(address: string): boolean {
  const v4 = ipv4Parts(address);
  if (v4) return isPublicIpv4(v4);
  const groups = ipv6Groups(address);
  if (!groups) return false;
  // IPv4-mapped and NAT64 forms carry an IPv4 address that must itself be public.
  const mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  const nat64 = groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((group) => group === 0);
  if (mapped || nat64) return isPublicIpv4([groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff]);
  if ((groups[0] & 0xe000) !== 0x2000) return false; // outside 2000::/3: loopback, link-local, unique-local, multicast
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return false; // documentation range
  return true;
}

/* ───────── Network ───────── */

type Fetcher = typeof fetch;

async function resolveAddresses(host: string, fetcher: Fetcher): Promise<string[] | null> {
  const lookup = async (type: "A" | "AAAA") => {
    const response = await fetcher(`${RESOLVER}?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("dns");
    const body = (await response.json()) as { Answer?: { type?: number; data?: string }[] };
    const wanted = type === "A" ? 1 : 28;
    return (body.Answer ?? []).filter((answer) => answer.type === wanted && typeof answer.data === "string").map((answer) => answer.data as string);
  };
  try {
    const [v4, v6] = await Promise.all([lookup("A"), lookup("AAAA")]);
    return [...v4, ...v6];
  } catch {
    return null;
  }
}

/** Why a URL must not be requested, or null when it is safe. */
async function unsafeReason(target: URL, fetcher: Fetcher): Promise<string | null> {
  if ((target.protocol !== "https:" && target.protocol !== "http:") || target.port || target.username || target.password) return "unsafe_redirect";
  try {
    if (normalizeHost(target.hostname) !== target.hostname) return "unsafe_redirect";
  } catch (error) {
    if (error instanceof DomainError) return "unsafe_redirect";
    throw error;
  }
  const addresses = await resolveAddresses(target.hostname, fetcher);
  if (addresses === null) return "dns_lookup_failed";
  if (addresses.length === 0) return "dns_no_address";
  return addresses.every(isPublicAddress) ? null : "unsafe_address";
}

async function hop(url: string, fetcher: Fetcher): Promise<{ status: number; location: string | null } | null> {
  try {
    const response = await fetcher(url, { method: "GET", redirect: "manual", headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    await response.body?.cancel();
    return { status: response.status, location: response.headers.get("location") };
  } catch {
    return null;
  }
}

type Walk = { hops: { url: string; status: number }[]; error: string | null; reachedHttps: boolean };

/** Follows redirects one at a time. With `untilHttps`, stops at the first redirect to https. */
async function walk(start: string, fetcher: Fetcher, untilHttps: boolean): Promise<Walk> {
  const hops: Walk["hops"] = [];
  let url = new URL(start);
  for (let step = 0; step <= MAX_REDIRECTS; step++) {
    const unsafe = await unsafeReason(url, fetcher);
    if (unsafe) return { hops, error: unsafe, reachedHttps: false };
    const answer = await hop(url.toString(), fetcher);
    if (!answer) return { hops, error: "unreachable", reachedHttps: false };
    hops.push({ url: url.toString(), status: answer.status });
    if (!REDIRECT_STATUSES.has(answer.status) || !answer.location) return { hops, error: null, reachedHttps: false };
    try {
      url = new URL(answer.location, url);
    } catch {
      return { hops, error: "unsafe_redirect", reachedHttps: false };
    }
    if (untilHttps && url.protocol === "https:") return { hops, error: null, reachedHttps: true };
  }
  return { hops, error: "too_many_redirects", reachedHttps: false };
}

export type Inspection = {
  httpsOk: boolean;
  httpUpgrades: boolean | null;
  finalUrl: string | null;
  finalStatus: number | null;
  leavesWebsite: boolean | null;
  redirects: { url: string; status: number }[];
  errorCode: string | null;
};

export async function inspectHost(host: string, ownHosts: readonly string[], fetcher: Fetcher = fetch): Promise<Inspection> {
  const secure = await walk(`https://${host}/`, fetcher, false);
  const first = secure.hops[0];
  // Cloudflare reports a failed TLS handshake or broken origin as 520-527.
  const originFailure = first && first.status >= 520 && first.status <= 527;
  const httpsOk = Boolean(first) && !originFailure;
  const errorCode = secure.error ?? (originFailure ? (first.status === 525 || first.status === 526 ? "tls_error" : "origin_error") : null);
  const final = secure.error ? undefined : secure.hops.at(-1);

  const plain = await walk(`http://${host}/`, fetcher, true);
  const httpUpgrades = plain.reachedHttps ? true : plain.error === "unreachable" || plain.hops.length === 0 ? null : false;

  return {
    httpsOk,
    httpUpgrades,
    finalUrl: final?.url ?? null,
    finalStatus: final?.status ?? null,
    leavesWebsite: final ? !ownHosts.includes(new URL(final.url).hostname) : null,
    redirects: secure.hops,
    errorCode,
  };
}

/* ───────── Endpoints ───────── */

type CheckRow = {
  id: string;
  httpsOk: number;
  httpUpgrades: number | null;
  finalUrl: string | null;
  finalStatus: number | null;
  leavesWebsite: number | null;
  redirects: string;
  errorCode: string | null;
  createdAt: number;
};

const SELECT = `select id as id, https_ok as httpsOk, http_upgrades as httpUpgrades, final_url as finalUrl, final_status as finalStatus,
    leaves_website as leavesWebsite, redirects as redirects, error_code as errorCode, created_at as createdAt from domain_checks`;

const flag = (value: number | null) => (value === null ? null : value === 1);

const toDto = (row: CheckRow) => ({
  id: row.id,
  httpsOk: row.httpsOk === 1,
  httpUpgrades: flag(row.httpUpgrades),
  finalUrl: row.finalUrl,
  finalStatus: row.finalStatus,
  leavesWebsite: flag(row.leavesWebsite),
  redirects: JSON.parse(row.redirects) as { url: string; status: number }[],
  errorCode: row.errorCode,
  checkedAt: new Date(row.createdAt).toISOString(),
});

export async function listDomainChecks(context: ApiContext, scope: WebsiteScope, domainId: string) {
  const { results } = await prepare(
    context.d1,
    raw(`${SELECT} where domain_id = ? and website_id = ? and organization_id = ? order by created_at desc, id desc limit 20`, domainId, scope.websiteId, scope.organizationId),
  ).all<CheckRow>();
  return results.map(toDto);
}

/** Requests the domain now and saves what was seen. A failing site is a normal result, not an error. */
export async function checkDomain(context: ApiContext, scope: WebsiteScope, domainId: string, fetcher: Fetcher = fetch) {
  assertWritableWebsite(scope);
  const domain = await findActiveDomain(context, scope, domainId);
  const last = await prepare(context.d1, raw(`select max(created_at) as at from domain_checks where domain_id = ?`, domain.id)).first<{ at: number | null }>();
  if (last?.at && context.now.getTime() - last.at < DOMAIN_CHECK_COOLDOWN_MS) throw new ApiError(429, "too_soon", "Wait a few seconds before checking again.");

  const { results: own } = await prepare(context.d1, raw(`select host as host from website_domains where website_id = ? and status = 'active'`, scope.websiteId)).all<{ host: string }>();
  const result = await inspectHost(domain.host, own.map((row) => row.host), fetcher);

  const id = newId("dck");
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const [inserted] = await atomic(context.d1, [
    raw(
      `insert into domain_checks (id, organization_id, website_id, domain_id, https_ok, http_upgrades, final_url, final_status, leaves_website,
         redirects, error_code, checked_by_user_id, created_at)
       select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        where exists (select 1 from website_domains where id = ? and status = 'active') and ${writable.sql} and ${actor.sql}`,
      id,
      scope.organizationId,
      scope.websiteId,
      domain.id,
      result.httpsOk,
      result.httpUpgrades,
      result.finalUrl,
      result.finalStatus,
      result.leavesWebsite,
      JSON.stringify(result.redirects),
      result.errorCode,
      scope.userId,
      context.now,
      domain.id,
      ...writable.params,
      ...actor.params,
    ),
    activityStatement(
      websiteActivity(context, scope, scope.websiteId, "domain.checked", { domain: domain.host, httpsOk: result.httpsOk }, { type: "domain", id: domain.id }),
      insertedClause("domain_checks", id),
    ),
  ]);
  if (inserted === 0) throw conflict("domain_changed", "This domain changed. Reload and try again.");
  const [saved] = await listDomainChecks(context, scope, domain.id);
  return saved;
}
