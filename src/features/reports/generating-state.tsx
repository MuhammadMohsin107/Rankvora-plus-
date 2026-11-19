import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progress, Spinner } from "@/components/ui/feedback";
import { Timeline } from "@/components/ui/misc";
import type { ReportRecord } from "@/types/comparison";

export type GeneratingProgress = {
  jobs: { done: number; total: number };
  pages: { done: number; total: number } | null;
};

/** A report that is still being assembled: progress and what is left, never a blank page. */
export function GeneratingState({ report, progress }: { report: ReportRecord; progress: GeneratingProgress | null }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Card as="section">
        <CardHeader title="Report is being generated" subtitle="It appears here when the source finishes" actions={<Spinner className="text-accent-text" />} />
        <CardBody className="flex flex-col gap-5">
          {progress ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-xs text-fg-muted">
                  <span>AI visibility requests</span>
                  <span className="tnum">{progress.jobs.done} / {progress.jobs.total} jobs</span>
                </div>
                <Progress value={progress.jobs.done} max={progress.jobs.total} label="AI visibility requests completed" />
              </div>
              {progress.pages ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between text-xs text-fg-muted">
                    <span>Website pages assessed</span>
                    <span className="tnum">{progress.pages.done} / {progress.pages.total} pages</span>
                  </div>
                  <Progress value={progress.pages.done} max={progress.pages.total} label="Website pages assessed" />
                </div>
              ) : null}
            </div>
          ) : null}
          <Timeline
            items={[
              { id: "collect", title: "Collecting results", meta: "In progress", icon: "loader", tone: "accent" },
              { id: "analyse", title: "Analysing responses and pages", meta: "Waiting", icon: "clock" },
              { id: "findings", title: "Findings and recommendations", meta: "Waiting", icon: "clock" },
              { id: "assemble", title: "Assembling the report", meta: "Waiting", icon: "clock" },
            ]}
          />
          <div>
            <ButtonLink href={report.sourceHref} variant="secondary" trailingIcon="arrow-right">View progress</ButtonLink>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
