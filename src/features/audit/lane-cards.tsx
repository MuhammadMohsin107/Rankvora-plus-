import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Metric } from "@/components/ui/card";
import { sampleStatus } from "@/lib/stats";
import type { LaneSummary } from "@/types/audit";

type Props = {
  summary: LaneSummary;
  /** Base path of the audit, e.g. /stores/runpro-pk/audits/aud-002 */
  base: string;
  /** Basis stated once for the AI rates (e.g. "Verification scope"). */
  basis?: string;
  /** Links to the lane tabs. Turn off where the page already has those tabs. */
  showLinks?: boolean;
  /** "headline" leaves out coverage metrics (shown separately on the overview). */
  variant?: "full" | "headline";
};

/**
 * The two assessment lanes side by side. They are never combined into one score.
 */
export function LaneCards({ summary, base, basis, showLinks = true, variant = "full" }: Props) {
  const { ai, website } = summary;
  const full = variant === "full";
  const aiGrid = full ? "sm:grid-cols-2" : "sm:grid-cols-3";
  const webGrid = "sm:grid-cols-2";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
      <Card as="section" className="flex flex-col">
        <CardHeader
          title="AI visibility"
          subtitle={basis}
          info="Computed from successful API answer samples. Failed requests are excluded from rates and counted in coverage."
          actions={summary.provisional ? <Badge tone="warning" icon="alert-triangle">Provisional</Badge> : undefined}
        />
        {ai ? (
          <>
            <CardBody className={`grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-5 ${aiGrid}`}>
              <Metric label="Mention rate" numerator={ai.mention.n} denominator={ai.mention.d} sampleStatus={sampleStatus(ai.mention.d)} info="Successful responses that mention the brand ÷ successful responses." />
              <Metric label="Recommendation rate" numerator={ai.recommendation.n} denominator={ai.recommendation.d} sampleStatus={sampleStatus(ai.recommendation.d)} />
              <Metric label="Owned citation rate" numerator={ai.ownedCitation.n} denominator={ai.ownedCitation.d} unit="citation-capable responses" info="Denominator counts only successful responses from providers that return citations." />
              {full ? <Metric label="Response success" numerator={ai.responses.n} denominator={ai.responses.d} unit="requests" info="Successful ÷ planned requests. The remainder failed and are not read as brand absence." /> : null}
            </CardBody>
            {showLinks ? (
              <div className="mt-auto flex justify-end border-t border-line px-4 py-2">
                <ButtonLink href={`${base}/ai-visibility`} variant="ghost" size="sm" trailingIcon="arrow-right">Details</ButtonLink>
              </div>
            ) : null}
          </>
        ) : (
          <CardBody>
            <p className="text-[13px] font-medium text-fg">Not part of this audit</p>
            <p className="mt-0.5 text-xs text-fg-subtle">This lane was not assessed, so there are no rates to show. It is not a score of zero.</p>
          </CardBody>
        )}
      </Card>

      <Card as="section" className="flex flex-col">
        <CardHeader
          title="Website readiness"
          info="Technical and content-quality pass rates are separate. Pass rate = passing ÷ determinate checks. Coverage = determinate ÷ applicable checks."
          actions={summary.provisional ? <Badge tone="warning" icon="alert-triangle">Provisional</Badge> : undefined}
        />
        {website ? (
          <>
            <CardBody className={`grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-5 ${webGrid}`}>
              <Metric label="Technical pass rate" numerator={website.technical.n} denominator={website.technical.d} unit="checks" naReason={website.technical.d === 0 ? "No determinate checks" : undefined} />
              <Metric label="Content-quality pass rate" numerator={website.content.n} denominator={website.content.d} unit="checks" naReason={website.content.d === 0 ? "No determinate checks" : undefined} />
              {full ? <Metric label="Check coverage" numerator={website.checks.n} denominator={website.checks.d} unit="applicable checks" info="Checks with a determinate result ÷ applicable checks." /> : null}
              {full ? (
                <Metric
                  label="Page coverage"
                  numerator={website.pages.n}
                  denominator={website.pages.d}
                  unit="in-scope pages"
                  basis={`${website.pagesDetail.excluded} excluded · ${website.pagesDetail.blocked} blocked · ${website.pagesDetail.unvisited} unvisited`}
                />
              ) : null}
            </CardBody>
            {showLinks ? (
              <div className="mt-auto flex justify-end border-t border-line px-4 py-2">
                <ButtonLink href={`${base}/website`} variant="ghost" size="sm" trailingIcon="arrow-right">Details</ButtonLink>
              </div>
            ) : null}
          </>
        ) : (
          <CardBody>
            <p className="text-[13px] font-medium text-fg">Not part of this audit</p>
            <p className="mt-0.5 text-xs text-fg-subtle">This lane was not assessed, so there are no rates to show. It is not a score of zero.</p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
