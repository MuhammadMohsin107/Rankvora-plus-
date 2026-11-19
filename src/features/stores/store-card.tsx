import Link from "next/link";

import { Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Metric } from "@/components/ui/card";
import { formatRelative } from "@/lib/format";
import { pointChange } from "@/lib/stats";
import type { Store } from "@/types/core";

function Stat({ icon, label, value }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} size={14} className="text-fg-subtle" />
      <span className="tnum text-sm font-semibold text-fg">{value}</span>
      <span className="text-xs text-fg-subtle">{label}</span>
    </div>
  );
}

/** Store summary card used on the portfolio overview. */
export function StoreCard({ store }: { store: Store }) {
  const summary = store.summary;
  return (
    <Card as="article" className="flex flex-col">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span aria-hidden="true" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-sm font-bold text-accent-text">{store.name.charAt(0)}</span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-fg">
              <Link href={`/stores/${store.id}`} className="rounded hover:underline">{store.name}</Link>
            </h3>
            <p className="truncate text-xs text-fg-subtle">{store.domain} · {store.marketName}</p>
          </div>
        </div>
        <Status kind="store" value={store.status} />
      </div>

      {summary ? (
        <>
          <div className="px-4 pb-3">
            <Metric
              label="Brand mention rate"
              numerator={summary.mention.n}
              denominator={summary.mention.d}
              delta={{ points: pointChange(summary.mentionPrevious, summary.mention) }}
            />
          </div>
          <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line px-4 py-3">
            <Stat icon="alert-circle" label="findings" value={summary.openFindings} />
            <Stat icon="fixes" label="tasks" value={summary.pendingTasks} />
            <Stat icon="bell" label="alerts" value={summary.openAlerts} />
          </div>
          <div className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-xs text-fg-subtle">
            <Icon name="clock" size={13} />{summary.nextRunAt ? `Next run ${formatRelative(summary.nextRunAt)}` : "No schedule"}
          </div>
        </>
      ) : (
        <div className="mt-auto flex flex-col gap-3 border-t border-line p-4">
          <p className="flex items-start gap-2 text-[13px] text-fg-muted"><Icon name="alert-circle" size={15} className="mt-0.5 shrink-0 text-warning" /><span>Mention rate: N/A. No AI channel is connected, so nothing is tracked yet.</span></p>
          <ButtonLink href={`/stores/${store.id}/settings`} variant="secondary" size="sm" className="self-start">Continue setup</ButtonLink>
        </div>
      )}
    </Card>
  );
}
