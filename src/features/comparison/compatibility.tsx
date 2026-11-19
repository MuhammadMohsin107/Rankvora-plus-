import { Status } from "@/components/ui/badge";
import { Callout } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import type { Tone } from "@/lib/status";
import type { Check, Comparability } from "@/types/comparison";
import type { Rate } from "@/types/core";
import { STATUS } from "@/lib/status";

const checkValue = { pass: "pass", warn: "warning", fail: "fail" } as const;

/** Hard checks and soft warnings, each with state (icon + text), label and one line of detail. */
export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="divide-y divide-line">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="w-[4.5rem] shrink-0 pt-px">
            <Status kind="check" value={checkValue[check.state]} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-fg">{check.label}</p>
            <p className="text-xs text-fg-muted">{check.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const verdictTone: Record<Comparability, Tone> = {
  comparable: "success",
  comparable_with_warnings: "warning",
  partially_comparable: "warning",
  insufficient_data: "warning",
  not_comparable: "danger",
};

/**
 * The matched coverage in counts and the main reasons. `showVerdict` puts the verdict label in the
 * title; leave it off where the verdict is already shown next to it.
 */
export function VerdictBanner({
  verdict,
  coverage,
  unmatched,
  excluded,
  checks,
  actions,
  className,
  showVerdict = true,
  showIssues = true,
}: {
  verdict: Comparability;
  coverage: Rate;
  unmatched: number;
  excluded: number;
  checks: Check[];
  actions?: React.ReactNode;
  className?: string;
  showVerdict?: boolean;
  showIssues?: boolean;
}) {
  const counts = `${unmatched} unmatched · ${excluded} excluded`;
  const issues = !showIssues ? [] : checks
    .filter((c) => c.state !== "pass")
    .sort((a, b) => Number(b.severity === "major") - Number(a.severity === "major") || Number(b.kind === "hard") - Number(a.kind === "hard"))
    .slice(0, 3);
  return (
    <Callout
      tone={verdictTone[verdict]}
      title={showVerdict ? STATUS.comparability[verdict].label : `${coverage.n} / ${coverage.d} slots matched`}
      actions={actions}
      className={className}
    >
      <p className="tnum">{showVerdict ? `${coverage.n} / ${coverage.d} slots matched · ${counts}` : counts}</p>
      {issues.length > 0 ? (
        <ul className="mt-1 list-disc pl-4 text-xs">
          {issues.map((issue) => (
            <li key={issue.id}>{issue.detail}</li>
          ))}
        </ul>
      ) : null}
    </Callout>
  );
}

/** Shown on a tab of a comparison that failed a hard check: no rate, change or export is produced. */
export function NotComputed({ checks, what }: { checks: Check[]; what: string }) {
  const failed = checks.filter((c) => c.kind === "hard" && c.state === "fail");
  return (
    <EmptyState
      icon="x-circle"
      title={`${what} not computed`}
      description={`This comparison is not comparable, so no numbers are produced. ${failed.map((c) => c.detail).join(" ")}`.trim()}
    />
  );
}
