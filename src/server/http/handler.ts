/**
 * The pipeline every signed-in /api/v1 endpoint goes through. Framework-independent: it takes a
 * Request and returns a Response, so it does not depend on Next.js.
 *
 * Success: { data }. Failure: { error: { code, message, fields?, details?, requestId } }.
 */
import type { z } from "zod";

import { createAuth } from "../auth/auth";
import { createDb, type Db } from "../db/client";
import type { Deps } from "../env";
import { newId, sha256Hex } from "../ids";
import { describeError, log } from "../logger";
import { createMailer, type Mailer } from "../mail/mailer";
import { parseInput } from "../validation";
import { ApiError, forbidden, unauthorized } from "./errors";
import { claimKey, completeKey, readIdempotencyKey, releaseKey, type Claim } from "./idempotency";
import { assertSameOrigin, clientIp, parseJson, readBodyText, userAgent } from "./request";

export type SessionUser = { id: string; name: string; email: string; emailVerified: boolean; twoFactorEnabled: boolean };

export type ApiContext = {
  request: Request;
  requestId: string;
  params: Record<string, string>;
  deps: Deps;
  d1: D1Database;
  db: Db;
  /** One instant for the whole request. */
  now: Date;
  ip: string | null;
  userAgent: string | null;
  user: SessionUser;
  mailer: Mailer;
  /** The caller's session row. */
  sessionId: string;
  /** Filled by the tenancy guard, for logs. */
  organizationId?: string;
  /**
   * Services call this once their write is saved. From then on an error must not free the
   * Idempotency-Key, or a retry would do the work a second time.
   */
  commit(): void;
  body<T extends z.ZodType>(schema: T): z.output<T>;
  query<T extends z.ZodType>(schema: T): z.output<T>;
};

export type ApiResult = { status?: number; data: unknown };

export type ApiHandler = (request: Request, deps: Deps, params?: Record<string, string>) => Promise<Response>;

export function jsonResponse(status: number, body: string, requestId: string, extra?: Headers): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "x-request-id": requestId,
  });
  // The auth library may refresh the session cookie while reading the session.
  for (const cookie of extra?.getSetCookie() ?? []) headers.append("set-cookie", cookie);
  return new Response(body, { status, headers });
}

export function errorResponse(error: ApiError, requestId: string, extra?: Headers): Response {
  const body = { error: { code: error.code, message: error.message, fields: error.fields, details: error.details, requestId } };
  return jsonResponse(error.status, JSON.stringify(body), requestId, extra);
}

export function apiHandler(
  options: { name: string; idempotent?: boolean; maxBodyBytes?: number },
  run: (context: ApiContext) => Promise<ApiResult>,
): ApiHandler {
  return async (request, deps, params = {}) => {
    const requestId = newId("req");
    const started = Date.now();
    let context: ApiContext | undefined;
    let sessionHeaders: Headers | undefined;
    let claim: Claim | null = null;
    let committed = false;
    let response: Response;
    let errorCode: string | undefined;

    try {
      assertSameOrigin(request);
      const mailer = createMailer(deps.env);
      const session = await createAuth(deps, mailer).api.getSession({ headers: request.headers, returnHeaders: true });
      sessionHeaders = session.headers;
      if (!session.response) throw unauthorized();
      const user = session.response.user;
      if (user.status === "suspended") throw forbidden("account_suspended", "This account is suspended.");

      const bodyText = request.method === "GET" || request.method === "HEAD" ? "" : await readBodyText(request, options.maxBodyBytes);
      const url = new URL(request.url);
      context = {
        request,
        requestId,
        params,
        deps,
        d1: deps.d1,
        db: createDb(deps.d1),
        now: deps.now(),
        ip: clientIp(request),
        userAgent: userAgent(request),
        user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled ?? false },
        mailer,
        sessionId: session.response.session.id,
        commit: () => {
          committed = true;
        },
        body: (schema) => parseInput(schema, parseJson(bodyText)),
        query: (schema) => parseInput(schema, Object.fromEntries(url.searchParams)),
      };

      const key = options.idempotent ? readIdempotencyKey(request) : null;
      if (key) {
        const candidate: Claim = { userId: user.id, route: `${request.method} ${url.pathname}`, key };
        const replay = await claimKey(deps.d1, candidate, await sha256Hex(bodyText), context.now);
        if (replay) {
          response = jsonResponse(replay.status, replay.body, requestId, sessionHeaders);
          response.headers.set("idempotent-replayed", "true");
          return response;
        }
        claim = candidate;
      }

      const result = await run(context);
      const status = result.status ?? 200;
      const body = JSON.stringify({ data: result.data });
      if (claim) {
        // The work is done. If saving the replay copy fails, still report the real result and keep the
        // key reserved, so a retry gets "in progress" instead of doing the work twice.
        const finished = claim;
        claim = null;
        await completeKey(deps.d1, finished, status, body).catch((saveError) => log("error", "idempotency.save_failed", { requestId, error: describeError(saveError) }));
      }
      response = jsonResponse(status, body, requestId, sessionHeaders);
    } catch (error) {
      if (claim && !committed) {
        await releaseKey(deps.d1, claim).catch((releaseError) => log("error", "idempotency.release_failed", { requestId, error: describeError(releaseError) }));
      } else if (claim && error instanceof ApiError) {
        // Saved, but something after it failed (for example the invitation email): a retry gets this same answer.
        const answer = JSON.stringify({ error: { code: error.code, message: error.message, details: error.details, requestId } });
        await completeKey(deps.d1, claim, error.status, answer).catch((saveError) => log("error", "idempotency.save_failed", { requestId, error: describeError(saveError) }));
      }
      // Saved, then an unexpected error: the key stays reserved, so a retry cannot repeat the work.
      if (error instanceof ApiError) {
        errorCode = error.code;
        response = errorResponse(error, requestId, sessionHeaders);
      } else {
        errorCode = "internal_error";
        log("error", "api.unhandled", { requestId, route: options.name, error: describeError(error) });
        response = errorResponse(new ApiError(500, "internal_error", "Something went wrong. Try again."), requestId, sessionHeaders);
      }
    }

    log(response.status >= 500 ? "error" : "info", "api.request", {
      requestId,
      route: options.name,
      method: request.method,
      status: response.status,
      durationMs: Date.now() - started,
      userId: context?.user.id,
      organizationId: context?.organizationId,
      errorCode,
    });
    return response;
  };
}
