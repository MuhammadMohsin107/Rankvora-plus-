import { SimulatedBadge } from "@/components/ui/demo";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { Timeline } from "@/components/ui/misc";
import type { ReportRow } from "@/types/shared-records";

export type GeneratingProgress = {
  jobs: { done: number; total: number };
  pages: { done: number; total: number } | null;
};

const STAGES = ["Collecting results", "Analysing responses and pages", "Findings and recommendations", "Assembling the report"];

/** Which stage is running for a progress fraction 0-1. */
export function stageIndex(fraction: number): number {
  return Math.min(STAGES.length - 1, Math.floor(fraction * STAGES.length));
}

/**
 * A report that is still being assembled. Reports generated in this browser show simulated progress (`fraction`);
 * a seeded report that waits on its source shows the source's job and page progress.
 */
export function GeneratingState({ report, progress, fraction }: { report: ReportRow; progress?: GeneratingProgress | null; fraction?: number | null }) {
  const simulated = fraction !== null && fraction !== undefined;
  const active = simulated ? stageIndex(fraction) : 0;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <Card as="section">
        <CardHeader title="Generating report" actions={simulated ? <SimulatedBadge /> : undefined} />
        <CardBody className="flex flex-col gap-3 pt-0">
          {simulated ? (
            <div className="flex flex-col gap-1.5">
              <Progress value={Math.round(fraction * 100)} max={100} label="Report generation progress" />
              <p className="tnum text-helper text-fg-muted" aria-live="polite">{Math.round(fraction * 100)}% · {STAGES[active]}</p>
            </div>
          ) : progress ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-helper text-fg-muted">
                  <span>AI visibility requests</span>
                  <span className="tnum">{progress.jobs.done} / {progress.jobs.total} jobs</span>
                </div>
                <Progress value={progress.jobs.done} max={progress.jobs.total} label="AI visibility requests completed" />
              </div>
              {progress.pages ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between text-helper text-fg-muted">
                    <span>Website pages assessed</span>
                    <span className="tnum">{progress.pages.done} / {progress.pages.total} pages</span>
                  </div>
                  <Progress value={progress.pages.done} max={progress.pages.total} label="Website pages assessed" />
                </div>
              ) : null}
            </div>
          ) : null}
          <Timeline
            items={STAGES.map((title, index) => ({
              id: title,
              title,
              meta: index < active ? "Done" : index === active ? "In progress" : "Waiting",
              icon: index < active ? ("check-circle" as const) : index === active ? ("loader" as const) : ("clock" as const),
              tone: index === active ? ("accent" as const) : undefined,
            }))}
          />
          <div>
            <ButtonLink href={report.sourceHref} variant="secondary" trailingIcon="arrow-right">View source</ButtonLink>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
