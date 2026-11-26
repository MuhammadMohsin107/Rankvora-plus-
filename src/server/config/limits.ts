/**
 * Limits given to every new organization. These are product policy, not billing data: there are no
 * plans or payments yet (roadmap Phase 10). Change a single organization by updating its row in
 * `organization_entitlements` with source 'manual'.
 */
export const DEFAULT_ENTITLEMENTS = {
  maxWebsites: 5,
  /** Active members plus pending invitations. */
  maxMembers: 10,
  maxActivePrompts: 100,
  monthlyAiRequests: 1_000,
  monthlySearchCalls: 1_000,
} as const;

/** Abuse limits. */
export const MAX_OWNED_ORGANIZATIONS = 5;
export const MAX_ACTIVE_DOMAINS_PER_WEBSITE = 20;

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const INVITATION_MAX_SENDS = 5;
/**
 * Invitation emails allowed in any 24 hours. They stop the invite endpoint being used to mail
 * strangers; revoking an invitation does not give the allowance back.
 */
export const INVITATION_DAILY_SENDS = { perOrganization: 30, perSender: 30, perRecipient: 5 } as const;
export const INVITATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export const VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const VERIFICATION_CHECK_COOLDOWN_MS = 10 * 1000;

export const USAGE_RESERVATION_TTL_MS = 60 * 60 * 1000;

export const DOMAIN_CHECK_COOLDOWN_MS = 10 * 1000;

/** Per website. Abuse guards, not plan limits: active prompts are limited by the entitlement above. */
export const MAX_BRAND_FACTS_PER_WEBSITE = 500;
export const MAX_SOURCES_PER_FACT = 10;
export const MAX_SOURCE_PAGES_PER_WEBSITE = 200;
export const MAX_COMPETITORS_PER_WEBSITE = 50;
export const MAX_DOMAINS_PER_COMPETITOR = 10;
export const MAX_PRODUCTS_PER_WEBSITE = 500;
export const MAX_PROMPT_GROUPS_PER_WEBSITE = 100;
export const MAX_PROMPTS_PER_WEBSITE = 2_000;
export const MAX_TAGS_PER_PROMPT = 10;
export const MAX_PRODUCTS_PER_PROMPT = 20;

export const MAX_BULK_PROMPTS = 100;
export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BODY_BYTES = 512 * 1024;
