import type { Actor } from "@/lib/tenancy/actor";

export class AuthNotConfiguredError extends Error {
  constructor() {
    super(
      "Authentication has not been configured yet. Route handlers cannot " +
        "resolve a signed-in user until an auth provider is wired in here.",
    );
    this.name = "AuthNotConfiguredError";
  }
}

/**
 * The single place where a request becomes an Actor. Until an auth provider
 * is chosen this fails closed, so no store data can be reached over HTTP
 * without a verified user.
 */
export async function requireActor(): Promise<Actor> {
  throw new AuthNotConfiguredError();
}
