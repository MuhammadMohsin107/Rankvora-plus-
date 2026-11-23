"use client";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";

import { useMonitoring } from "./state";

/**
 * Shown on every Monitoring tab of a website that has no schedule yet. A website with no AI provider connected gets one
 * card with the three setup steps and one next action: connect a provider.
 */
export function NoSchedules() {
  const { data, prompts } = useMonitoring();
  const storeId = data.storeId;
  if (data.canSchedule) {
    return (
      <EmptyState
        icon="monitoring"
        title="Create your first schedule"
        description="Runs your active prompts on a timetable and tracks changes."
        action={<ButtonLink href={`/stores/${storeId}/monitoring/schedules/new`} variant="primary" icon="plus">New schedule</ButtonLink>}
      />
    );
  }

  const active = prompts.filter((p) => p.status === "active").length;
  const steps = [
    { id: "prompts", done: prompts.length > 0, label: prompts.length > 0 ? `${prompts.length} prompt${prompts.length === 1 ? "" : "s"} · ${active} active` : "No prompts yet" },
    { id: "provider", done: false, label: "Connect an AI provider" },
    { id: "schedule", done: false, label: "Create a schedule" },
  ];

  return (
    <Card>
      <CardBody className="flex flex-col items-start gap-4">
        <div>
          <h2 className="text-section font-semibold text-fg">Connect an AI provider first</h2>
          <p className="mt-1 text-body-sm text-fg-muted">Monitoring needs one provider before it can run.</p>
        </div>
        <ol className="flex flex-col gap-2.5" aria-label="Monitoring setup steps">
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-center gap-2.5 text-body-sm">
              <Icon name={step.done ? "check-circle" : "circle"} size={18} className={step.done ? "shrink-0 text-success-icon" : "shrink-0 text-fg-faint"} />
              <span className={step.done ? "text-fg-muted" : "text-fg"}>
                <span className="tnum">{index + 1}. </span>
                {step.label}
                <span className="sr-only">{step.done ? " (done)" : " (not done)"}</span>
              </span>
            </li>
          ))}
        </ol>
        <ButtonLink href={`/stores/${storeId}/settings`} variant="primary" icon="plug">Connect a provider</ButtonLink>
      </CardBody>
    </Card>
  );
}
