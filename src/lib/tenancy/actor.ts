/**
 * The authenticated person performing an action. Services never accept a
 * userId from request input: an Actor is created only by the auth layer
 * (see src/lib/auth/actor.ts) after the session has been verified.
 */
export type Actor = { readonly userId: string };
