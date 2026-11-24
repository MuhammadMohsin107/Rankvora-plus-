"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { StackedBar, type Segment } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { NotComputed } from "@/features/comparison/compatibility";
import { metricBarRow, RateBars, type RateBarRow } from "@/features/comparison/rate-bars";
import { CITATION_SOURCE_LABEL } from "@/lib/labels";
import type { ChannelSegment, Check, Comparability, ComparisonResult, DomainRow, MetricResult, SentimentCounts, UrlRow } from "@/types/comparison";

export type BreakdownData = {
  verdict: Comparability;
  checks: Check[];
  channels: ChannelSegment[];
  brand: MetricResult | null;
  competitors: MetricResult[];
  appeared: string[];
  gone: string[];
  domains: DomainRow[];
  urls: UrlRow[];
  sentiment: ComparisonResult["sentiment"];
};

const VIEWS = ["platforms", "competitors", "citations", "sentiment"] as const;
type View = (typeof VIEWS)[number];

const rateRow = (id: string, label: string, b: { n: number; d: number }, c: { n: number; d: number }, sub?: string): RateBarRow => {
  const br = b.d > 0 ? b.n / b.d : null;
  const cr = c.d > 0 ? c.n / c.d : null;
  return {
    id,
    label,
    sub,
    baseline: { rate: br, counts: b.d > 0 ? `${b.n} of ${b.d}` : null },
    current: { rate: cr, counts: c.d > 0 ? `${c.n} of ${c.d}` : null },
    points: br !== null && cr !== null ? (cr - br) * 100 : null,
    zeroBaseline: b.d > 0 && b.n === 0 && c.n > 0,
  };
};

function Platforms({ channels }: { channels: ChannelSegment[] }) {
  const [metric, setMetric] = useState<"mention" | "recommendation" | "citation">("mention");
  if (channels.length === 0) return <EmptyState icon="plug" title="No platform segments" description="No slot matched on both sides." />;
  const rows = channels.map((c) => {
    const m = c[metric];
    const model = c.modelChanged ? `Model changed: ${c.baselineModels.join(", ")} → ${c.currentModels.join(", ")}. Changed slots are excluded.` : c.currentModels.join(", ");
    const sub = `${c.matchedPairs} matched slots${m.sample !== "ok" && !m.na ? " · directional" : ""} · ${model}`;
    return metricBarRow(m, { label: c.label, sub });
  });
  return (
    <Card>
      <CardHeader
        title="By platform"
        subtitle="Each provider, model and search mode is its own segment and is never merged."
        actions={
          <Segmented
            label="Metric"
            size="sm"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "mention", label: "Mention" },
              { value: "recommendation", label: "Recommend" },
              { value: "citation", label: "Citation" },
            ]}
          />
        }
      />
      <CardBody>
        <RateBars rows={rows} />
      </CardBody>
    </Card>
  );
}

function NameList({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-label font-medium text-fg-muted">{title}</h3>
      {names.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <li key={n}><Badge tone="warning">{n}</Badge></li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-fg-muted">None</p>
      )}
    </div>
  );
}

function Competitors({ data }: { data: BreakdownData }) {
  if (data.competitors.length === 0) return <EmptyState icon="users" title="No tracked competitors" description="Confirm competitors in website settings to compare them on the same slots." />;
  const rows = [...(data.brand ? [metricBarRow(data.brand, { label: "Your brand" })] : []), ...data.competitors.map((m) => metricBarRow(m))];
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader title="Mention rate" subtitle={`Brand and tracked competitors, same ${data.brand?.cohort ?? 0} matched slots in every row.`} />
        <CardBody><RateBars rows={rows} /></CardBody>
      </Card>
      <Card>
        <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          <NameList title="Newly named" names={data.appeared} />
          <NameList title="No longer named" names={data.gone} />
        </CardBody>
      </Card>
    </div>
  );
}

const sourceTone = { owned: "success", competitor: "warning", third_party: "neutral" } as const;

function Citations({ data }: { data: BreakdownData }) {
  const providers = data.channels.map((c) => metricBarRow(c.citation, { label: c.label }));
  const domains = data.domains.slice(0, 8).map((d) => rateRow(d.domain, d.domain, d.baseline, d.current, CITATION_SOURCE_LABEL[d.source]));
  const sourceOf = (domain: string) => data.domains.find((d) => d.domain === domain)?.source ?? "third_party";
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader title="Owned citation by platform" subtitle="Responses with citation data only. No citation support is N/A, never 0%." />
        <CardBody>{providers.length ? <RateBars rows={providers} /> : <p className="text-body-sm text-fg-muted">No matched slots.</p>}</CardBody>
      </Card>
      <Card>
        <CardHeader title="Cited domains" subtitle="Responses citing each domain out of responses with citation data." />
        <CardBody>{domains.length ? <RateBars rows={domains} /> : <p className="text-body-sm text-fg-muted">No citations returned in the matched slots.</p>}</CardBody>
      </Card>
      <Card>
        <CardHeader title="Cited URLs" subtitle="Responses citing each URL, baseline to current." />
        <CardBody className="pt-2">
          {data.urls.length === 0 ? (
            <p className="text-body-sm text-fg-muted">No URLs returned in the matched slots.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.urls.slice(0, 10).map((u) => (
                <li key={u.url} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <div className="min-w-0">
                    <a href={u.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-target max-w-full items-center gap-1 text-body-sm font-medium text-accent-text hover:underline">
                      <span className="truncate">{u.title}</span>
                      <Icon name="external" size={12} className="shrink-0" />
                    </a>
                    <p className="truncate text-helper text-fg-subtle">{u.url}</p>
                  </div>
                  <div className="tnum flex shrink-0 items-center gap-2 text-helper text-fg-muted">
                    <span>{u.baseline.n} of {u.baseline.d}</span>
                    <span aria-hidden="true">→</span>
                    <span className="sr-only">to</span>
                    <span>{u.current.n} of {u.current.d}</span>
                    <Badge tone={sourceTone[sourceOf(u.domain)]}>{CITATION_SOURCE_LABEL[sourceOf(u.domain)]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

const segments = (c: SentimentCounts): Segment[] => [
  { id: "positive", label: "Positive", value: c.positive, tone: "success" },
  { id: "neutral", label: "Neutral", value: c.neutral, tone: "neutral" },
  { id: "mixed", label: "Mixed", value: c.mixed, tone: "warning" },
  { id: "negative", label: "Negative", value: c.negative, tone: "danger" },
  { id: "unknown", label: "Unknown", value: c.unknown, tone: "info" },
];

function Distribution({ title, counts }: { title: string; counts: SentimentCounts }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <h3 className="text-label font-medium text-fg-muted">{title}</h3>
      {counts.total > 0 ? <StackedBar segments={segments(counts)} unit="mentions" /> : <p className="text-body-sm text-fg-muted">The brand is not mentioned, so sentiment is N/A.</p>}
    </div>
  );
}

function Sentiment({ data }: { data: BreakdownData }) {
  const { sentiment } = data;
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader title="Sentiment" subtitle="Responses that mention the brand." />
        <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          <Distribution title="Baseline" counts={sentiment.baseline} />
          <Distribution title="Current" counts={sentiment.current} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Where it changed" subtitle="Matched slots with a different sentiment label." />
        <CardBody className="pt-2">
          {sentiment.excerpts.length === 0 ? (
            <p className="text-body-sm text-fg-muted">No matched slot changed sentiment.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sentiment.excerpts.map((e) => (
                <li key={e.key} className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-fg" title={e.promptText}>{e.promptText}</p>
                    <p className="truncate text-helper text-fg-subtle">{e.channelLabel}</p>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                    {[
                      { label: "Baseline", sentiment: e.baselineSentiment, quote: e.baselineQuote },
                      { label: "Current", sentiment: e.currentSentiment, quote: e.currentQuote },
                    ].map((side) => (
                      <figure key={side.label} className="min-w-0 rounded-control border border-line bg-surface-2 p-2.5">
                        <figcaption className="mb-1 flex items-center justify-between text-helper">
                          <span className="font-medium text-fg-muted">{side.label}</span>
                          <span className="capitalize text-fg-subtle">{side.sentiment}</span>
                        </figcaption>
                        <blockquote className="text-body-sm text-fg-muted">{side.quote ? `“${side.quote}”` : "No quote"}</blockquote>
                      </figure>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** Platforms, competitors, citations and sentiment as one tab. Each metric is shown once, as a breakdown. */
export function BreakdownsView({ data }: { data: BreakdownData }) {
  const router = useRouter();
  const pathname = usePathname();
  const param = useSearchParams().get("view");
  const [view, setView] = useState<View>((VIEWS as readonly string[]).includes(param ?? "") ? (param as View) : "platforms");
  if (data.verdict === "not_comparable") return <NotComputed checks={data.checks} what="Breakdowns" />;

  const choose = (next: View) => {
    setView(next);
    router.replace(`${pathname}?view=${next}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="Breakdown"
        value={view}
        onChange={choose}
        options={[
          { value: "platforms", label: "Platforms" },
          { value: "competitors", label: "Competitors" },
          { value: "citations", label: "Citations" },
          { value: "sentiment", label: "Sentiment" },
        ]}
      />
      {view === "platforms" ? <Platforms channels={data.channels} /> : null}
      {view === "competitors" ? <Competitors data={data} /> : null}
      {view === "citations" ? <Citations data={data} /> : null}
      {view === "sentiment" ? <Sentiment data={data} /> : null}
    </div>
  );
}
