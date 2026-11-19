import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BarCompare, type BarCompareRow } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";
import type { ChannelSegment, MetricResult } from "@/types/comparison";

export const metadata: Metadata = { title: "Comparison platforms" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

function rowsFor(channels: ChannelSegment[], pick: (c: ChannelSegment) => MetricResult): BarCompareRow[] {
  return channels.map((c) => {
    const metric = pick(c);
    return {
      id: c.channelId,
      label: c.label,
      sub: `${metric.cohort} matched slots${metric.sample !== "ok" && !metric.na ? " · directional" : ""}`,
      baseline: metric.baseline,
      current: metric.current,
      baselineCi: metric.baselineCi,
      currentCi: metric.currentCi,
      naReason: metric.na,
    };
  });
}

export default async function ComparisonPlatformsPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/platforms">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { channels } = detail.result;
  const changed = channels.filter((c) => c.modelChanged);

  if (channels.length === 0) {
    return <EmptyState icon="plug" title="No platform segments" description="No slot matched on both sides, so there is nothing to segment." />;
  }

  return (
    <div className="flex flex-col gap-5">
      {changed.length > 0 ? (
        <Callout tone="warning" title="Model changed">
          {changed.map((c) => c.label).join(", ")}: slots with a different model are excluded and never merged into the headline.
        </Callout>
      ) : null}

      <Card>
        <CardHeader title="Mention rate by platform" subtitle="Segments are never merged" info="Each provider API, model and search mode is its own segment. Segments below 20 matched slots are directional." />
        <CardBody>
          <BarCompare rows={rowsFor(channels, (c) => c.mention)} baselineLabel="Base" currentLabel="Current" />
        </CardBody>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Recommendation rate" />
          <CardBody>
            <BarCompare rows={rowsFor(channels, (c) => c.recommendation)} baselineLabel="Base" currentLabel="Current" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Owned citation rate" info="Responses with citation data only. Providers without citation support show N/A." />
          <CardBody>
            <BarCompare rows={rowsFor(channels, (c) => c.citation)} baselineLabel="Base" currentLabel="Current" />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Models in the matched cohort" />
        <CardBody>
          <ul className="divide-y divide-line">
            {channels.map((c) => (
              <li key={c.channelId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0 text-[13px] text-fg">{c.label}</span>
                <span className="flex items-center gap-2 text-xs text-fg-muted">
                  <span className="tnum">{c.baselineModels.join(", ") || "—"} → {c.currentModels.join(", ") || "—"}</span>
                  {c.modelChanged ? <Badge tone="warning" icon="alert-triangle">Changed</Badge> : <Badge tone="success" icon="check-circle">Unchanged</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
