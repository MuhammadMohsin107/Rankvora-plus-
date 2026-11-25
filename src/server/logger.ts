/**
 * Structured logs (one JSON object per line) for Workers observability.
 * Never pass request bodies, passwords, tokens, cookies or provider keys.
 */

type Level = "info" | "warn" | "error";

const SECRET_KEY = /pass|secret|token|cookie|authorization|api.?key|backup/i;

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function log(level: Level, event: string, fields: LogFields = {}): void {
  const safe: Record<string, unknown> = { level, event };
  for (const [key, value] of Object.entries(fields)) safe[key] = SECRET_KEY.test(key) ? "[redacted]" : value;
  const line = JSON.stringify(safe);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Drizzle's query errors put the bound values into the message ("params: ..."), which can be session
 * tokens, password hashes or email addresses. Everything from that marker on is dropped.
 */
export function withoutParams(message: string): string {
  return message.split(/\n?params:/)[0];
}

/** Error name and message only, never bound values or stack traces. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  if ("query" in error && "params" in error) {
    const cause = error.cause instanceof Error ? withoutParams(error.cause.message) : "query failed";
    return `DatabaseQueryError: ${cause}`.slice(0, 500);
  }
  return `${error.name}: ${withoutParams(error.message)}`.slice(0, 500);
}
