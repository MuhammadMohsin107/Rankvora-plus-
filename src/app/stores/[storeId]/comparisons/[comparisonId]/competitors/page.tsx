import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BarCompare, type BarCompareRow } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { HeadlineCard } from "@/features/comparison/headline";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";
import type { MetricResult } from "@/types/comparison";

export const metadata: Metadata = { title: "Comparison competitors" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

const toRow = (m: MetricResult): BarCompareRow => ({
  id: m.id,
  label: m.label,
  baseline: m.baseline,
  current: m.current,
  baselineCi: m.baselineCi,
  currentCi: m.currentCi,
  naReason: m.na,
});

function NameList({ names, empty }: { names: string[]; empty: string }) {
  return names.length > 0 ? (
    <ul className="flex flex-wrap gap-1.5">
      {names.map((n) => (
        <li key={n}><Badge tone="warning">{n}</Badge></li>
      ))}
    </ul>
  ) : (
    <p className="text-[13px] text-fg-muted">{empty}</p>
  );
}

async function ComparisonCompetitorsPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/competitors">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { result } = detail;
  const brand = result.headline.find((m) => m.id === "mention")!;
  const sov = result.headline.find((m) => m.id === "share-of-voice")!;

  if (result.competitors.length === 0) {
    return <EmptyState icon="users" title="No tracked competitors" description="Confirm competitors in store settings to compare them on the same cohort." />;
  }

  const rows = [
    toRow({ ...brand, label: "Your brand" }),
    ...result.competitors.map((m) => toRow(m)),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Mention rate" subtitle={`Brand and tracked competitors · same ${brand.cohort} matched slots in every row`} />
        <CardBody>
          <BarCompare rows={rows} baselineLabel="Base" currentLabel="Current" />
        </CardBody>
      </Card>

      <HeadlineCard metric={sov} aggregation={result.aggregation} countsOnly={result.verdict === "insufficient_data"} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
        <Card>
          <CardHeader title="Newly appearing" info="Not named on the baseline, named on the current side. The tracked set is not versioned yet, so this reflects answers, not changes to the set." />
          <CardBody>
            <NameList names={result.competitorAppeared} empty="None" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="No longer appearing" info="Named on the baseline, not named on the current side." />
          <CardBody>
            <NameList names={result.competitorGone} empty="None" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function ComparisonCompetitorsPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/competitors">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonCompetitorsPageContent {...props} />
    </Suspense>
  );
}
