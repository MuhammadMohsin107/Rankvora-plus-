import Link from "next/link";

import { Status } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import type { Tone } from "@/lib/status";
import type { MonitoringEvent } from "@/types/monitoring";

import { EVENT_ICON, EVENT_TONE, SEVERITY_STATUS, eventMeta } from "./labels";

const circle: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-subtle",
  accent: "bg-accent-soft text-accent-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

/** Compact list of events (what changed). Used on the Overview. */
export function EventList({ events, href }: { events: MonitoringEvent[]; href: string }) {
  return (
    <ul className="divide-y divide-line">
      {events.map((event) => (
        <li key={event.id}>
          <Link href={href} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-surface-2/50 sm:-mx-2 sm:rounded-control sm:px-2">
            <span aria-hidden="true" className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", circle[EVENT_TONE[event.type]])}>
              <Icon name={EVENT_ICON[event.type]} size={13} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-fg">{event.title}</p>
              <p className="mt-0.5 text-xs text-fg-subtle">{eventMeta(event)} · {formatRelative(event.at)}</p>
            </div>
            {event.alert ? <Status kind="severity" value={SEVERITY_STATUS[event.alert.severity]} compact /> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
