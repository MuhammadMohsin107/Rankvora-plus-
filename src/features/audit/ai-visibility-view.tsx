import { StackedBar } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { Callout, Card, CardBody, Metric, MetricCell, MetricGrid, Section } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Tabs } from "@/components/ui/tabs";
import { CITATION_SOURCE_LABEL } from "@/lib/labels";
import { pointChange, sampleStatus } from "@/lib/stats";
import type { AiLane, AuditDetail, AuditFinding } from "@/types/audit";

import { BreakdownCards } from "./ai-breakdown";
import { AiResponsesTable } from "./ai-responses-table";
import { CompetitorTable } from "./competitor-table";

const sourceTone = { owned: "success", competitor: "warning", third_party: "neutral" } as const;

/** AI visibility lane of one audit: rates, breakdown, competitors and citations in tabs, then every response. */
export function AiVisibilityView({ audit, lane, findings = [] }: { audit: AuditDetail; lane: AiLane | null; findings?: AuditFinding[] }) {
  if (!audit.lanes.includes("ai_visibility")) return <EmptyState icon="prompts" title="AI visibility was not part of this audit" />;
  if (!lane || lane.responses.length === 0) {
    return <EmptyState icon="prompts" title="No AI responses yet" description={audit.provisional ? "Responses appear here as requests return." : "No request returned for this audit."} />;
  }
  const delta = (key: "mention" | "recommendation" | "ownedCitation", now: { n: number; d: number }) =>
    lane.baselinePrevious && !audit.provisional && audit.baseline ? { points: pointChange(lane.baselinePrevious[key], now), versus: `vs ${audit.baseline.title}` } : undefined;
  const totalCitations = lane.citationsBySource.owned + lane.citationsBySource.competitor + lane.citationsBySource.third_party;
  const findingByPrompt: Record<string, string> = {};
  for (const f of findings) for (const id of f.affectedPromptIds) findingByPrompt[id] ??= f.id;

  return (
    <div className="flex flex-col gap-4">
      {audit.provisional ? <Callout tone="warning" title="Provisional">Rates change as more responses arrive.</Callout> : null}

      <MetricGrid>
        <MetricCell>
          <Metric label="Brand mention rate" numerator={lane.mention.n} denominator={lane.mention.d} sampleStatus={sampleStatus(lane.mention.d)} delta={delta("mention", lane.mention)} info="Successful responses that mention the brand ÷ successful responses." />
        </MetricCell>
        <MetricCell>
          <Metric label="Recommendation rate" numerator={lane.recommendation.n} denominator={lane.recommendation.d} sampleStatus={sampleStatus(lane.recommendation.d)} delta={delta("recommendation", lane.recommendation)} />
        </MetricCell>
        <MetricCell>
          <Metric label="Owned citation rate" numerator={lane.ownedCitation.n} denominator={lane.ownedCitation.d} unit="citation-capable responses" delta={delta("ownedCitation", lane.ownedCitation)} info="Only successful responses from providers that return citations." />
        </MetricCell>
        <MetricCell>
          <Metric label="Response success" numerator={lane.succeeded} denominator={audit.plannedJobs} unit="planned requests" basis={lane.failed > 0 ? `${lane.failed} failed, excluded from rates` : undefined} info="Failures are shown here and never counted as the brand being absent." />
        </MetricCell>
      </MetricGrid>

      <BreakdownCards providers={lane.byProvider} groups={lane.byGroup} compareTitle={audit.provisional ? null : (audit.baseline?.title ?? null)} />

      <Card as="section">
        <CardBody>
          <Tabs
            label="Competitors and citations"
            tabs={[
              { id: "competitors", label: "Competitors", content: <div className="pt-4"><CompetitorTable rows={lane.competitors} /></div> },
              {
                id: "citations",
                label: `Citations (${totalCitations})`,
                content: (
                  <div className="flex flex-col gap-4 pt-4">
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
                      <p className="text-body-sm text-fg-muted">No citations returned.</p>
                    )}
                    <p className="tnum text-helper text-fg-muted">No citation in {lane.noCitationReturned} of {lane.succeeded} responses · Not supported: {lane.citationNotSupported}</p>
                    {lane.topDomains.length > 0 ? (
                      <ul className="divide-y divide-line border-t border-line">
                        {lane.topDomains.map((d) => (
                          <li key={`${d.domain}-${d.source}`} className="flex items-center justify-between gap-3 py-2">
                            <span className="min-w-0 truncate text-body-sm text-fg">{d.domain}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <Badge tone={sourceTone[d.source]}>{CITATION_SOURCE_LABEL[d.source]}</Badge>
                              <span className="tnum w-6 text-right text-helper text-fg-muted">{d.count}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        </CardBody>
      </Card>

      <Section title="Responses" actions={<Badge tone="neutral" icon="info" title="API answer samples. They may differ from the consumer app.">API answer samples</Badge>}>
        <AiResponsesTable responses={lane.responses} providers={lane.providers} prompts={lane.prompts} findingByPrompt={findingByPrompt} />
      </Section>
    </div>
  );
}
