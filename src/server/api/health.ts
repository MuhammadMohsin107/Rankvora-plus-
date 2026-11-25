/**
 * Public readiness check for the backend. Reports only whether each part is configured, never values
 * or error messages. 200 when sign-up can work end to end, otherwise 503.
 */
import type { Deps } from "../env";
import { createMailer } from "../mail/mailer";

export async function backendHealth(deps: Deps): Promise<Response> {
  let migrations = false;
  try {
    // One table from each migration area; the trigger query proves 0002 ran.
    await deps.d1.prepare("select 1 from organizations limit 1").first();
    await deps.d1.prepare("select 1 from website_domains limit 1").first();
    const trigger = await deps.d1.prepare("select 1 as found from sqlite_master where type = 'trigger' and name = 'organization_members_last_owner_update'").first();
    migrations = trigger !== null;
  } catch {
    migrations = false;
  }
  const mailer = createMailer(deps.env);
  const checks = {
    database: true,
    migrations,
    authSecret: deps.env.authSecret !== null,
    appUrl: deps.env.appUrl !== null,
    email: mailer.configured,
  };
  const ready = Object.values(checks).every(Boolean);
  return Response.json({ status: ready ? "ok" : "not_ready", checks }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
