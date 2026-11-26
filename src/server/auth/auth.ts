/**
 * Authentication (Better Auth on D1): email and password, mandatory email verification (the emailed
 * link plus the password, see confirm-email.ts), database sessions that can be listed and revoked,
 * password reset, optional TOTP two-factor.
 *
 * One instance per request, because the D1 binding arrives with the request. A failed email send is
 * recorded in `delivery` and not thrown: the library either swallows such errors or turns them into
 * an empty 500, so `auth/endpoint.ts` decides what the caller is told.
 */
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";

import { prepare, raw } from "../db/atomic";
import { createDb } from "../db/client";
import { authAccounts, authRateLimits, authTwoFactors, authVerifications, userSessions, users } from "../db/schema";
import type { Deps } from "../env";
import { ApiError } from "../http/errors";
import { describeError, log, withoutParams } from "../logger";
import { recordSecurityEvent } from "../logs/security";
import type { Mail, Mailer } from "../mail/mailer";
import { existingAccountMail, resetPasswordMail, verifyEmailMail } from "../mail/templates";
import { releaseMemberships, SoleOwnerError } from "../modules/account/service";
import { displayName } from "../validation";
import { CONFIRM_EMAIL_PATH, confirmEmailWithPassword } from "./confirm-email";

export const AUTH_BASE_PATH = "/api/v1/auth";
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

const DAY = 60 * 60 * 24;

export type DeliveryState = { failedKind: Mail["kind"] | null };

export const notConfigured = () => new ApiError(503, "auth_not_configured", "Sign-in is not set up on this server yet.");

const userName = displayName("Name");

/** The library accepts any value as a name, and the name is quoted in invitation emails. */
function validName(value: unknown): string {
  const result = userName.safeParse(value);
  if (!result.success) throw new APIError("BAD_REQUEST", { code: "INVALID_NAME", message: result.error.issues[0].message });
  return result.data;
}

export function createAuth(deps: Deps, mailer: Mailer, delivery: DeliveryState = { failedKind: null }) {
  const { authSecret, appUrl } = deps.env;
  if (!authSecret || !appUrl) throw notConfigured();

  const send = async (mail: Mail) => {
    try {
      await mailer.send(mail);
    } catch {
      delivery.failedKind = mail.kind;
    }
  };

  /**
   * For password reset, which only sends when the account exists: sending after the response keeps
   * the response time from showing which addresses have accounts.
   */
  const sendAfterResponse = async (mail: Mail) => {
    const task = mailer.send(mail).catch(() =>
      recordSecurityEvent(deps.d1, { event: "mail.delivery_failed", outcome: "failure", metadata: { kind: mail.kind }, at: deps.now() }),
    );
    if (deps.waitUntil) deps.waitUntil(task);
    else await task;
  };

  return betterAuth({
    appName: "Rankvora AI",
    baseURL: appUrl,
    basePath: AUTH_BASE_PATH,
    secret: authSecret,
    trustedOrigins: [appUrl],
    telemetry: { enabled: false },
    // Unexpected errors come back to our handler, which logs them without bound values. Left to
    // itself the library prints the whole error, including tokens in query parameters.
    onAPIError: { throw: true },
    logger: {
      log: (level, message, ...details) => {
        log(level === "error" ? "error" : level === "warn" ? "warn" : "info", "auth.library", {
          message: withoutParams(String(message)).slice(0, 500),
          detail: details.map((detail) => (detail instanceof Error ? describeError(detail) : "")).filter(Boolean).join(" | ") || undefined,
        });
      },
    },
    // revoke-other-sessions is replaced by a single statement in api/auth/revoke-other-sessions: the
    // library deletes sessions one by one and would pass the Free plan's 50 queries per request.
    // verify-email is replaced by confirm-email, which also asks for the password.
    disabledPaths: ["/revoke-other-sessions", "/verify-email"],
    // `transaction: false`: D1 has no interactive transactions.
    database: drizzleAdapter(createDb(deps.d1), {
      provider: "sqlite",
      transaction: false,
      schema: {
        user: users,
        session: userSessions,
        account: authAccounts,
        verification: authVerifications,
        rateLimit: authRateLimits,
        twoFactor: authTwoFactors,
      },
    }),
    user: {
      additionalFields: { status: { type: "string", required: false, defaultValue: "active", input: false } },
      // Requires the password, or a session younger than `freshAge`.
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          // Otherwise a suspended account could delete itself and sign up again.
          if ((user as { status?: unknown }).status === "suspended") {
            throw new APIError("FORBIDDEN", { code: "ACCOUNT_SUSPENDED", message: "This account is suspended. Contact support." });
          }
          try {
            await releaseMemberships(deps.d1, user, deps.now());
          } catch (error) {
            if (error instanceof SoleOwnerError) {
              const names = error.organizationNames.join(", ");
              throw new APIError("BAD_REQUEST", {
                code: "SOLE_OWNER",
                message: error.includesSuspended
                  ? `You are the only owner of a suspended organization (${names}). Contact support.`
                  : `Add another owner or delete these organizations first: ${names}`,
              });
            }
            throw error;
          }
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendAfterResponse(resetPasswordMail(user.email, url)),
      // The reset link went to this address and its reader chose the new password, so the address is
      // confirmed. It is also how an owner takes back an address that someone else signed up with.
      onPasswordReset: async ({ user }) => {
        await prepare(deps.d1, raw(`update users set email_verified = 1, updated_at = ? where id = ? and email_verified = 0`, deps.now(), user.id)).run();
      },
      // Sign-up answers the same for a new and an existing address, so both get an email.
      onExistingUserSignUp: async ({ user }) => send(existingAccountMail(user.email)),
    },
    emailVerification: {
      sendOnSignUp: true,
      // So that a stranger's sign-in attempt cannot mail the owner of the address again.
      sendOnSignIn: false,
      expiresIn: DAY,
      // The library's own link would confirm without a password, so the email links to our page.
      sendVerificationEmail: async ({ user, token }) => {
        const link = new URL(CONFIRM_EMAIL_PATH, appUrl);
        link.searchParams.set("token", token);
        await send(verifyEmailMail(user.email, link.href));
      },
    },
    session: {
      expiresIn: 7 * DAY,
      updateAge: DAY,
      freshAge: 15 * 60,
      // No cookie cache: a revoked session stops working on the next request.
      cookieCache: { enabled: false },
    },
    databaseHooks: {
      user: {
        create: { before: async (user) => ({ data: { ...user, name: validName(user.name) } }) },
        update: {
          before: async (changes) => (changes.name === undefined ? undefined : { data: { ...changes, name: validName(changes.name) } }),
        },
      },
      session: {
        create: {
          before: async (session) => {
            const row = await prepare(deps.d1, raw(`select status from users where id = ?`, session.userId)).first<{ status: string }>();
            if (row?.status === "suspended") {
              throw new APIError("FORBIDDEN", { code: "ACCOUNT_SUSPENDED", message: "This account is suspended." });
            }
          },
        },
      },
    },
    // Counters live in D1 because Worker isolates do not share memory.
    rateLimit: { enabled: true, storage: "database", window: 60, max: 100 },
    advanced: {
      cookiePrefix: "rv",
      useSecureCookies: appUrl.startsWith("https://"),
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    plugins: [twoFactor({ issuer: "Rankvora AI" }), confirmEmailWithPassword(MAX_PASSWORD_LENGTH)],
  });
}

export type Auth = ReturnType<typeof createAuth>;
