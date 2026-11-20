import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

import { integrationsHref } from "./labels";

/**
 * Shown on the Audits list and the Start audit wizard while a website has no AI channel.
 * Audits ask AI providers, so nothing can run; the one action is to connect a platform.
 */
export function AuditSetupBlocked({ storeName }: { storeName: string }) {
  return (
    <EmptyState
      icon="plug"
      title="Connect an AI platform to run audits"
      description={`${storeName} has no AI platform connected. Audits ask AI providers your prompts.`}
      action={
        <ButtonLink href={integrationsHref()} variant="primary" icon="plug">
          Connect an AI platform
        </ButtonLink>
      }
    />
  );
}
