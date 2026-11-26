/**
 * Everything under /api/v1/auth. Better Auth does the work; this wrapper
 *  - refuses email-dependent actions while no email provider is configured,
 *  - reports a failed sign-up email instead of claiming success,
 *  - writes the security audit trail.
 * Responses keep Better Auth's shape ({ code, message }) so its client library works unchanged.
 */
import type { Deps } from "../env";
import { ApiError } from "../http/errors";
import { clientIp, userAgent } from "../http/request";
import { newId, sha256Hex } from "../ids";
import { describeError, log } from "../logger";
import { recordSecurityEvent } from "../logs/security";
import { createMailer, emailNotConfigured } from "../mail/mailer";
import { AUTH_BASE_PATH, createAuth, type Auth, type DeliveryState } from "./auth";

/** POST paths that are pointless without email. */
const NEEDS_EMAIL = new Set(["/sign-up/email", "/send-verification-email", "/request-password-reset"]);

/**
 * Where a failed send is reported to the caller. Sign-up sends an email for new and existing
 * addresses alike, so the error reveals nothing. Resending a confirmation and resetting a password
 * send only for some addresses; a different answer there would show which have accounts, so those
 * answer as usual and the failure is logged.
 */
const SURFACE_DELIVERY_FAILURE = new Set(["/sign-up/email"]);

const AUDITED: Record<string, string> = {
  "/sign-up/email": "auth.sign_up",
  "/confirm-email": "auth.email_confirmed",
  "/sign-in/email": "auth.sign_in",
  "/sign-out": "auth.sign_out",
  "/request-password-reset": "auth.password_reset_requested",
  "/reset-password": "auth.password_reset",
  "/change-password": "auth.password_changed",
  "/revoke-session": "auth.session_revoked",
  "/revoke-sessions": "auth.sessions_revoked",
  "/two-factor/enable": "auth.two_factor_enable",
  "/two-factor/disable": "auth.two_factor_disable",
  "/two-factor/verify-totp": "auth.two_factor_verify",
  "/two-factor/verify-backup-code": "auth.two_factor_backup_code",
  "/delete-user": "auth.account_delete",
};

/** Their responses do not say who acted, so the session is read before the action ends it. */
const ACTS_ON_SESSION = new Set([
  "/sign-out",
  "/change-password",
  "/revoke-session",
  "/revoke-sessions",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/delete-user",
]);

/** Their response names the account that acted. Sign-up is not listed: for an existing address its id is invented. */
const RESPONSE_NAMES_USER = new Set(["/sign-in/email", "/confirm-email", "/two-factor/verify-totp", "/two-factor/verify-backup-code"]);

const ORIGIN_REJECTIONS = new Set(["INVALID_ORIGIN", "MISSING_OR_NULL_ORIGIN"]);

function problem(error: ApiError, requestId: string): Response {
  return Response.json({ code: error.code.toUpperCase(), message: error.message, requestId }, { status: error.status, headers: { "Cache-Control": "no-store", "x-request-id": requestId } });
}

async function readJsonSafely(source: Request | Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await source.json();
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function sessionUserId(auth: Auth, headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers, query: { disableRefresh: true } });
  return session?.user.id ?? null;
}

export async function handleAuthRequest(request: Request, deps: Deps): Promise<Response> {
  const requestId = newId("req");
  const path = new URL(request.url).pathname.slice(AUTH_BASE_PATH.length).replace(/\/$/, "") || "/";
  try {
    const mailer = createMailer(deps.env);
    if (request.method === "POST" && NEEDS_EMAIL.has(path) && !mailer.configured) return problem(emailNotConfigured(), requestId);

    const delivery: DeliveryState = { failedKind: null };
    const auth = createAuth(deps, mailer, delivery);
    const event = request.method === "POST" ? AUDITED[path] : undefined;
    const requestCopy = event ? request.clone() : null;
    const actorId = event && ACTS_ON_SESSION.has(path) ? await sessionUserId(auth, request.headers) : null;

    const response = await auth.handler(request);

    // Rate-limited and cross-origin requests are not recorded: the rate limiter must also limit
    // how fast an anonymous caller can grow a table that cannot be pruned by the app.
    if (event && requestCopy && response.status !== 429) {
      const [sent, received] = await Promise.all([readJsonSafely(requestCopy), readJsonSafely(response.clone())]);
      const originRejected = typeof received.code === "string" && ORIGIN_REJECTIONS.has(received.code);
      const anonymousSignOut = path === "/sign-out" && actorId === null;
      if (!originRejected && !anonymousSignOut) {
        const user = RESPONSE_NAMES_USER.has(path) ? (received.user as { id?: unknown } | undefined) : undefined;
        const email = typeof sent.email === "string" ? sent.email.trim().toLowerCase() : null;
        await recordSecurityEvent(deps.d1, {
          event,
          outcome: response.ok ? "success" : "failure",
          userId: actorId ?? (typeof user?.id === "string" ? user.id : null),
          ipAddress: clientIp(request),
          userAgent: userAgent(request),
          // A hash lets repeated attempts against one address be counted without storing it here.
          metadata: { ...(email ? { emailHash: await sha256Hex(email) } : {}), status: response.status },
          requestId,
          at: deps.now(),
        });
      }
    }

    if (delivery.failedKind) {
      await recordSecurityEvent(deps.d1, { event: "mail.delivery_failed", outcome: "failure", metadata: { kind: delivery.failedKind }, requestId, at: deps.now() });
      if (response.ok && SURFACE_DELIVERY_FAILURE.has(path)) {
        return problem(new ApiError(502, "email_delivery_failed", "We could not send the email. Wait a moment, then ask for it again."), requestId);
      }
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError) return problem(error, requestId);
    log("error", "auth.request_failed", { requestId, path, error: describeError(error) });
    return problem(new ApiError(500, "internal_error", "Something went wrong. Try again."), requestId);
  }
}
