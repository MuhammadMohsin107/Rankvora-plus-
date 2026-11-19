"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { KeyValue } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

export type RunNowTarget = { id: string; name: string; jobsPerRun: number; windowMinutes: number; maxConcurrency: number; usageCap: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Schedules the user can pick from. */
  schedules: RunNowTarget[];
  /** Preselected schedule id. */
  scheduleId?: string;
};

/** Manual run: a reason is required and the schedule's own limits apply. */
export function RunNowDialog({ open, onClose, schedules, scheduleId }: Props) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked ?? scheduleId ?? schedules[0]?.id ?? "";
  const target = schedules.find((s) => s.id === selectedId) ?? schedules[0];
  const valid = reason.trim().length >= 8;

  const close = () => {
    setReason("");
    setPicked(null);
    onClose();
  };

  const start = () => {
    if (!target) return;
    toast.push({ title: "Manual run queued", description: `${target.name}: ${target.jobsPerRun} jobs, same limits as the schedule. It appears in Runs once it starts. (Demo)`, tone: "success" });
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Run now"
      description="Starts one extra run. It counts toward this month's usage and may raise alerts under the schedule's rules."
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant="primary" icon="play" disabled={!valid || !target} onClick={start}>Start run</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {schedules.length > 1 ? (
          <Field label="Schedule">
            {({ id }) => (
              <Select id={id} value={selectedId} onChange={(event) => setPicked(event.target.value)}>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <Field label="Reason" required hint="At least 8 characters. Saved on the run.">
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Check results after the product page update" />
          )}
        </Field>
        {target ? (
          <KeyValue
            columns={2}
            items={[
              { label: "Jobs", value: <span className="tnum">{target.jobsPerRun}</span> },
              { label: "Run window", value: <span className="tnum">{target.windowMinutes} min</span> },
              { label: "Concurrency", value: <span className="tnum">{target.maxConcurrency}</span> },
              { label: "Usage cap", value: target.usageCap },
            ]}
          />
        ) : null}
      </div>
    </Dialog>
  );
}
