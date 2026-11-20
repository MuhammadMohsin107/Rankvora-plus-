"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { LineChart } from "@/components/charts/line-chart";
import { ChartEmpty } from "@/components/charts/chart-states";
import { HeaderAction } from "@/components/shell/page-chrome";
import { buildWebsiteLookup, rowWebsite } from "@/components/shell/row-website";
import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, ChartCard, Metric } from "@/components/ui/card";
import { DateRange, makeRange, type DateRangeValue } from "@/components/ui/date-range";
import { DemoBadge, TrustLabel } from "@/components/ui/demo";
import { Progress, Spinner } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { Timeline } from "@/components/ui/misc";
import { useDemoAlerts, useDemoCollection, useDemoEvents, useDemoSettings } from "@/demo-state";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import { usePrompts } from "@/features/prompts/use-prompts";
import { formatDate, formatPoints, formatRate, formatRelative, formatShortDate, formatTime, DEMO_NOW, ratePercent } from "@/lib/format";
import type { STATUS } from "@/lib/status";
import { pointChange } from "@/lib/stats";
import type { DashboardData, DashboardFinding, DashboardTask } from "@/services/dashboard";
import type { Competitor, Store } from "@/types/core";

import { mergeActivity } from "../activity";
import { settingKey } from "../settings/keys";
import { biggestProblem, changeInWindow, nextAction, runsInWindow } from "./decide";

const ANCHOR = DEMO_NOW.slice(0, 10);
const NO_SAVED: { list?: Competitor[] } = {};

type FindingStatus = keyof typeof STATUS.finding;

const pctText = (n: number, d: number) => formatRate(n, d);

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="metric" as="section" className="flex flex-col gap-3">
      <h2 className="text-label font-medium text-fg-muted">{title}</h2>
      {children}
    </Card>
  );
}

/** Decision-first dashboard: what is happening, what changed, the biggest problem, the next action, then the trend and the timeline. */
export function DashboardView({ store: seeded, data }: { store: Store; data: DashboardData }) {
  const id = seeded.id;
  const base = `/stores/${id}`;
  const baseRows = useMemo(() => [seeded], [seeded]);
  const { rows: websites } = useDemoCollection<Store>("websites", baseRows);
  const store = websites.find((w) => w.id === id) ?? seeded;
  const summary = store.summary;

  const { rows: findingRows } = useDemoCollection<DashboardFinding>("findings", data.findings);
  const { rows: taskRows } = useDemoCollection<DashboardTask>("tasks", data.tasks);
  const { unreadCount } = useDemoAlerts(data.alerts, id);
  const { prompts } = usePrompts(id, data.prompts);
  const events = useDemoEvents();
  const savedCompetitors = useDemoSettings<{ list?: Competitor[] }>(settingKey(id, "competitors"), NO_SAVED);

  const lookup = useMemo(() => buildWebsiteLookup(events), [events]);
  const findings = useMemo(() => findingRows.filter((f) => rowWebsite(f, lookup) === id), [findingRows, lookup, id]);
  const tasks = useMemo(() => taskRows.filter((t) => rowWebsite(t, lookup) === id), [taskRows, lookup, id]);

  const [range, setRange] = useState<DateRangeValue>(() => makeRange("30d", ANCHOR));
  const [view, setView] = useState<"trend" | "competitors">("trend");

  const inWindow = useMemo(() => runsInWindow(data.trend, range.from, range.to), [data.trend, range]);
  const change = useMemo(() => changeInWindow(data.trend, range.from, range.to), [data.trend, range]);
  const problem = useMemo(() => biggestProblem(findings), [findings]);
  const next = useMemo(() => nextAction({ base, findings, tasks, auditInProgress: data.inProgressAudit }), [base, findings, tasks, data.inProgressAudit]);
  const feed = useMemo(() => mergeActivity(data.activity, events, { websiteId: id, limit: 6 }), [data.activity, events, id]);
  const activePrompts = prompts.filter((p) => p.status === "active").length;

  const competitors = useMemo(() => {
    const saved = savedCompetitors.value.list;
    if (!saved) return data.competitors.map((c) => ({ id: c.id, name: c.name, suggested: c.status === "suggested", n: c.n as number | null, d: c.d }));
    return saved
      .filter((c) => c.status !== "archived")
      .map((c) => {
        const seen = data.competitors.find((x) => x.name === c.name);
        return { id: c.id, name: c.name, suggested: c.status === "suggested", n: seen ? seen.n : null, d: seen ? seen.d : 0 };
      });
  }, [savedCompetitors.value.list, data.competitors]);

  const latest = data.trend[data.trend.length - 1];
  const previous = data.trend[data.trend.length - 2] ?? latest;
  const mention = summary?.mention ?? latest.mention;
  const mentionPrev = summary?.mentionPrevious ?? previous.mention;
  const failed = data.lastRun.plannedJobs - data.lastRun.succeededJobs;

  const metricIds = (metricId: string, sourceId: string) => ({ storeId: id, metricId, sourceId });
  const changeRows = change
    ? [
        { key: "mention-rate", label: "Mention rate", a: change.baseline.mention, b: change.current.mention },
        { key: "recommendation-rate", label: "Recommendation rate", a: change.baseline.recommendation, b: change.current.recommendation },
      ]
    : [];

  const chartPoints = (pick: (r: (typeof inWindow)[number]) => { n: number; d: number }) =>
    inWindow.map((r) => ({ x: formatShortDate(r.date), y: ratePercent(pick(r).n, pick(r).d), n: pick(r).d, numerator: pick(r).n, denominator: pick(r).d }));
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <HeaderAction>
        <ButtonLink href={`${base}/audits/new`} variant="primary" size="sm" icon="plus">Start audit</ButtonLink>
      </HeaderAction>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-body-sm text-fg-muted">
          {store.domain} · {store.marketName} · {store.language.toUpperCase()}
          <DemoBadge />
        </p>
        <DateRange value={range} onChange={setRange} anchorDate={ANCHOR} presets={["7d", "30d", "90d"]} min="2026-08-01" max={ANCHOR} align="end" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Tile title="What is happening">
          <Metric label="Brand mention rate" numerator={mention.n} denominator={mention.d} delta={{ points: pointChange(mentionPrev, mention), versus: "vs previous run" }} />
          <TrustLabel samples={mention.d} extra={`${data.channelCount} channels · ${activePrompts} active prompts`} />
          <p className="text-helper text-fg-muted">
            Run {formatShortDate(data.lastRun.scheduledFor)} · {data.lastRun.succeededJobs} of {data.lastRun.plannedJobs} requests succeeded{failed > 0 ? `, ${failed} failed (not counted as absent)` : ""}
          </p>
          <Link href={`${base}/monitoring/alerts`} className="tnum self-start rounded text-body-sm font-medium text-accent-text hover:underline">
            {unreadCount} unread {unreadCount === 1 ? "alert" : "alerts"}
          </Link>
        </Tile>

        <Tile title="What changed">
          {change ? (
            <>
              <p className="text-helper text-fg-muted">
                {change.basis === "before" ? "Since" : "From"} {formatShortDate(change.baseline.date)} ({change.baseline.runId})
              </p>
              <ul className="flex flex-col gap-3">
                {changeRows.map((row) => (
                  <li key={row.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-body-sm font-medium text-fg">{row.label}</span>
                      <span className="tnum text-body-sm font-semibold text-fg">{formatPoints(pointChange(row.a, row.b))}</span>
                    </div>
                    <p className="tnum text-helper text-fg-muted">{pctText(row.a.n, row.a.d)} ({row.a.n} / {row.a.d}) to {pctText(row.b.n, row.b.d)} ({row.b.n} / {row.b.d})</p>
                    <EvidenceTrace ids={metricIds(row.key, change.current.runId)} variant="compact" live={false} label={`${row.label} evidence`} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-body-sm text-fg-muted">Not enough runs in this range to show a change. Choose a longer range.</p>
          )}
        </Tile>

        <Tile title="Biggest problem">
          {problem ? (
            <>
              <Link href={`${base}/fixes/findings/${problem.id}`} className="rounded text-body font-medium text-fg hover:underline">{problem.title}</Link>
              <p className="flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{problem.priority}</Badge>
                <Status kind="severity" value={problem.severity} />
                <Status kind="finding" value={problem.status as FindingStatus} compact />
              </p>
              <EvidenceTrace ids={{ storeId: id, findingId: problem.id, promptId: problem.promptId, taskId: problem.taskId }} variant="compact" label="Finding evidence" />
              <Link href={`${base}/fixes`} className="tnum self-start rounded text-helper font-medium text-accent-text hover:underline">
                {findings.filter((f) => !["verified_resolved", "accepted_risk", "false_positive"].includes(f.status)).length} open findings
              </Link>
            </>
          ) : (
            <p className="text-body-sm text-fg-muted">No open findings.</p>
          )}
        </Tile>

        <Tile title="Next action">
          <p className="text-body font-medium text-fg">{next.label}</p>
          <p className="text-body-sm text-fg-muted">{next.detail}</p>
          {data.inProgressAudit && next.kind !== "audit" ? (
            <Link href={`${base}/audits/${data.inProgressAudit.id}`} className="flex flex-col gap-1.5 rounded-control border border-line p-2.5 hover:bg-surface-2">
              <span className="flex items-center justify-between text-helper font-medium text-fg">
                <span className="flex items-center gap-1.5"><Spinner className="size-3 text-accent" /> Audit in progress</span>
                <span className="tnum text-fg-muted">{data.inProgressAudit.done} / {data.inProgressAudit.planned} jobs</span>
              </span>
              <Progress value={data.inProgressAudit.done} max={data.inProgressAudit.planned} label="Audit progress" />
            </Link>
          ) : null}
          {next.kind !== "none" ? <ButtonLink href={next.href} variant="secondary" size="sm" trailingIcon="arrow-right" className="self-start">Open</ButtonLink> : null}
        </Tile>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ChartCard
          title={view === "trend" ? "Visibility trend" : "Competitor visibility"}
          subtitle={view === "trend" ? `${inWindow.length} weekly ${inWindow.length === 1 ? "run" : "runs"} in range` : `Responses naming each brand · latest run`}
          actions={
            <Segmented
              label="Chart view"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: "trend", label: "Trend" },
                { value: "competitors", label: "Competitors" },
              ]}
            />
          }
          footnote={view === "trend" && inWindow.length > 0 ? `API answer samples · ${inWindow.reduce((n, r) => n + r.mention.d, 0)} responses in range` : undefined}
        >
          {view === "trend" ? (
            inWindow.length < 2 ? (
              <ChartEmpty title="Only one run in this range" detail="Choose a longer range to see a trend." height={240} />
            ) : (
              <LineChart
                height={240}
                percent
                yMax={100}
                summary={`Brand mention rate went from ${formatRate(first.mention.n, first.mention.d)} to ${formatRate(last.mention.n, last.mention.d)} across ${inWindow.length} runs.`}
                series={[
                  { id: "mention", label: "Mention rate", tone: 1, dash: "solid", points: chartPoints((r) => r.mention) },
                  { id: "recommendation", label: "Recommendation rate", tone: 2, dash: "dashed", points: chartPoints((r) => r.recommendation) },
                ]}
              />
            )
          ) : competitors.length === 0 ? (
            <ChartEmpty title="No competitors yet" detail="Add competitors in Website settings." height={240} />
          ) : (
            <ul className="flex flex-col gap-3.5">
              {competitors.map((c) => (
                <li key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-body-sm text-fg">{c.name}{c.suggested ? <Badge tone="neutral" icon="sparkles">Demo suggestion</Badge> : null}</span>
                    <span className="tnum text-helper text-fg-muted">{c.n === null ? "N/A · not in the latest run" : `${c.n} / ${c.d}`}</span>
                  </div>
                  {c.n === null ? null : <Progress value={c.n} max={c.d} label={`${c.name} mentions`} tone="warning" />}
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <Card>
          <CardHeader title="Recent activity" />
          <CardBody>
            {feed.length === 0 ? (
              <p className="text-body-sm text-fg-muted">No activity yet.</p>
            ) : (
              <Timeline items={feed.map((a) => ({ id: a.id, title: a.title, meta: a.detail, time: formatRelative(a.at), icon: a.icon, tone: a.tone }))} />
            )}
          </CardBody>
        </Card>
      </div>

      <p className="tnum text-helper text-fg-muted">
        Next run {data.schedule.nextRunAt ? `${formatDate(data.schedule.nextRunAt, store.timezone)} ${formatTime(data.schedule.nextRunAt, store.timezone)}` : "not scheduled"} ·{" "}
        <Link href={`${base}/monitoring`} className="rounded font-medium text-accent-text hover:underline">{data.schedule.name}</Link>
        {data.comparison ? (
          <>
            {" "}· <Link href={`${base}/comparisons/${data.comparison.id}`} className="rounded font-medium text-accent-text hover:underline">Latest comparison</Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
