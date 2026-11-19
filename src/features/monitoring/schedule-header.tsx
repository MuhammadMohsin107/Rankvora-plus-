"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import type { ScheduleRow, ScheduleStatus } from "@/types/monitoring";

import { RunNowDialog } from "./run-now-dialog";
import { CancelScheduleDialog, runTargetOf, scheduleMenuItems } from "./schedules-table";

/** Header of a schedule: pause / resume / run now / cancel with local demo state. */
export function ScheduleHeader({ storeId, row }: { storeId: string; row: ScheduleRow }) {
  const toast = useToast();
  const router = useRouter();
  const [status, setStatus] = useState<ScheduleStatus>(row.status);
  const [runOpen, setRunOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const base = `/stores/${storeId}/monitoring`;
  const cancelled = status === "cancelled";

  const toggle = () => {
    const next: ScheduleStatus = status === "paused" ? "active" : "paused";
    setStatus(next);
    toast.push({ title: next === "paused" ? "Schedule paused" : "Schedule resumed", description: next === "paused" ? "No runs until resumed. (Demo)" : "Next run follows the timetable. (Demo)", tone: "success" });
  };

  return (
    <>
      <PageHeader
        title={row.name}
        subtitle={`${row.frequencyLabel} · ${row.timezone} · version ${row.currentVersion}`}
        breadcrumb={[{ label: "Monitoring", href: base }, { label: "Schedules", href: `${base}/schedules` }, { label: row.id }]}
        meta={<Status kind="schedule" value={status} />}
        actions={
          <>
            <Button icon="bolt" onClick={() => setRunOpen(true)} disabled={cancelled}>Run now</Button>
            <Button icon={status === "paused" ? "play" : "pause"} onClick={toggle} disabled={cancelled}>{status === "paused" ? "Resume" : "Pause"}</Button>
            <ButtonLink href={`${base}/schedules/${row.id}/edit`} variant="primary" icon="pencil" aria-disabled={cancelled || !row.editable} tabIndex={cancelled || !row.editable ? -1 : undefined}>Edit</ButtonLink>
            <Menu
              trigger={<IconButton icon="more" label="More actions" variant="secondary" />}
              items={scheduleMenuItems({ storeId, row, status, onToggle: toggle, onRunNow: () => setRunOpen(true), onCancel: () => setCancelOpen(true), includeDetail: false })}
            />
          </>
        }
      />
      <RunNowDialog open={runOpen} onClose={() => setRunOpen(false)} schedules={[runTargetOf(row)]} scheduleId={row.id} />
      <CancelScheduleDialog
        name={row.name}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setStatus("cancelled");
          setCancelOpen(false);
          toast.push({ title: "Schedule cancelled", description: "Future runs removed; past runs kept. (Demo)", tone: "success" });
          router.push(`${base}/schedules`);
        }}
      />
    </>
  );
}
