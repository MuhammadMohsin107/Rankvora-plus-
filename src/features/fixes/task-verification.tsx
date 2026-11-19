"use client";

import Link from "next/link";

import { Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, Metric } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/lib/format";
import type { TaskStatus, VerificationOutcome, VerificationRecord } from "@/types/fixes";

type Props = {
  storeId: string;
  record: VerificationRecord;
  outcome: VerificationOutcome | null;
  status: TaskStatus;
  verifying: boolean;
  onRun: () => void;
};

const RESULT_TEXT = {
  verified_success: "All checks passed on re-check.",
  partially_verified: "Some checks passed; others are not conclusive yet.",
  failed: "One or more checks failed.",
  rolled_back: "Rolled back. The change is no longer in place.",
} as const;

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
export function TaskVerificationTab({ storeId, record, outcome, status, verifying, onRun }: Props) {
  const passed = outcome ? outcome.checks.filter((c) => c.after.status === "pass").length : 0;

  return (
    <div className="flex flex-col gap-4">
      {outcome ? (
        <>
          <Card>
            <CardHeader title="Result" actions={<Status kind="task" value={outcome.result} />} />
            <CardBody className="flex flex-col gap-3">
              <p className="text-[13px] text-fg-muted">
                <span className="tnum font-medium text-fg">{passed} / {outcome.checks.length}</span> checks passed. {RESULT_TEXT[outcome.result]}
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
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Checks re-run" subtitle="Before and after evidence" />
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
          <CardHeader title="Verification pending" actions={<Status kind="task" value="verification_pending" />} />
          <CardBody className="flex flex-col gap-3">
            <Callout tone="warning" title="Applied, not verified">
              The change is in place but no check has re-run yet. It counts as verified only after the checks below pass.
            </Callout>
            <PlannedChecks checks={record.plannedChecks} />
            <div>
              <Button variant="primary" icon="shield-check" loading={verifying} onClick={onRun}>
                {verifying ? "Running checks" : "Run verification"}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : status === "rolled_back" ? (
        <Card>
          <CardHeader title="Not verified" actions={<Status kind="task" value="rolled_back" />} />
          <CardBody className="flex flex-col gap-3">
            <Callout tone="neutral" title="Rolled back before verification">The change is no longer in place, so there is nothing to verify.</Callout>
            <PlannedChecks checks={record.plannedChecks} />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Planned checks" />
          <CardBody className="flex flex-col gap-3">
            <Callout tone="neutral" title="Not verified">
              <span className="flex items-center gap-1.5"><Icon name="clock" size={13} />Checks run after the change is applied. Applied is not verified.</span>
            </Callout>
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
