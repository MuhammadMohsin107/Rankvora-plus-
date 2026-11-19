"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button } from "./button";
import { Stepper } from "./feedback";

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
};

/**
 * One shared frame for every multi-step flow (add store, start audit, schedule, comparison).
 * Progress is always visible, Back is always available after step 1, and a disabled
 * primary action says why.
 */
export function WizardFrame({ steps, current, title, subtitle, children, aside, onBack, onStepClick, primary, blockedReason, secondary, className }: WizardFrameProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
        <Stepper steps={steps} current={current} onStepClick={onStepClick} />
      </div>
      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-5", aside ? "xl:grid-cols-[minmax(0,1fr)_320px]" : null)}>
        <section aria-labelledby="wizard-step-title" className="min-w-0 rounded-card border border-line bg-surface shadow-card">
          <div className="border-b border-line px-5 py-4">
            <h2 id="wizard-step-title" className="text-base font-semibold text-fg">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</p> : null}
          </div>
          <div className="px-5 py-5">{children}</div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/50 px-5 py-3">
            <div className="flex items-center gap-2">
              {onBack ? <Button variant="secondary" icon="arrow-left" onClick={onBack}>Back</Button> : null}
              {secondary}
            </div>
            <div className="flex items-center gap-3">
              {primary.disabled && blockedReason ? <p className="text-xs text-fg-subtle">{blockedReason}</p> : null}
              <Button variant="primary" onClick={primary.onClick} disabled={primary.disabled} loading={primary.loading}>
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
