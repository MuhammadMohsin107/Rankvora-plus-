"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover } from "@/components/ui/popover";
import { isAlertUnread, useDemoAlerts } from "@/demo-state";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import type { AlertHeadline, Store } from "@/types/core";

const MAX_ROWS = 6;

type Props = {
  alerts: AlertHeadline[];
  websites: Store[];
  /** Website whose alerts the footer link opens. */
  contextWebsiteId: string | null;
};

/** Bell with the shared unread count and a popover list. Read state lives in demo-state. */
export function Notifications({ alerts, websites, contextWebsiteId }: Props) {
  const { rows, unreadCount, markRead, markAllRead } = useDemoAlerts(alerts);
  const recent = useMemo(() => [...rows].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, MAX_ROWS), [rows]);
  const nameOf = (id: string) => websites.find((w) => w.id === id)?.name ?? id;
  const alertsHref = contextWebsiteId ? `/stores/${contextWebsiteId}/monitoring/alerts` : "/stores";

  return (
    <Popover
      label="Notifications"
      align="end"
      width={400}
      trigger={
        <IconButton
          icon="bell"
          label={unreadCount ? `Notifications, ${unreadCount} unread${unreadCount > 9 ? ", shown as 9+" : ""}` : "Notifications"}
          className="pointer-coarse:size-11"
          badge={
            unreadCount ? (
              <span aria-hidden="true" className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-solid px-1 text-2xs font-semibold leading-none text-danger-fg ring-2 ring-surface">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null
          }
        />
      }
    >
      {({ close }) => (
        <div className="-m-4 flex flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <h2 className="text-card-title font-semibold text-fg">Notifications</h2>
            <button
              type="button"
              disabled={unreadCount === 0}
              onClick={markAllRead}
              className="-mr-2 inline-flex h-8 cursor-pointer items-center rounded-control px-2 text-label font-medium text-accent-text hover:bg-accent-soft disabled:cursor-not-allowed disabled:text-fg-subtle disabled:hover:bg-transparent pointer-coarse:h-11"
            >
              Mark all read
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="px-4 py-4 text-center text-body-sm text-fg-muted">No notifications.</p>
          ) : (
            <ul className="flex flex-col">
              {recent.map((alert) => {
                const unread = isAlertUnread(alert);
                return (
                  <li key={alert.id} className="flex items-stretch border-b border-line-soft last:border-b-0">
                    <Link
                      href={`/stores/${alert.storeId}/monitoring/alerts`}
                      onClick={() => {
                        if (unread) markRead(alert.id);
                        close();
                      }}
                      className={cn("flex min-w-0 flex-1 items-start gap-2.5 px-4 py-2.5 hover:bg-surface-2", unread && "bg-accent-soft/40")}
                    >
                      <Icon name={unread ? "circle-dot" : "bell"} size={16} className={cn("mt-0.5 shrink-0", unread ? "text-accent" : "text-fg-faint")} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={cn("text-body-sm text-fg", unread && "font-medium")}>
                          {unread ? <span className="sr-only">Unread: </span> : null}
                          {alert.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-helper text-fg-muted">
                          <span className="truncate">{nameOf(alert.storeId)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tnum">{formatRelative(alert.at)}</span>
                          {alert.severity === "critical" || alert.severity === "high" ? <Badge tone="danger">{alert.severity === "critical" ? "Critical" : "High"}</Badge> : null}
                        </span>
                      </span>
                    </Link>
                    {unread ? (
                      <button
                        type="button"
                        onClick={() => markRead(alert.id)}
                        aria-label={`Mark read: ${alert.title}`}
                        className="flex w-11 shrink-0 cursor-pointer items-center justify-center text-fg-subtle hover:bg-surface-2 hover:text-fg"
                      >
                        <Icon name="check" size={16} />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-line p-2">
            <Link href={alertsHref} onClick={close} className="flex min-h-9 items-center justify-between rounded-control px-2 text-body-sm font-medium text-accent-text hover:bg-accent-soft pointer-coarse:min-h-11">
              View all alerts <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      )}
    </Popover>
  );
}
