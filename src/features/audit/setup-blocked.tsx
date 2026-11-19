import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

import { integrationsHref } from "./labels";

/**
 * Shown on the Audits list and the Start audit wizard while a store has no AI channel.
 * Audits ask AI providers, so nothing can run; the one action is to connect a platform.
 */
export function AuditSetupBlocked({ storeId, storeName }: { storeId: string; storeName: string }) {
  return (
    <EmptyState
      icon="plug"
      title="Connect an AI platform to run audits"
      description={`${storeName} has no AI channel connected yet. An audit asks AI providers your prompts, so it cannot start until one is connected.`}
      action={
        <ButtonLink href={integrationsHref(storeId)} variant="primary" icon="plug">
          Connect an AI platform
        </ButtonLink>
      }
    />
  );
}
