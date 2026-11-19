import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { listPromptsBase } from "@/services/core";

/**
 * Shown on every Monitoring tab of a store that has no schedule yet. A store with
 * no AI channel gets a three-step setup view with one next action: connect a channel.
 */
export async function NoSchedules({ storeId, canSchedule }: { storeId: string; canSchedule: boolean }) {
  if (canSchedule) {
    return (
      <EmptyState
        icon="monitoring"
        title="Create your first schedule"
        description="Runs your active prompts on a timetable and tracks changes."
        action={<ButtonLink href={`/stores/${storeId}/monitoring/schedules/new`} variant="primary" icon="plus">New schedule</ButtonLink>}
      />
    );
  }

  const prompts = await listPromptsBase(storeId);
  const active = prompts.filter((p) => p.status === "active").length;
  const steps = [
    {
      id: "prompts",
      done: prompts.length > 0,
      label: prompts.length > 0 ? `${prompts.length} prompt${prompts.length === 1 ? "" : "s"} saved · ${active} active` : "No prompts saved yet",
      detail: prompts.length > 0 ? "Draft and paused prompts are skipped when a run starts." : "Add prompts in the prompt library.",
    },
    { id: "channel", done: false, label: "No AI channel connected", detail: "Monitoring sends prompts through a provider API. Connect at least one." },
    { id: "schedule", done: false, label: "No schedule yet", detail: "Available once a channel is connected." },
  ];

  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        icon="monitoring"
        title="Connect an AI channel first"
        description="Monitoring runs prompts through an AI channel. This store has none yet, so there are no runs, alerts or usage to show."
        action={<ButtonLink href={`/stores/${storeId}/settings`} variant="primary" icon="plug">Connect an AI channel</ButtonLink>}
      />
      <Card>
        <CardBody>
          <ol className="flex flex-col gap-3" aria-label="Monitoring setup steps">
            {steps.map((step, index) => (
              <li key={step.id} className="flex items-start gap-3">
                <Icon name={step.done ? "check-circle" : "circle"} size={18} className={step.done ? "mt-0.5 shrink-0 text-success" : "mt-0.5 shrink-0 text-fg-subtle"} />
                <div className="min-w-0">
                  <p className="tnum text-[13px] font-medium text-fg">{index + 1}. {step.label}<span className="sr-only">{step.done ? " (done)" : " (not done)"}</span></p>
                  <p className="text-xs text-fg-subtle">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
