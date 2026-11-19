import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { IconName } from "@/components/ui/icon";
import { Timeline } from "@/components/ui/misc";
import { DEMO_NOW, formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/status";
import type { HistoryEvent, HistoryKind } from "@/types/fixes";

const KIND: Record<HistoryKind, { icon: IconName; tone: Tone }> = {
  created: { icon: "circle-dot", tone: "accent" },
  draft: { icon: "file-text", tone: "info" },
  approval: { icon: "check-circle", tone: "success" },
  execution: { icon: "bolt", tone: "accent" },
  verification: { icon: "shield-check", tone: "success" },
  rollback: { icon: "undo", tone: "warning" },
  status: { icon: "circle", tone: "neutral" },
};

/** Drafts, approvals, executions, verifications and rollbacks in order, newest first. */
export function TaskHistoryTab({ events }: { events: HistoryEvent[] }) {
  const ordered = [...events].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return (
    <Card>
      <CardHeader title="History" subtitle={`${events.length} events`} />
      <CardBody>
        <Timeline
          items={ordered.map((event) => ({
            id: event.id,
            icon: KIND[event.kind].icon,
            tone: KIND[event.kind].tone,
            title: event.title,
            time: event.at === DEMO_NOW ? "Just now (demo)" : formatDateTime(event.at),
            meta: (
              <>
                {event.actor}
                {event.detail ? <span> · {event.detail}</span> : null}
              </>
            ),
          }))}
        />
      </CardBody>
    </Card>
  );
}
