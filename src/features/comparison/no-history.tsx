import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

const COPY = {
  comparisons: { icon: "compare", title: "No comparisons yet", description: "A comparison needs two snapshots from audits or monitoring runs." },
  snapshots: { icon: "compare", title: "Two snapshots needed", description: "Run an audit or a monitoring run first." },
  reports: { icon: "reports", title: "No reports yet", description: "Reports are created when an audit, a monitoring run or a comparison completes." },
} as const;

/**
 * Empty state of Comparison and Reports. A website without an AI platform cannot run anything,
 * so its one next action is to connect a platform; otherwise it is to start an audit.
 */
export function NoHistory({ storeId, kind, hasChannel }: { storeId: string; kind: keyof typeof COPY; hasChannel: boolean }) {
  const copy = COPY[kind];
  if (!hasChannel) {
    return (
      <EmptyState
        icon={copy.icon}
        title="Connect an AI platform first"
        description={`${copy.description} This website has no AI platform connected yet, so it has no audits or runs.`}
        action={<ButtonLink href={`/stores/${storeId}/settings`} variant="primary" icon="plug">Connect an AI platform</ButtonLink>}
      />
    );
  }
  return (
    <EmptyState
      icon={copy.icon}
      title={copy.title}
      description={copy.description}
      action={<ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>}
    />
  );
}
