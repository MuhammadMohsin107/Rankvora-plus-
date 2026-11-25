/**
 * Server configuration and the dependencies every request handler receives. Only the server layer
 * reads environment variables. A missing required value makes the API answer "not configured";
 * it never falls back to a built-in secret.
 */

export type MailTransportName = "resend" | "cloudflare" | "console";

/** The subset of the Cloudflare `send_email` binding the app uses. */
export type EmailBinding = {
  send(message: { to: string; from: string; subject: string; text: string; html: string }): Promise<unknown>;
};

export type AppEnv = {
  /** Signs session cookies and encrypts two-factor secrets. At least 32 characters. */
  authSecret: string | null;
  /** Public origin of the app, without a trailing slash. Used in emailed links. */
  appUrl: string | null;
  mailTransport: MailTransportName | null;
  mailFrom: string | null;
  resendApiKey: string | null;
  emailBinding: EmailBinding | null;
};

export type Deps = {
  d1: D1Database;
  env: AppEnv;
  now: () => Date;
  /** Keeps the Worker alive for work that finishes after the response. Absent outside Workers. */
  waitUntil?: (task: Promise<unknown>) => void;
};

const MIN_SECRET_LENGTH = 32;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function origin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

function isEmailBinding(value: unknown): value is EmailBinding {
  return typeof value === "object" && value !== null && typeof (value as { send?: unknown }).send === "function";
}

/** Reads from the Cloudflare bindings first, then process.env. */
export function readEnv(bindings: Record<string, unknown>, processEnv: Record<string, string | undefined> = process.env): AppEnv {
  const read = (name: string) => text(bindings[name]) ?? text(processEnv[name]);
  const secret = read("BETTER_AUTH_SECRET");
  const transport = read("MAIL_TRANSPORT");
  return {
    authSecret: secret && secret.length >= MIN_SECRET_LENGTH ? secret : null,
    appUrl: origin(read("APP_URL")),
    mailTransport: transport === "resend" || transport === "cloudflare" || transport === "console" ? transport : null,
    mailFrom: read("MAIL_FROM"),
    resendApiKey: read("RESEND_API_KEY"),
    emailBinding: isEmailBinding(bindings.EMAIL) ? bindings.EMAIL : null,
  };
}

export function isLocalUrl(appUrl: string | null): boolean {
  if (!appUrl) return false;
  const host = new URL(appUrl).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
