import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StackedBar } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { Callout, Card, CardBody, CardHeader, Metric, MetricCell, MetricGrid, Section } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { AiResponsesTable } from "@/features/audit/ai-responses-table";
import { BreakdownCards } from "@/features/audit/ai-breakdown";
import { CompetitorTable } from "@/features/audit/competitor-table";
import { CITATION_SOURCE_LABEL } from "@/lib/labels";
import { sampleStatus, pointChange } from "@/lib/stats";
import { auditParams, getAiLane, getAudit } from "@/services/audit";

export const metadata: Metadata = { title: "AI visibility" };

export async function generateStaticParams() {
  return auditParams();
}

const sourceTone = { owned: "success", competitor: "warning", third_party: "neutral" } as const;

async function AiVisibilityPageContent(props: PageProps<"/stores/[storeId]/audits/[auditId]/ai-visibility">) {
  const { storeId, auditId } = await props.params;
  const [audit, lane] = await Promise.all([getAudit(storeId, auditId), getAiLane(storeId, auditId)]);
  if (!audit || !lane) notFound();

  if (!audit.lanes.includes("ai_visibility") || lane.responses.length === 0) {
    return <EmptyState icon="prompts" title="No AI responses in this audit" />;
  }

  const delta = (key: "mention" | "recommendation" | "ownedCitation", now: { n: number; d: number }) =>
    lane.baselinePrevious && !audit.provisional && audit.baseline
      ? { points: pointChange(lane.baselinePrevious[key], now), versus: `vs ${audit.baseline.title}` }
      : undefined;

  const totalCitations = lane.citationsBySource.owned + lane.citationsBySource.competitor + lane.citationsBySource.third_party;

  return (
    <div className="flex flex-col gap-6">
      {audit.provisional ? (
        <Callout tone="warning" title="Provisional">Rates change as more responses arrive.</Callout>
      ) : null}

      <MetricGrid>
        <MetricCell>
          <Metric label="Brand mention rate" numerator={lane.mention.n} denominator={lane.mention.d} sampleStatus={sampleStatus(lane.mention.d)} delta={delta("mention", lane.mention)} info="Successful responses that mention the brand ÷ successful responses." />
        </MetricCell>
        <MetricCell>
          <Metric label="Recommendation rate" numerator={lane.recommendation.n} denominator={lane.recommendation.d} sampleStatus={sampleStatus(lane.recommendation.d)} delta={delta("recommendation", lane.recommendation)} />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Owned citation rate"
            numerator={lane.ownedCitation.n}
            denominator={lane.ownedCitation.d}
            unit="citation-capable responses"
            delta={delta("ownedCitation", lane.ownedCitation)}
            info="Denominator counts only successful responses from providers that return citations."
          />
        </MetricCell>
        <MetricCell>
          <Metric label="Response success" numerator={lane.succeeded} denominator={audit.plannedJobs} unit="planned requests" basis={lane.failed > 0 ? `${lane.failed} failed, excluded from rates` : undefined} info="Failures are shown here and never counted as the brand being absent." />
        </MetricCell>
      </MetricGrid>

      <BreakdownCards providers={lane.byProvider} groups={lane.byGroup} compareTitle={audit.provisional ? null : (audit.baseline?.title ?? null)} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <Card as="section">
          <CardHeader title="Competitors" info="Competitors confirmed for this store. Each rate is responses that name the competitor ÷ successful responses." />
          <CardBody>
            <CompetitorTable rows={lane.competitors} />
          </CardBody>
        </Card>

        <Card as="section">
          <CardHeader title="Citations by source type" />
          <CardBody className="flex flex-col gap-4">
            {totalCitations > 0 ? (
              <StackedBar
                unit="citations"
                segments={[
                  { id: "owned", label: CITATION_SOURCE_LABEL.owned, value: lane.citationsBySource.owned, tone: "success" },
                  { id: "competitor", label: CITATION_SOURCE_LABEL.competitor, value: lane.citationsBySource.competitor, tone: "warning" },
                  { id: "third", label: CITATION_SOURCE_LABEL.third_party, value: lane.citationsBySource.third_party, tone: "neutral" },
                ]}
              />
            ) : (
              <p className="text-[13px] text-fg-muted">No citations returned yet.</p>
            )}
            <p className="tnum text-xs text-fg-subtle">
              No citation returned in {lane.noCitationReturned} of {lane.succeeded} responses · Not supported: {lane.citationNotSupported}
            </p>
            {lane.topDomains.length > 0 ? (
              <ul className="divide-y divide-line border-t border-line">
                {lane.topDomains.map((d) => (
                  <li key={`${d.domain}-${d.source}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-[13px] text-fg">{d.domain}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={sourceTone[d.source]}>{CITATION_SOURCE_LABEL[d.source]}</Badge>
                      <span className="tnum w-6 text-right text-xs text-fg-muted">{d.count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Section title="Responses" actions={<Badge tone="neutral" icon="info" title="API answer samples. They may differ from the consumer app.">API answer samples</Badge>}>
        <AiResponsesTable responses={lane.responses} providers={lane.providers} prompts={lane.prompts} />
      </Section>
    </div>
  );
}

export default function AiVisibilityPage(props: PageProps<"/stores/[storeId]/audits/[auditId]/ai-visibility">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AiVisibilityPageContent {...props} />
    </Suspense>
  );
}
