import Link from "next/link";

import { Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Metric } from "@/components/ui/card";
import { WebsiteAvatar } from "@/components/ui/avatar";
import { siteTypeLabel } from "@/lib/labels";
import { pointChange } from "@/lib/stats";
import type { Store } from "@/types/core";

import { nextWebsiteAction, untrackedReason } from "./website-model";

export type WebsiteCounts = { unreadAlerts?: number; pendingTasks?: number };

/** One website: identity, status, its own key rates with counts, and ONE next action. */
export function WebsiteCard({ store, counts, onDelete }: { store: Store; counts?: WebsiteCounts; onDelete?: () => void }) {
  const summary = store.summary;
  const action = nextWebsiteAction(store, counts);
  return (
    <Card as="article" className="relative flex h-full flex-col gap-3 p-4 transition-shadow duration-[var(--dur-fast)] hover:shadow-pop has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <WebsiteAvatar name={store.name} size="md" />
          <div className="min-w-0">
            <h2 className="truncate text-card-title font-semibold text-fg" title={store.name}>
              <Link href={`/stores/${store.id}`} className="rounded after:absolute after:inset-0 after:rounded-card after:content-[''] hover:underline">{store.name}</Link>
            </h2>
            <p className="truncate text-helper text-fg-muted" title={store.domain}>{store.domain}</p>
          </div>
        </div>
        <Status kind="store" value={store.status} />
      </div>

      <p className="text-helper text-fg-muted">
        {store.marketName} · {store.language.toUpperCase()} · {siteTypeLabel(store.platform)}
      </p>

      {summary ? (
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Mention rate" numerator={summary.mention.n} denominator={summary.mention.d} delta={{ points: pointChange(summary.mentionPrevious, summary.mention) }} />
          <Metric label="Recommendation" numerator={summary.recommendation.n} denominator={summary.recommendation.d} delta={{ points: pointChange(summary.recommendationPrevious, summary.recommendation) }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Mention rate" naReason={untrackedReason(store)} />
          <Metric label="Recommendation" naReason="Not tracked yet" />
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-2.5">
        <p className="min-w-0 text-helper text-fg-muted">{action.reason}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {onDelete ? (
            <Button variant="danger-ghost" size="sm" icon="trash" onClick={onDelete} className="relative z-10">
              Delete
            </Button>
          ) : null}
          <ButtonLink href={action.href} variant="secondary" size="sm" trailingIcon="arrow-right" className="relative z-10">{action.label}</ButtonLink>
        </div>
      </div>
    </Card>
  );
}
