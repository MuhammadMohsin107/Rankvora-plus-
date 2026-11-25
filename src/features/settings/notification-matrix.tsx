"use client";

import { Fragment } from "react";

import { Checkbox } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import type { NotificationChannel, NotificationEvent, NotificationMatrix } from "@/types/settings";

export const CHANNELS: { id: NotificationChannel; label: string }[] = [
  { id: "in_app", label: "In-app" },
  { id: "email", label: "Email" },
  { id: "webhook", label: "Webhook" },
];

type Props = {
  events: NotificationEvent[];
  value: NotificationMatrix;
  onChange: (next: NotificationMatrix) => void;
  disabled?: boolean;
  /** Webhook column is disabled until a destination exists. */
  webhookReady?: boolean;
};

/** Event categories × delivery channels. Each cell is a labelled checkbox. */
export function NotificationMatrixTable({ events, value, onChange, disabled, webhookReady = true }: Props) {
  const groups = [...new Set(events.map((e) => e.group))];

  const toggle = (id: NotificationEvent["id"], channel: NotificationChannel, on: boolean) => {
    const current = value[id];
    onChange({ ...value, [id]: on ? [...current, channel] : current.filter((c) => c !== channel) });
  };

  return (
    <div className="ui-scroll overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-[13px]">
        <caption className="sr-only">Notification channels for each event</caption>
        <thead>
          <tr className="border-y border-line bg-surface-2/70">
            <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-fg-muted">Event</th>
            {CHANNELS.map((channel) => (
              <th key={channel.id} scope="col" className="w-24 px-3 py-2.5 text-center text-xs font-medium text-fg-muted">{channel.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group}>
              <tr className="border-b border-line bg-surface-2/40">
                <th scope="colgroup" colSpan={4} className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{group}</th>
              </tr>
              {events
                .filter((e) => e.group === group)
                .map((event) => (
                  <tr key={event.id} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal text-fg">
                      <span className="inline-flex items-center gap-1.5">
                        {event.label}
                        {event.info ? (
                          <Tooltip content={event.info}>
                            <span role="img" tabIndex={0} aria-label={event.info} className="flex cursor-help text-fg-subtle">
                              <Icon name="info" size={13} />
                            </span>
                          </Tooltip>
                        ) : null}
                      </span>
                    </th>
                    {CHANNELS.map((channel) => {
                      const blocked = channel.id === "webhook" && !webhookReady;
                      return (
                        <td key={channel.id} className="px-3 py-2.5">
                          <div className="flex justify-center" title={blocked ? "Add a webhook address first" : undefined}>
                            <Checkbox
                              aria-label={`${event.label} by ${channel.label}`}
                              checked={value[event.id].includes(channel.id)}
                              disabled={disabled || blocked}
                              onChange={(e) => toggle(event.id, channel.id, e.target.checked)}
                              className="items-center"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
