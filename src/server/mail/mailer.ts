/**
 * Transactional email. There is no pretend sender: with no provider configured, every action that
 * needs email is refused with EMAIL_NOT_CONFIGURED before anything is created.
 *
 *  - resend:     RESEND_API_KEY + MAIL_FROM (https://resend.com/docs/api-reference/emails/send-email)
 *  - cloudflare: a `send_email` binding named EMAIL + MAIL_FROM. On the Workers Free plan it only
 *                delivers to verified destination addresses.
 *  - console:    prints the message to the dev server terminal. Refused unless APP_URL is
 *                localhost, so verification and reset links can never end up in production logs.
 */
import { isLocalUrl, type AppEnv } from "../env";
import { ApiError } from "../http/errors";
import { describeError, log } from "../logger";

export type MailKind = "verify_email" | "existing_account" | "reset_password" | "invitation";

export type Mail = {
  kind: MailKind;
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Lets the provider drop a duplicate send. */
  idempotencyKey?: string;
};

export type Mailer = {
  configured: boolean;
  transport: "resend" | "cloudflare" | "console" | "none";
  /** Resolves only when the provider accepted the message. */
  send(mail: Mail): Promise<void>;
};

export const emailNotConfigured = () => new ApiError(503, "email_not_configured", "Email delivery is not set up on this server yet.");

export class MailDeliveryError extends Error {
  constructor(readonly code: string) {
    super(`mail delivery failed: ${code}`);
    this.name = "MailDeliveryError";
  }
}

const SEND_TIMEOUT_MS = 10_000;

export function createMailer(env: AppEnv, fetcher: typeof fetch = fetch): Mailer {
  const { mailTransport, mailFrom } = env;

  if (mailTransport === "resend" && env.resendApiKey && mailFrom) {
    const apiKey = env.resendApiKey;
    return {
      configured: true,
      transport: "resend",
      async send(mail) {
        let response: Response;
        try {
          response = await fetcher("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              ...(mail.idempotencyKey ? { "Idempotency-Key": mail.idempotencyKey } : {}),
            },
            body: JSON.stringify({ from: mailFrom, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html }),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
          });
        } catch (error) {
          log("error", "mail.transport_error", { transport: "resend", kind: mail.kind, error: describeError(error) });
          throw new MailDeliveryError("network_error");
        }
        if (!response.ok) {
          log("error", "mail.rejected", { transport: "resend", kind: mail.kind, status: response.status });
          throw new MailDeliveryError(response.status === 429 ? "rate_limited" : `http_${response.status}`);
        }
      },
    };
  }

  if (mailTransport === "cloudflare" && env.emailBinding && mailFrom) {
    const binding = env.emailBinding;
    return {
      configured: true,
      transport: "cloudflare",
      async send(mail) {
        try {
          await binding.send({ to: mail.to, from: mailFrom, subject: mail.subject, text: mail.text, html: mail.html });
        } catch (error) {
          const code = (error as { code?: unknown } | null)?.code;
          log("error", "mail.rejected", { transport: "cloudflare", kind: mail.kind, error: describeError(error) });
          throw new MailDeliveryError(typeof code === "string" ? code : "send_failed");
        }
      },
    };
  }

  if (mailTransport === "console" && isLocalUrl(env.appUrl)) {
    return {
      configured: true,
      transport: "console",
      async send(mail) {
        console.log(`\n[mail:console] ${mail.kind} to ${mail.to}\n${mail.subject}\n${mail.text}\n`);
      },
    };
  }

  return {
    configured: false,
    transport: "none",
    async send() {
      throw new MailDeliveryError("not_configured");
    },
  };
}
