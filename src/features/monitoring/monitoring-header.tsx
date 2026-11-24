"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

import { useMonitoring } from "./state";

const HOW_IT_WORKS =
  "Each result is an API answer sample for one provider, model and search mode. It may differ from the consumer app. Rates are mentions divided by successful answers; failed requests are never counted as the brand being absent.";

type Tab = { href: string; label: string; count?: number; match: (rel: string) => boolean };

/**
 * Header and tabs of the top-level Monitoring screens. Detail pages (a run, a schedule, the schedule form) render their
 * own PageHeader, so this renders nothing there: one h1 per page. The page's one primary action goes to the global header.
 */
export function MonitoringHeader() {
  const pathname = usePathname();
  const { data, base, schedules, alerts, openRunNow } = useMonitoring();
  const rel = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  if (/^\/(schedules|runs)\/[^/]+/.test(rel)) return null;

  const hasSchedules = schedules.length > 0;
  const runnable = schedules.some((s) => s.status === "active" || s.status === "needs_attention");
  const section = rel.split("/")[1] ?? "";

  const tabs: Tab[] = [
    { href: base, label: "Overview", match: (r) => r === "" || r === "/" },
    { href: `${base}/schedules`, label: "Schedules", match: (r) => r.startsWith("/schedules") },
    { href: `${base}/runs`, label: "History", match: (r) => r.startsWith("/runs") || r.startsWith("/observations") },
    { href: `${base}/alerts`, label: "Alerts", count: alerts.unreadCount > 0 ? alerts.unreadCount : undefined, match: (r) => r.startsWith("/alerts") },
    { href: `${base}/usage`, label: "Usage", match: (r) => r.startsWith("/usage") },
  ];

  // With no schedule yet, the page's empty state carries the single next action.
  let action: ReactNode = null;
  if (hasSchedules && section === "schedules") {
    action = data.canSchedule ? (
      <ButtonLink href={`${base}/schedules/new`} variant="primary" icon="plus">New schedule</ButtonLink>
    ) : null;
  } else if (hasSchedules && (section === "" || section === "runs" || section === "observations")) {
    action = (
      <Button variant="primary" icon="play" disabled={!runnable} title={runnable ? undefined : "Activate a schedule to run it"} onClick={() => openRunNow()}>
        Run now
      </Button>
    );
  }

  return (
    <>
      {action ? <HeaderAction>{action}</HeaderAction> : null}
      <PageHeader
        title="Monitoring"
        subtitle="Scheduled AI answer checks"
        meta={
          <Tooltip content={HOW_IT_WORKS}>
            <span className="inline-flex cursor-help text-fg-subtle" tabIndex={0} aria-label={HOW_IT_WORKS}>
              <Icon name="info" size={16} />
            </span>
          </Tooltip>
        }
        tabs={
          <nav aria-label="Monitoring sections" className="ui-scroll -mb-px flex gap-1 overflow-x-auto border-b border-line">
            {tabs.map((tab) => {
              const active = tab.match(rel);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-body font-medium transition-colors duration-[var(--dur-fast)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring pointer-coarse:h-11",
                    active ? "text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined ? (
                    <span className="tnum rounded-full bg-surface-3 px-1.5 text-helper text-fg">
                      {tab.count}
                      <span className="sr-only"> unread</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        }
      />
    </>
  );
}

/** Switch between the two history views. Both stay routes of their own. */
export function HistorySwitch({ current }: { current: "runs" | "prompts" }) {
  const { base } = useMonitoring();
  const item = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("inline-flex h-8 items-center rounded-control px-3 text-label font-medium pointer-coarse:h-11", active ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg")}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="History view" className="inline-flex w-fit gap-0.5 rounded-control bg-surface-3 p-0.5">
      {item(`${base}/runs`, "Runs", current === "runs")}
      {item(`${base}/observations`, "Prompts", current === "prompts")}
    </nav>
  );
}
