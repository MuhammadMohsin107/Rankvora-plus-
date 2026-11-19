"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/tabs";
import type { MonitoringHeaderData } from "@/types/monitoring";

import { RunNowDialog } from "./run-now-dialog";

/**
 * Section header for the top-level Monitoring tabs. Detail pages (a run, a schedule,
 * the schedule form) render their own PageHeader, so this renders nothing there:
 * one h1 per page.
 */
export function MonitoringHeader({ data }: { data: MonitoringHeaderData }) {
  const pathname = usePathname();
  const [runOpen, setRunOpen] = useState(false);
  const base = `/stores/${data.storeId}/monitoring`;
  const rel = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  if (/^\/(schedules|runs)\/[^/]+/.test(rel)) return null;

  const hasSchedules = data.schedules.length > 0;
  const section = rel.split("/")[1] ?? "";

  let actions: React.ReactNode = null;
  if (section === "schedules") {
    actions = data.canSchedule ? (
      <ButtonLink href={`${base}/schedules/new`} variant="primary" icon="plus">New schedule</ButtonLink>
    ) : null;
  } else if (section === "" || section === "runs") {
    actions = hasSchedules ? (
      <Button variant="primary" icon="play" onClick={() => setRunOpen(true)}>Run now</Button>
    ) : data.canSchedule ? (
      <ButtonLink href={`${base}/schedules/new`} variant="primary" icon="plus">New schedule</ButtonLink>
    ) : null;
  } else if (section === "alerts" || section === "usage") {
    actions = hasSchedules ? <ButtonLink href={`${base}/schedules`} variant="secondary" icon="settings">{section === "alerts" ? "Alert rules" : "Usage caps"}</ButtonLink> : null;
  }

  return (
    <>
      <PageHeader
        title="Monitoring"
        subtitle="Scheduled API answer samples across your AI channels"
        actions={actions}
        tabs={
          <LinkTabs
            label="Monitoring sections"
            items={[
              { href: base, label: "Overview", exact: true },
              { href: `${base}/schedules`, label: "Schedules" },
              { href: `${base}/runs`, label: "Runs" },
              { href: `${base}/observations`, label: "Observations" },
              { href: `${base}/alerts`, label: "Alerts", count: data.openAlerts > 0 ? data.openAlerts : undefined },
              { href: `${base}/usage`, label: "Usage" },
            ]}
          />
        }
      />
      {hasSchedules ? <RunNowDialog open={runOpen} onClose={() => setRunOpen(false)} schedules={data.schedules.map((s) => ({ ...s }))} /> : null}
    </>
  );
}
