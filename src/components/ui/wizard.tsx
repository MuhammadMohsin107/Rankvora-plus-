"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button } from "./button";
import { Icon } from "./icon";
import { Progress, Stepper } from "./feedback";

export type WizardIssue = {
  message: string;
  /** Id of the field to focus when the message is chosen. */
  fieldId?: string;
};

type WizardFrameProps = {
  steps: { id: string; label: string }[];
  current: number;
  /** Heading of the current step (short). */
  title: string;
  /** One short line under the title. */
  subtitle?: string;
  children: ReactNode;
  /** Optional right-hand panel, e.g. usage estimate or review checklist. */
  aside?: ReactNode;
  onBack?: () => void;
  onStepClick?: (index: number) => void;
  /** Primary action; on the last step use a verb ("Start audit"). */
  primary: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };
  /** Reason shown beside a disabled primary action. */
  blockedReason?: string;
  secondary?: ReactNode;
  className?: string;
  /**
   * Validation summary for the current step. When the primary action is clicked and issues exist afterwards,
   * focus moves to the summary so keyboard and screen-reader users land on what to fix.
   * Pass strings or `{ message, fieldId }` to link each issue to its field.
   */
  issues?: (string | WizardIssue)[];
  /** Free-form slot rendered above the step content (e.g. a custom summary). Use `issues` for plain validation. */
  summarySlot?: ReactNode;
  /** Show a thin progress bar. Default: on for flows of more than four steps. */
  showProgress?: boolean;
  /** Label of the Back button. */
  backLabel?: string;
};

/**
 * One shared frame for every multi-step flow (add website, start audit, schedule, comparison).
 * "Step n of N" is always visible, Back is available after step 1, a disabled primary action
 * says why, and failed validation moves focus to the error summary.
 */
export function WizardFrame({
  steps,
  current,
  title,
  subtitle,
  children,
  aside,
  onBack,
  onStepClick,
  primary,
  blockedReason,
  secondary,
  className,
  issues,
  summarySlot,
  showProgress,
  backLabel = "Back",
}: WizardFrameProps) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const total = steps.length;
  const list = (issues ?? []).map((issue) => (typeof issue === "string" ? { message: issue } : issue));
  const withProgress = showProgress ?? total > 4;

  // Move focus to the summary after a failed "next": runs after the parent re-rendered with the issues.
  useEffect(() => {
    if (attempt > 0 && list.length > 0) summaryRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new click should steal focus, not every issue-list change
  }, [attempt]);

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="rounded-card border border-line bg-surface px-5 py-3 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <p className="tnum text-[13px] font-medium text-fg" aria-live="polite">
            Step {current + 1} of {total}
            <span className="text-fg-muted"> · {steps[current]?.label}</span>
          </p>
        </div>
        {withProgress ? <Progress value={current + 1} max={total} label="Wizard progress" className="mt-2" /> : null}
        {/* Full stepper from sm up; below that the line above plus the bar is the progress indicator. */}
        <Stepper steps={steps} current={current} onStepClick={onStepClick} className="mt-3 hidden sm:flex" />
      </div>
      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-4", aside ? "xl:grid-cols-[minmax(0,1fr)_320px]" : null)}>
        <section aria-labelledby="wizard-step-title" className="min-w-0 rounded-card border border-line bg-surface shadow-card">
          <div className="border-b border-line px-5 py-4">
            <h2 id="wizard-step-title" className="text-base font-semibold text-fg">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</p> : null}
          </div>
          <div className="px-5 py-5">
            {list.length > 0 ? (
              <div
                ref={summaryRef}
                role="alert"
                tabIndex={-1}
                aria-labelledby="wizard-issues-title"
                className="mb-5 rounded-control border border-danger/40 bg-danger-soft px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                <p id="wizard-issues-title" className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-text">
                  <Icon name="alert-circle" size={16} />
                  {list.length === 1 ? "Fix 1 thing to continue" : `Fix ${list.length} things to continue`}
                </p>
                <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-[13px] text-fg">
                  {list.map((issue) => (
                    <li key={`${issue.fieldId ?? ""}${issue.message}`}>
                      {issue.fieldId ? (
                        <button
                          type="button"
                          onClick={() => document.getElementById(issue.fieldId as string)?.focus()}
                          className="cursor-pointer text-left underline decoration-fg-muted underline-offset-2 hover:decoration-fg"
                        >
                          {issue.message}
                        </button>
                      ) : (
                        issue.message
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summarySlot}
            {children}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-5 py-3">
            <div className="flex items-center gap-2">
              {onBack ? <Button variant="secondary" icon="arrow-left" onClick={onBack}>{backLabel}</Button> : null}
              {secondary}
            </div>
            <div className="flex items-center gap-3">
              {primary.disabled && blockedReason ? <p className="text-xs text-fg-muted">{blockedReason}</p> : null}
              <Button
                variant="primary"
                onClick={() => {
                  primary.onClick();
                  setAttempt((value) => value + 1);
                }}
                disabled={primary.disabled}
                loading={primary.loading}
              >
                {primary.label}
              </Button>
            </div>
          </div>
        </section>
        {aside ? <aside aria-label="Summary" className="min-w-0 self-start xl:sticky xl:top-36">{aside}</aside> : null}
      </div>
    </div>
  );
}
