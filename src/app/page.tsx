import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Metric, MetricCell, MetricGrid, Section } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { StoreCard } from "@/features/stores/store-card";
import { formatNumber, formatRelative } from "@/lib/format";
import { pointChange } from "@/lib/stats";
import { getOrganization, getOrgUsage, listAlertHeadlines, listStores } from "@/services/core";
import type { AlertSeverity, Rate, Store } from "@/types/core";

export const metadata: Metadata = { title: "Portfolio" };

const severityTone = { info: "neutral", low: "info", medium: "warning", high: "danger", critical: "danger" } as const satisfies Record<AlertSeverity, string>;

function pooled(stores: Store[], pick: (s: NonNullable<Store["summary"]>) => Rate): Rate {
  return stores.reduce<Rate>((acc, store) => (store.summary ? { n: acc.n + pick(store.summary).n, d: acc.d + pick(store.summary).d } : acc), { n: 0, d: 0 });
}

export default async function PortfolioPage() {
  const [org, stores, alerts, usage] = await Promise.all([getOrganization(), listStores(), listAlertHeadlines(), getOrgUsage()]);
  const tracked = stores.filter((s) => s.summary);

  const mention = pooled(tracked, (s) => s.mention);
  const mentionPrev = pooled(tracked, (s) => s.mentionPrevious);
  const recommendation = pooled(tracked, (s) => s.recommendation);
  const recommendationPrev = pooled(tracked, (s) => s.recommendationPrevious);
  const citationStores = tracked.filter((s) => (s.summary?.ownedCitation.d ?? 0) > 0);
  const citation = pooled(citationStores, (s) => s.ownedCitation);
  const citationPrev = pooled(citationStores, (s) => s.ownedCitationPrevious);
  const noCitation = tracked.length - citationStores.length;
  const alertTotal = tracked.reduce((n, s) => n + (s.summary?.openAlerts ?? 0), 0);
  const taskTotal = tracked.reduce((n, s) => n + (s.summary?.pendingTasks ?? 0), 0);
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  const basis = `Pooled across ${tracked.length} stores`;

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle={`${org.name} · ${stores.length} stores`}
        actions={<ButtonLink href="/stores/new" variant="primary" icon="plus">Add store</ButtonLink>}
      />

      <Section title="Organization roll-up" actions={<Badge tone="neutral" icon="layers">Pooled, not averaged</Badge>}>
        <MetricGrid>
          <MetricCell>
            <Metric
              label="Brand mention rate"
              numerator={mention.n}
              denominator={mention.d}
              basis={basis}
              delta={{ points: pointChange(mentionPrev, mention), versus: "vs previous run" }}
              info="Pooled response-level rate across stores. Not an average of store percentages."
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Recommendation rate"
              numerator={recommendation.n}
              denominator={recommendation.d}
              basis={basis}
              delta={{ points: pointChange(recommendationPrev, recommendation), versus: "vs previous run" }}
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Owned citation rate"
              numerator={citation.n}
              denominator={citation.d}
              unit="citation-capable responses"
              basis={noCitation ? `${noCitation} store has no citation data` : basis}
              delta={{ points: pointChange(citationPrev, citation), versus: "vs previous run" }}
            />
          </MetricCell>
          <MetricCell>
            <div className="flex flex-col gap-3">
              <Metric label="Open alerts" value={String(alertTotal)} basis="across stores" />
              <p className="tnum text-xs text-fg-subtle"><span className="font-semibold text-fg">{taskTotal}</span> fix tasks pending</p>
            </div>
          </MetricCell>
        </MetricGrid>
      </Section>

      <Section title="Stores" className="mt-6" actions={<ButtonLink href="/stores" variant="ghost" size="sm" trailingIcon="arrow-right">All stores</ButtonLink>}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      </Section>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Needs attention" subtitle="Latest alerts across all stores" />
          <CardBody className="pt-2">
            <ul className="divide-y divide-line">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <Link href={`/stores/${alert.storeId}/monitoring/alerts`} className="flex items-start gap-3 rounded-control py-2.5 hover:bg-surface-2/60 sm:px-2 sm:-mx-2">
                    <Icon name={alert.read ? "bell" : "circle-dot"} size={16} className={alert.read ? "mt-0.5 text-fg-subtle" : "mt-0.5 text-accent-text"} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-fg">{alert.title}</p>
                      <p className="mt-0.5 text-xs text-fg-subtle">{storeName(alert.storeId)} · {formatRelative(alert.at)}</p>
                    </div>
                    <Badge tone={severityTone[alert.severity]} className="capitalize">{alert.severity}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Usage" subtitle={`Provider requests · ${usage.periodLabel}`} actions={<ButtonLink href="/settings/billing" variant="ghost" size="sm">Details</ButtonLink>} />
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-fg-muted">Organization</span>
                <span className="tnum text-xs text-fg-subtle"><span className="text-sm font-semibold text-fg">{formatNumber(usage.requests)}</span> / {formatNumber(usage.requestCap)}</span>
              </div>
              <Progress value={usage.requests} max={usage.requestCap} label="Organization request usage" />
            </div>
            <ul className="flex flex-col gap-3 border-t border-line pt-3">
              {usage.perStore.map((row) => (
                <li key={row.storeId} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs text-fg-muted">{storeName(row.storeId)}</span>
                    <span className="tnum shrink-0 text-xs text-fg-subtle">{formatNumber(row.requests)} / {formatNumber(row.cap)}</span>
                  </div>
                  <Progress value={row.requests} max={row.cap} label={`${storeName(row.storeId)} request usage`} tone={row.requests / row.cap > 0.85 ? "warning" : "accent"} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
