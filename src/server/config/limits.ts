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
