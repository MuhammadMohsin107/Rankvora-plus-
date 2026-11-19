import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BarCompare, type BarCompareRow } from "@/components/charts/bars";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { NotComputed } from "@/features/comparison/compatibility";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";
import type { ChannelSegment, MetricResult } from "@/types/comparison";

export const metadata: Metadata = { title: "Comparison platforms" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

/** `sub` states the cohort once, on the first chart. The other charts share the same matched slots. */
function rowsFor(channels: ChannelSegment[], pick: (c: ChannelSegment) => MetricResult, sub?: (c: ChannelSegment, metric: MetricResult) => string | undefined): BarCompareRow[] {
  return channels.map((c) => {
    const metric = pick(c);
    return {
      id: c.channelId,
      label: c.label,
      sub: sub?.(c, metric),
      baseline: metric.baseline,
      current: metric.current,
      baselineCi: metric.baselineCi,
      currentCi: metric.currentCi,
      naReason: metric.na,
    };
  });
}

async function ComparisonPlatformsPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/platforms">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  if (detail.result.verdict === "not_comparable") return <NotComputed checks={detail.result.checks} what="Platform segments" />;
  const { channels } = detail.result;
  const changed = channels.filter((c) => c.modelChanged);

  if (channels.length === 0) {
    return <EmptyState icon="plug" title="No platform segments" description="No slot matched on both sides." />;
  }

  return (
    <div className="flex flex-col gap-5">
      {changed.length > 0 ? (
        <Callout tone="warning" title="Model changed">
          {changed.map((c) => c.label).join(", ")}: slots with a different model are excluded and never merged into the headline.
        </Callout>
      ) : null}

      <Card>
        <CardHeader
          title="Mention rate by platform"
          info="Each provider API, model and search mode is its own segment and is never merged. Segments below 20 matched slots are directional."
        />
        <CardBody>
          <BarCompare
            rows={rowsFor(channels, (c) => c.mention, (_, m) => `${m.cohort} matched slots${m.sample !== "ok" && !m.na ? " · directional" : ""}`)}
            baselineLabel="Base"
            currentLabel="Current"
          />
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
            <BarCompare rows={rowsFor(channels, (c) => c.citation, (_, m) => (m.na ? undefined : `${m.cohort} slots with citation data`))} baselineLabel="Base" currentLabel="Current" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function ComparisonPlatformsPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/platforms">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonPlatformsPageContent {...props} />
    </Suspense>
  );
}
