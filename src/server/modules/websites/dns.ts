/**
 * TXT lookups over Cloudflare DNS-over-HTTPS (the resolver's JSON format). Only this fixed resolver
 * is contacted; the customer's own server is never requested, so there is no SSRF surface here.
 * https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/
 */

const RESOLVER = "https://cloudflare-dns.com/dns-query";
const TXT_TYPE = 16;
const NOERROR = 0;
const NXDOMAIN = 3;
const TIMEOUT_MS = 5_000;

export type TxtLookup = { ok: true; values: string[] } | { ok: false };

/** TXT data arrives quoted, and long values as several quoted chunks: `"abc" "def"` is "abcdef". */
export function parseTxtData(data: string): string {
  const chunks = data.match(/"(?:\\.|[^"\\])*"/g);
  if (!chunks) return data.trim();
  return chunks.map((chunk) => chunk.slice(1, -1).replace(/\\(.)/g, "$1")).join("");
}

export async function lookupTxt(name: string, fetcher: typeof fetch = fetch): Promise<TxtLookup> {
  const url = `${RESOLVER}?name=${encodeURIComponent(name)}&type=TXT`;
  try {
    const response = await fetcher(url, { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return { ok: false };
    const body = (await response.json()) as { Status?: unknown; Answer?: { type?: unknown; data?: unknown }[] };
    if (body.Status === NXDOMAIN) return { ok: true, values: [] };
    if (body.Status !== NOERROR) return { ok: false };
    const values = (body.Answer ?? [])
      .filter((answer) => answer.type === TXT_TYPE && typeof answer.data === "string")
      .map((answer) => parseTxtData(answer.data as string));
    return { ok: true, values };
  } catch {
    return { ok: false };
  }
}
