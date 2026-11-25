import type { Mail } from "./mailer";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function layout(heading: string, body: string, action: { label: string; url: string } | null, footer: string) {
  const text = [heading, body, ...(action ? [`${action.label}: ${action.url}`] : []), footer].join("\n\n") + "\n";
  const button = action
    ? `<p style="margin:0 0 20px"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${escapeHtml(action.label)}</a></p>`
    : "";
  const html = [
    `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827">`,
    `<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(heading)}</h1>`,
    `<p style="margin:0 0 20px">${escapeHtml(body)}</p>`,
    button,
    `<p style="margin:0;font-size:13px;color:#4b5563">${escapeHtml(footer)}</p>`,
    `</div>`,
  ].join("");
  return { text, html };
}

export function verifyEmailMail(to: string, url: string): Mail {
  return {
    kind: "verify_email",
    to,
    subject: "Confirm your email for Rankvora AI",
    ...layout("Confirm your email", "Confirm this address to finish creating your account.", { label: "Confirm email", url }, "The link expires in 24 hours. If you did not sign up, do not open it."),
  };
}

/** Sent when someone signs up with an address that already has an account. The sign-up page answers the same either way. */
export function existingAccountMail(to: string): Mail {
  return {
    kind: "existing_account",
    to,
    subject: "You already have a Rankvora AI account",
    ...layout(
      "You already have an account",
      "Someone tried to sign up with this address. If it was you, sign in instead. If you do not know the password, use Forgot password.",
      null,
      "If it was not you, you can ignore this message.",
    ),
  };
}

export function resetPasswordMail(to: string, url: string): Mail {
  return {
    kind: "reset_password",
    to,
    subject: "Reset your Rankvora AI password",
    ...layout("Reset your password", "Choose a new password. All signed-in devices are signed out afterwards.", { label: "Reset password", url }, "The link expires in 1 hour. If you did not ask for this, ignore this message."),
  };
}

export function invitationMail(input: { to: string; url: string; organizationName: string; inviterName: string; role: string; idempotencyKey: string }): Mail {
  return {
    kind: "invitation",
    to: input.to,
    idempotencyKey: input.idempotencyKey,
    subject: `You are invited to ${input.organizationName} on Rankvora AI`,
    ...layout(
      `Join ${input.organizationName}`,
      `${input.inviterName} invited you as ${input.role}. Sign in with ${input.to} to accept.`,
      { label: "View invitation", url: input.url },
      "The invitation expires in 7 days.",
    ),
  };
}
