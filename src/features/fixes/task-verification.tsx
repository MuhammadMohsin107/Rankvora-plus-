"use client";

import Link from "next/link";

import { SimulatedBadge } from "@/components/ui/demo";
import { Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, Metric } from "@/components/ui/card";
import { Segmented } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { formatDateTime } from "@/lib/format";
import type { TaskStatus, VerificationOutcome, VerificationRecord } from "@/types/fixes";

import { SIMULATED_LABEL, type SimulatedResult } from "./fixes-logic";

type Props = {
  storeId: string;
  record: VerificationRecord;
  outcome: VerificationOutcome | null;
  status: TaskStatus;
  verifying: boolean;
  simulated: SimulatedResult;
  onSimulated: (value: SimulatedResult) => void;
  onRun: () => void;
  /** Latest completed Monitoring run, linked as the observation. */
  latestRunId: string | null;
  comparisons: { id: string; title: string }[];
  /** Comparison ids this fix was already added to. */
  annotated: string[];
  onAnnotate: (comparisonId: string) => void;
};

function PlannedChecks({ checks }: { checks: VerificationRecord["plannedChecks"] }) {
  return (
    <ul className="divide-y divide-line rounded-control border border-line">
      {checks.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
          <span className="text-fg">{c.label}</span>
          <span className="text-xs text-fg-muted">Expect: {c.expect}</span>
        </li>
      ))}
    </ul>
  );
}

/** Checks re-run, before / after evidence, result and the effect on the finding. Applied is never verified. */
export function TaskVerificationTab({ storeId, record, outcome, status, verifying, simulated, onSimulated, onRun, latestRunId, comparisons, annotated, onAnnotate }: Props) {
  const passed = outcome ? outcome.checks.filter((c) => c.after.status === "pass").length : 0;

  return (
    <div className="flex flex-col gap-4">
      {outcome ? (
        <>
          <Card>
            <CardHeader title="Result" />
            <CardBody className="flex flex-col gap-3">
              <p className="text-[13px] text-fg-muted">
                <span className="tnum font-medium text-fg">{passed} / {outcome.checks.length}</span> checks passed
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
                <span className="tnum">Run {formatDateTime(outcome.ranAt)} UTC</span>
                {outcome.sourceHref ? (
                  <Link href={`/stores/${storeId}/${outcome.sourceHref}`} className="text-accent-text hover:underline">{outcome.sourceLabel}</Link>
                ) : (
                  <span>{outcome.sourceLabel}</span>
                )}
              </p>
              <Callout tone={outcome.result === "verified_success" ? "success" : outcome.result === "failed" ? "danger" : "info"} title="Effect on the finding">
                {outcome.findingEffect}
              </Callout>
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {latestRunId ? (
                  <Link href={`/stores/${storeId}/monitoring/runs/${latestRunId}`} className="text-label font-medium text-accent-text hover:underline">
                    Open latest Monitoring run
                  </Link>
                ) : null}
                {comparisons.length > 0 ? (
                  annotated.length > 0 ? (
                    <Link href={`/stores/${storeId}/comparisons/${annotated[0]}`} className="text-label font-medium text-accent-text hover:underline">
                      On the Comparison timeline
                    </Link>
                  ) : (
                    <Menu
                      trigger={<Button size="sm" icon="compare">Add to Comparison timeline</Button>}
                      items={comparisons.map((c) => ({ label: c.title, onSelect: () => onAnnotate(c.id) }))}
                    />
                  )
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Checks re-run" />
            <CardBody className="pt-2">
              <div className="ui-scroll overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-[13px]">
                  <caption className="sr-only">Checks re-run, before and after</caption>
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium text-fg-muted">
                      <th scope="col" className="py-2 pr-3">Check</th>
                      <th scope="col" className="px-3 py-2">Before</th>
                      <th scope="col" className="py-2 pl-3">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.checks.map((c) => (
                      <tr key={c.id} className="border-b border-line last:border-0 align-top">
                        <th scope="row" className="py-2.5 pr-3 text-left font-medium text-fg">{c.label}</th>
                        <td className="px-3 py-2.5">
                          <Status kind="check" value={c.before.status} />
                          <p className="mt-1 text-xs text-fg-muted">{c.before.detail}</p>
                        </td>
                        <td className="py-2.5 pl-3">
                          <Status kind="check" value={c.after.status} />
                          <p className="mt-1 text-xs text-fg-muted">{c.after.detail}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      ) : status === "verification_pending" ? (
        <Card>
          <CardHeader title="Planned checks" />
          <CardBody className="flex flex-col gap-3">
            <Callout tone="warning" title={verifying ? "Running checks" : "Applied, not verified"}>
              {verifying ? undefined : "No check has re-run yet."}
            </Callout>
            <PlannedChecks checks={record.plannedChecks} />
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <span className="flex items-center gap-2 text-label text-fg-muted">
                Simulated outcome <SimulatedBadge />
              </span>
              <Segmented
                label="Simulated outcome"
                size="sm"
                value={simulated}
                onChange={onSimulated}
                options={(Object.keys(SIMULATED_LABEL) as SimulatedResult[]).map((value) => ({ value, label: SIMULATED_LABEL[value] }))}
              />
              <Button variant="secondary" icon="shield-check" loading={verifying} onClick={onRun}>
                Run verification
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : status === "rolled_back" ? (
        <Card>
          <CardHeader title="Planned checks" />
          <CardBody className="flex flex-col gap-3">
            <Callout tone="neutral" title="Rolled back before verification">Nothing to verify.</Callout>
            <PlannedChecks checks={record.plannedChecks} />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Planned checks" />
          <CardBody className="flex flex-col gap-3">
            <Callout tone="neutral" title="Not verified">Checks run after the change is applied.</Callout>
            <PlannedChecks checks={record.plannedChecks} />
          </CardBody>
        </Card>
      )}

      {record.context ? (
        <Card>
          <CardHeader title="Visibility context" info="Visibility changed after this task was completed. This is context, not proof that the task caused it." />
          <CardBody>
            <Metric label={record.context.label} numerator={record.context.n} denominator={record.context.d} basis={record.context.basis} sampleStatus="directional" />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
