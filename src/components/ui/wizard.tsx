"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button } from "./button";
import { ErrorSummary } from "./error-summary";
import { Progress, Stepper } from "./feedback";

export type WizardIssue = {
  message: string;
  /** Short name shown in the summary chip (the field's label). Defaults to the message. */
  label?: string;
  /** Id of the field to focus when the message is chosen. */
  fieldId?: string;
  /** Or the `name` attribute of the control, when its id is generated. */
  fieldName?: string;
};

const focusField = (issue: WizardIssue) => {
  const el = issue.fieldId ? document.getElementById(issue.fieldId) : issue.fieldName ? document.querySelector<HTMLElement>(`[name="${CSS.escape(issue.fieldName)}"]`) : null;
  el?.focus();
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
  /** Leave out the "Step n of N" card with the stepper (the step title and Back / Next remain). */
  hideStepper?: boolean;
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
  hideStepper = false,
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
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      {hideStepper ? null : (
      <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
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
      )}
      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-3", aside ? "xl:grid-cols-[minmax(0,1fr)_320px]" : null)}>
        <section aria-labelledby="wizard-step-title" className="min-w-0 rounded-card border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-3">
            <h2 id="wizard-step-title" className="text-base font-semibold text-fg">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</p> : null}
          </div>
          <div className="px-4 py-4">
            {list.length > 0 ? (
              <ErrorSummary
                ref={summaryRef}
                noun="thing"
                className="mb-4"
                items={list.map((issue) => ({
                  label: issue.label ?? issue.message,
                  detail: issue.label ? issue.message : undefined,
                  ...(issue.fieldId ? { targetId: issue.fieldId } : issue.fieldName ? { onSelect: () => focusField(issue) } : {}),
                }))}
              />
            ) : null}
            {summarySlot}
            {children}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-2.5">
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
        {aside ? <aside aria-label="Summary" className="min-w-0 self-start xl:sticky xl:top-20">{aside}</aside> : null}
      </div>
    </div>
  );
}
