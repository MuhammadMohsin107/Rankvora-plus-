/**
 * Confirming an email address takes the account's password as well as the emailed link.
 *
 * With the link alone, someone could sign up with another person's address and, if that person opened
 * the email, get a working account in their name. The owner of the address does not know that
 * password; they take the address back with a password reset. It also means a mail scanner that opens
 * every link confirms nothing.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { verifyJWT } from "better-auth/crypto";
import { z } from "zod";

/** Under the auth base path. The page people open has the same name. */
export const CONFIRM_EMAIL_PATH = "/confirm-email";

const badLink = () => new APIError("BAD_REQUEST", { code: "INVALID_TOKEN", message: "This link no longer works." });

/**
 * What the library signs into a confirmation link. A change-of-address link is not accepted here.
 * Exported for the tests: in zod, a key typed `undefined` is required unless it is also optional.
 */
export const confirmLinkPayload = z.object({
  email: z.email(),
  userId: z.string().min(1),
  updateTo: z.undefined().optional(),
  requestType: z.undefined().optional(),
});

export function confirmEmailWithPassword(maxPasswordLength: number) {
  return {
    id: "confirm-email-with-password",
    endpoints: {
      confirmEmail: createAuthEndpoint(
        CONFIRM_EMAIL_PATH,
        { method: "POST", body: z.object({ token: z.string().min(1).max(2048), password: z.string().min(1).max(maxPasswordLength) }) },
        async (ctx) => {
          // Null when the signature is wrong or the link has expired.
          const payload = confirmLinkPayload.safeParse(await verifyJWT(ctx.body.token, ctx.context.secret));
          if (!payload.success) throw badLink();
          const found = await ctx.context.internalAdapter.findUserByEmail(payload.data.email);
          if (!found || found.user.id !== payload.data.userId) throw badLink();

          if (!found.user.emailVerified) {
            const account = await ctx.context.internalAdapter.findCredentialAccount(found.user.id);
            const matches = account?.password ? await ctx.context.password.verify({ hash: account.password, password: ctx.body.password }) : false;
            if (!matches) throw new APIError("BAD_REQUEST", { code: "INVALID_PASSWORD", message: "Wrong password." });
            await ctx.context.internalAdapter.updateUser(found.user.id, { emailVerified: true });
          }
          // No session: signing in is a separate step, with two-step verification if it is on.
          return ctx.json({ status: true, user: { id: found.user.id } });
        },
      ),
    },
    // Each attempt hashes a password, so attempts are held far below the general limit.
    rateLimit: [{ pathMatcher: (path: string) => path === CONFIRM_EMAIL_PATH, window: 60, max: 5 }],
  } satisfies BetterAuthPlugin;
}
