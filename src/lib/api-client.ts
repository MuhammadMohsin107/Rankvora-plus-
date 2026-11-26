/**
 * Calls the app's own API. Same origin, so the browser sends the session cookie and the Origin
 * header by itself. App endpoints answer `{ data }` or `{ error }`; authentication endpoints keep
 * Better Auth's `{ code, message }` shape.
 */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type Options = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; idempotencyKey?: string; signal?: AbortSignal };

async function send(path: string, options: Options): Promise<{ response: Response; json: Record<string, unknown> | null }> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiRequestError(0, "network", "Could not reach the server. Check your connection.");
  }
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { response, json };
}

const fallback = (status: number) =>
  status === 429 ? "Too many attempts. Wait a moment, then try again." : "Something went wrong. Try again.";

/** An app endpoint: returns `data`, or throws with the server's code, message and field errors. */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { response, json } = await send(path, options);
  if (response.ok && json && "data" in json) return json.data as T;
  const error = (json?.error ?? {}) as { code?: string; message?: string; fields?: Record<string, string> };
  throw new ApiRequestError(response.status, error.code ?? "unknown", error.message ?? fallback(response.status), error.fields);
}

/** An authentication endpoint under /api/v1/auth. */
export async function authApi<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  const { response, json } = await send(`/api/v1/auth${path}`, { method: body === undefined ? "GET" : "POST", body });
  if (response.ok) return (json ?? {}) as T;
  const code = typeof json?.code === "string" ? json.code : "unknown";
  const message = response.status === 429 ? fallback(429) : typeof json?.message === "string" ? json.message : fallback(response.status);
  throw new ApiRequestError(response.status, code, message);
}

/** One per form submission, so a double click or a retry cannot create two records. */
export const newIdempotencyKey = () => crypto.randomUUID();

/** Only a path on this site, so a crafted link cannot send someone elsewhere after signing in. */
export function safeNextPath(value: string | null | undefined, fallbackPath = "/stores"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallbackPath;
  return value;
}
