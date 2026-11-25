import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

type Props = {
  storeId: string;
  kind: "findings" | "tasks";
  hasAiPlatform: boolean;
  hasFindings: boolean;
};

/** Designed empty state for Fixes with exactly one next action. Findings come from audits; audits need an AI platform. */
export function FixesEmpty({ storeId, kind, hasAiPlatform, hasFindings }: Props) {
  const base = `/stores/${storeId}`;

  if (!hasAiPlatform) {
    return (
      <EmptyState
        icon="fixes"
        title={kind === "findings" ? "No findings yet" : "No tasks yet"}
        action={
          <ButtonLink href={`${base}/settings`} variant="primary" icon="plug">
            Connect an AI platform
          </ButtonLink>
        }
      />
    );
  }

  if (kind === "tasks" && hasFindings) {
    return (
      <EmptyState
        icon="fixes"
        title="No tasks yet"
        action={
          <ButtonLink href={`${base}/fixes`} variant="primary">
            Open findings
          </ButtonLink>
        }
      />
    );
  }

  return (
    <EmptyState
      icon="fixes"
      title={kind === "findings" ? "No findings yet" : "No tasks yet"}
      action={
        <ButtonLink href={`${base}/audits/new`} variant="primary" icon="plus">
          Start audit
        </ButtonLink>
      }
    />
  );
}
