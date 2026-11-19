import { ButtonLink } from "@/components/ui/button";
import { Callout, } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";

/** Shown on every Monitoring tab of a store that has no schedule yet. */
export function NoSchedules({ storeId, canSchedule }: { storeId: string; canSchedule: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {!canSchedule ? (
        <Callout tone="warning" title="Connect an AI channel first">
          Monitoring runs prompts through an AI channel. This store has none yet.
        </Callout>
      ) : null}
      <EmptyState
        icon="monitoring"
        title="Create your first schedule"
        description="A schedule runs your active prompts on a timetable and tracks changes."
        action={
          canSchedule ? (
            <ButtonLink href={`/stores/${storeId}/monitoring/schedules/new`} variant="primary" icon="plus">New schedule</ButtonLink>
          ) : (
            <ButtonLink href={`/stores/${storeId}/settings`} variant="primary" icon="plug">Connect an AI channel</ButtonLink>
          )
        }
      />
    </div>
  );
}
