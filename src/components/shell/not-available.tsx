import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import type { IconName } from "@/components/ui/icon";

import { PageHeader } from "./page-header";

/**
 * A page whose backend is not built yet. It shows no sample data and offers one way on.
 * The earlier screen designs stay in src/features until their backend exists.
 */
export function NotAvailablePage({ title, icon = "layers" }: { title: string; icon?: IconName }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={icon} title="Not available yet" action={<ButtonLink href="/stores">Go to websites</ButtonLink>} />
    </>
  );
}
