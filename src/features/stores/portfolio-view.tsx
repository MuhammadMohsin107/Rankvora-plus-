"use client";

import Link from "next/link";
import { useMemo } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { buildWebsiteLookup, rowWebsite } from "@/components/shell/row-website";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Metric, MetricCell, MetricGrid, Section } from "@/components/ui/card";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Timeline } from "@/components/ui/misc";
import { isAlertUnread, useDemoAlerts, useDemoCollection, useDemoEvents } from "@/demo-state";
import { formatNumber, formatRelative } from "@/lib/format";
import { OPEN_TASK_STATUSES } from "@/lib/record-status";
import type { PortfolioTask } from "@/services/dashboard";
import type { ActivityItem, AlertHeadline, AlertSeverity, OrgUsage, Store } from "@/types/core";

import { mergeActivity } from "./activity";
import { POOLED_EXPLANATION, pooledLabel, pooledRollup } from "./rollup";
import { WebsiteCard } from "./website-card";

const severityTone = { info: "neutral", low: "info", medium: "warning", high: "danger", critical: "danger" } as const satisfies Record<AlertSeverity, string>;

type Props = {
  stores: Store[];
  alerts: AlertHeadline[];
  tasks: PortfolioTask[];
  usage: OrgUsage;
  activity: ActivityItem[];
};

type Attention = { id: string; icon: "alert-circle" | "bell" | "fixes"; text: string; website: string; href: string; badge?: { label: string; tone: "warning" | "info" | "danger" | "neutral" } };

export function PortfolioView({ stores, alerts, tasks, usage, activity }: Props) {
  const { rows: websites } = useDemoCollection<Store>("websites", stores);
  const { rows: alertRows, unreadCount } = useDemoAlerts(alerts);
  const { rows: taskRows } = useDemoCollection<PortfolioTask>("tasks", tasks);
  const events = useDemoEvents();

  const scope = useMemo(() => websites.filter((w) => w.status !== "archived"), [websites]);
  const rollup = useMemo(() => pooledRollup(scope), [scope]);
  const nameOf = (id: string) => websites.find((w) => w.id === id)?.name ?? id;

  const lookup = useMemo(() => buildWebsiteLookup(events), [events]);
  const countsBy = useMemo(() => {
    const out = new Map<string, { unreadAlerts: number; pendingTasks: number; awaiting: number }>();
    const entry = (id: string) => {
      const found = out.get(id) ?? { unreadAlerts: 0, pendingTasks: 0, awaiting: 0 };
      out.set(id, found);
      return found;
    };
    for (const a of alertRows) if (isAlertUnread(a)) entry(a.storeId).unreadAlerts += 1;
    for (const t of taskRows) {
      const id = rowWebsite(t, lookup);
      if (!id) continue;
      if (OPEN_TASK_STATUSES.has(t.status)) entry(id).pendingTasks += 1;
      if (t.status === "pending_approval") entry(id).awaiting += 1;
    }
    return out;
  }, [alertRows, taskRows, lookup]);

  const attention = useMemo<Attention[]>(() => {
    const items: Attention[] = [];
    for (const w of scope) {
      if (!w.summary && (w.status === "draft" || w.status === "needs_review" || w.status === "ready")) {
        items.push({ id: `setup-${w.id}`, icon: "alert-circle", text: w.channelIds.length === 0 ? "Choose AI channels to start tracking" : "Run a first audit", website: w.name, href: w.channelIds.length === 0 ? `/stores/${w.id}/settings` : `/stores/${w.id}/audits/new`, badge: { label: "Setup", tone: "warning" } });
      }
    }
    for (const a of [...alertRows].filter(isAlertUnread).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 3)) {
      items.push({ id: a.id, icon: "bell", text: a.title, website: nameOf(a.storeId), href: `/stores/${a.storeId}/monitoring/alerts`, badge: { label: a.severity, tone: severityTone[a.severity] } });
    }
    for (const w of scope) {
      const awaiting = countsBy.get(w.id)?.awaiting ?? 0;
      if (awaiting > 0) items.push({ id: `fix-${w.id}`, icon: "fixes", text: `${awaiting} ${awaiting === 1 ? "fix" : "fixes"} awaiting approval`, website: w.name, href: `/stores/${w.id}/fixes/tasks`, badge: { label: "Approval", tone: "info" } });
    }
    return items.slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nameOf only reads `websites`
  }, [scope, alertRows, countsBy, websites]);

  const feed = useMemo(() => mergeActivity(activity, events, { limit: 6 }), [activity, events]);
  const taskTotal = [...countsBy.values()].reduce((n, c) => n + c.pendingTasks, 0);
  const usageTotal = usage.requests;

  return (
    <>
      <HeaderAction>
        <ButtonLink href="/stores/new" variant="primary" icon="plus" size="sm">Add website</ButtonLink>
      </HeaderAction>

      {scope.length === 0 ? (
        <EmptyState icon="globe" title="No websites yet" description="Add a website to start tracking." action={<ButtonLink href="/stores/new" variant="primary" icon="plus">Add website</ButtonLink>} />
      ) : (
        <div className="flex flex-col gap-6">
          <Section
            title="Organization roll-up"
            actions={
              <Badge tone="neutral" icon="layers" title={POOLED_EXPLANATION}>
                {pooledLabel(rollup)}
              </Badge>
            }
          >
            <MetricGrid>
              <MetricCell>
                <Metric label="Brand mention rate" numerator={rollup.mention.n} denominator={rollup.mention.d} delta={rollup.change.mention === null ? undefined : { points: rollup.change.mention }} naReason={rollup.mention.d === 0 ? "No tracking data yet" : undefined} info="Responses that mention the brand ÷ successful, analysed responses, pooled across websites." />
              </MetricCell>
              <MetricCell>
                <Metric label="Recommendation rate" numerator={rollup.recommendation.n} denominator={rollup.recommendation.d} delta={rollup.change.recommendation === null ? undefined : { points: rollup.change.recommendation }} naReason={rollup.recommendation.d === 0 ? "No tracking data yet" : undefined} />
              </MetricCell>
              <MetricCell>
                <Metric
                  label="Owned citation rate"
                  numerator={rollup.citation.n}
                  denominator={rollup.citation.d}
                  unit="citation-capable responses"
                  basis={rollup.citationWebsites > 0 ? `${rollup.citationWebsites} of ${rollup.tracked} ${rollup.tracked === 1 ? "website" : "websites"}` : undefined}
                  delta={rollup.change.citation === null ? undefined : { points: rollup.change.citation }}
                  naReason={rollup.citation.d === 0 ? "No citation data from these channels" : undefined}
                />
              </MetricCell>
              <MetricCell>
                <div className="flex flex-col gap-1.5">
                  <Metric label="Unread alerts" value={String(unreadCount)} />
                  <p className="tnum text-helper text-fg-subtle">{taskTotal} open fix {taskTotal === 1 ? "task" : "tasks"}</p>
                </div>
              </MetricCell>
            </MetricGrid>
            <p className="tnum text-helper text-fg-muted">
              {rollup.tracked} of {rollup.total} websites · {rollup.markets.length} {rollup.markets.length === 1 ? "market" : "markets"}
              {rollup.markets.length ? ` (${rollup.markets.join(", ")})` : ""} · counts added, not averaged
              {rollup.untracked.length > 0 ? ` · ${rollup.untracked.map((w) => w.name).join(", ")} N/A (no data yet)` : ""}
            </p>
          </Section>

          <Section title="Websites" actions={<ButtonLink href="/stores" variant="ghost" size="sm" trailingIcon="arrow-right">All websites</ButtonLink>}>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
              {scope.map((w) => (
                <WebsiteCard key={w.id} store={w} counts={countsBy.get(w.id)} />
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Needs attention" />
              <CardBody className="pt-2">
                {attention.length === 0 ? (
                  <p className="py-3 text-body-sm text-fg-muted">Nothing needs attention.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {attention.map((item) => (
                      <li key={item.id}>
                        <Link href={item.href} className="flex items-start gap-3 rounded-control py-2.5 hover:bg-surface-2/60 sm:-mx-2 sm:px-2">
                          <Icon name={item.icon} size={16} className="mt-0.5 shrink-0 text-fg-muted" />
                          <div className="min-w-0 flex-1">
                            <p className="text-body-sm text-fg">{item.text}</p>
                            <p className="mt-0.5 text-helper text-fg-muted">{item.website}</p>
                          </div>
                          {item.badge ? <Badge tone={item.badge.tone} className="capitalize">{item.badge.label}</Badge> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Recent activity" />
              <CardBody>
                {feed.length === 0 ? (
                  <p className="text-body-sm text-fg-muted">No activity yet.</p>
                ) : (
                  <Timeline items={feed.map((a) => ({ id: a.id, title: a.title, meta: `${nameOf(a.websiteId)} · ${a.detail}`, time: formatRelative(a.at), icon: a.icon, tone: a.tone }))} />
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Usage" subtitle={`Provider requests · ${usage.periodLabel}`} actions={<ButtonLink href="/settings/billing" variant="ghost" size="sm">Details</ButtonLink>} />
            <CardBody className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-label font-medium text-fg-muted">Organization total</span>
                <span className="tnum text-helper text-fg-muted"><span className="text-body font-semibold text-fg">{formatNumber(usageTotal)}</span> / {formatNumber(usage.requestCap)}</span>
              </div>
              <Progress value={usageTotal} max={usage.requestCap} label="Organization request usage" tone={usageTotal / usage.requestCap > 0.85 ? "warning" : "accent"} />
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
