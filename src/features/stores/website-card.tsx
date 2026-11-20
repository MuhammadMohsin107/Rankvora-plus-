import Link from "next/link";

import { Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Metric } from "@/components/ui/card";
import { WebsiteAvatar } from "@/components/ui/avatar";
import { siteTypeLabel } from "@/lib/labels";
import { pointChange } from "@/lib/stats";
import type { Store } from "@/types/core";

import { nextWebsiteAction, untrackedReason } from "./website-model";

export type WebsiteCounts = { unreadAlerts?: number; pendingTasks?: number };

/** One website: identity, status, its own key rates with counts, and ONE next action. */
export function WebsiteCard({ store, counts }: { store: Store; counts?: WebsiteCounts }) {
  const summary = store.summary;
  const action = nextWebsiteAction(store, counts);
  return (
    <Card as="article" className="flex h-full flex-col gap-4 p-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <WebsiteAvatar name={store.name} size="lg" />
          <div className="min-w-0">
            <h3 className="truncate text-card-title font-semibold text-fg">
              <Link href={`/stores/${store.id}`} className="rounded hover:underline">{store.name}</Link>
            </h3>
            <p className="truncate text-helper text-fg-muted">{store.domain}</p>
          </div>
        </div>
        <Status kind="store" value={store.status} />
      </div>

      <p className="text-helper text-fg-muted">
        {store.marketName} · {store.language.toUpperCase()} · {siteTypeLabel(store.platform)}
      </p>

      {summary ? (
        <div className="grid grid-cols-2 gap-4">
          <Metric label="Mention rate" numerator={summary.mention.n} denominator={summary.mention.d} delta={{ points: pointChange(summary.mentionPrevious, summary.mention) }} />
          <Metric label="Recommendation" numerator={summary.recommendation.n} denominator={summary.recommendation.d} delta={{ points: pointChange(summary.recommendationPrevious, summary.recommendation) }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Metric label="Mention rate" naReason={untrackedReason(store)} />
          <Metric label="Recommendation" naReason="Not tracked yet" />
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="min-w-0 truncate text-helper text-fg-muted">{action.reason}</p>
        <ButtonLink href={action.href} variant="secondary" size="sm" trailingIcon="arrow-right">{action.label}</ButtonLink>
      </div>
    </Card>
  );
}
