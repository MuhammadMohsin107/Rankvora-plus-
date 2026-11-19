import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

/** Shown on every Monitoring tab of a store that has no schedule yet. */
export function NoSchedules({ storeId, canSchedule }: { storeId: string; canSchedule: boolean }) {
  return (
    <EmptyState
      icon="monitoring"
      title={canSchedule ? "Create your first schedule" : "Connect an AI channel first"}
      description={canSchedule ? "Runs your active prompts on a timetable and tracks changes." : "Monitoring runs prompts through an AI channel. This store has none yet."}
      action={
        canSchedule ? (
          <ButtonLink href={`/stores/${storeId}/monitoring/schedules/new`} variant="primary" icon="plus">New schedule</ButtonLink>
        ) : (
          <ButtonLink href={`/stores/${storeId}/settings`} variant="primary" icon="plug">Connect an AI channel</ButtonLink>
        )
      }
    />
  );
}
