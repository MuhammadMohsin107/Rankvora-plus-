import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { CITATION_SOURCE_LABEL } from "@/lib/labels";
import { formatRate, ratePercent } from "@/lib/format";
import type { Rate } from "@/types/core";
import type { PromptEvidence } from "@/types/prompts";

function RateRow({ name, tag, rate, unit }: { name: string; tag?: string; rate: Rate; unit: string }) {
  const pct = ratePercent(rate.n, rate.d);
  return (
    <li className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-body-sm font-medium text-fg">
          <span className="truncate">{name}</span>
          {tag ? <Badge tone="neutral">{tag}</Badge> : null}
        </span>
        <span className="tnum shrink-0 text-body-sm text-fg">
          {formatRate(rate.n, rate.d, 0)} <span className="text-helper text-fg-muted">{rate.n} / {rate.d} {unit}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${name}: ${rate.n} of ${rate.d} ${unit}`}>
        <div className="h-full rounded-full bg-series-1" style={{ width: `${pct ?? 0}%` }} />
      </div>
    </li>
  );
}

/** Competitor mentions and cited domains for one prompt. Every row shows numerator and denominator. */
export function EvidenceSection({ evidence }: { evidence: PromptEvidence }) {
  const { competitors, citations } = evidence;
  return (
    <div className="flex flex-col gap-3">
      <Card as="section">
        <CardHeader title="Competitor mentions" info="Share of successful responses that name each competitor." />
        <CardBody>
          {competitors.length === 0 ? (
            <EmptyState icon="users" title="No competitor data yet" description="Competitors appear after the first run." />
          ) : (
            <ul className="divide-y divide-line">
              {competitors.map((c) => (
                <RateRow key={c.id} name={c.name} rate={c.mentioned} unit="responses" />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card as="section">
        <CardHeader title="Citations" info="Share of citation-returning responses that cite each domain. Top domains only." />
        <CardBody>
          {citations.length === 0 ? (
            <EmptyState icon="link" title="No citations yet" />
          ) : (
            <ul className="divide-y divide-line">
              {citations.map((c) => (
                <RateRow key={c.domain} name={c.domain} tag={CITATION_SOURCE_LABEL[c.source]} rate={c.cited} unit="responses" />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
