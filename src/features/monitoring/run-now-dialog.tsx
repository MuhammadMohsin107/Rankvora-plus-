"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout, KeyValue } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { formatNumber } from "@/lib/format";
import type { RunPurpose } from "@/types/monitoring";

import { formatUsd } from "./labels";
import { scheduleMonthUsage } from "./run-sim";
import { monitoringNow, useMonitoring } from "./state";

/** Task statuses where a verification run makes sense: the change is applied or published, not yet confirmed. */
const VERIFIABLE = ["applied", "published", "staged", "verification_pending", "partially_verified", "verified_success", "approved", "in_progress"];

/** Mounted once in the Monitoring layout. Opened with `openRunNow()` from any Monitoring screen. */
export function RunNowHost() {
  const { runDialog } = useMonitoring();
  // Re-mount per opening so the form always starts fresh.
  return runDialog.open ? <RunNowDialog key={`${runDialog.scheduleId ?? ""}|${runDialog.taskId ?? ""}`} /> : null;
}

function RunNowDialog() {
  const { schedules, runs, tasks, base, runDialog, closeRunNow, runNow } = useMonitoring();
  const router = useRouter();
  const options = schedules.filter((s) => s.status === "active" || s.status === "needs_attention");
  const [reason, setReason] = useState("");
  const [scheduleId, setScheduleId] = useState(runDialog.scheduleId && options.some((s) => s.id === runDialog.scheduleId) ? runDialog.scheduleId : (options[0]?.id ?? ""));
  const [purpose, setPurpose] = useState<RunPurpose>(runDialog.purpose ?? "manual");
  const verifiable = tasks.filter((t) => VERIFIABLE.includes(t.status));
  const [taskId, setTaskId] = useState(runDialog.taskId ?? verifiable[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = options.find((s) => s.id === scheduleId);
  const task = purpose === "verification" ? tasks.find((t) => t.id === taskId) : undefined;
  const used = target ? scheduleMonthUsage(runs, target.id, monitoringNow()) : null;
  const valid = reason.trim().length >= 8 && Boolean(target) && (purpose !== "verification" || Boolean(task));

  const start = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    const result = await runNow({ scheduleId: target.id, reason: reason.trim(), purpose, taskId: task?.id, findingId: task?.findingId });
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    closeRunNow();
    router.push(`${base}/runs/${result.id}`);
  };

  return (
    <Dialog
      open
      onClose={closeRunNow}
      title="Run now"
      description="One extra run. The next scheduled run does not change."
      footer={
        <>
          <Button variant="secondary" onClick={closeRunNow}>Cancel</Button>
          <Button variant="primary" icon="play" loading={busy} disabled={!valid} onClick={start}>Start run</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {options.length > 1 ? (
          <Field label="Schedule">
            {({ id }) => (
              <Select id={id} value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}>
                {options.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <Field label="Purpose">
          {({ id }) => (
            <Select id={id} value={purpose} onChange={(event) => setPurpose(event.target.value as RunPurpose)}>
              <option value="manual">Manual check</option>
              <option value="verification" disabled={verifiable.length === 0}>Verify a fix task</option>
            </Select>
          )}
        </Field>
        {purpose === "verification" ? (
          <Field label="Fix task">
            {({ id }) => (
              <Select id={id} value={taskId} onChange={(event) => setTaskId(event.target.value)}>
                {verifiable.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <Field label="Reason" required hint="At least 8 characters. Saved on the run.">
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Check results after the content update" />
          )}
        </Field>
        {target && used ? (
          <KeyValue
            columns={2}
            items={[
              { label: "Jobs", value: <span className="tnum">{target.jobsPerRun}</span> },
              { label: "Initiator", value: "You" },
              { label: "Jobs used this month", value: <span className="tnum">{formatNumber(used.jobs)} / {formatNumber(target.config.usageCap.jobsPerMonth)}</span> },
              { label: "Cost (estimate)", value: <span className="tnum">{formatUsd(used.costUsd)} / {formatUsd(target.config.usageCap.costUsd)}</span> },
            ]}
          />
        ) : null}
        {purpose === "verification" ? <p className="text-helper text-fg-muted">Results are shown as observed after the task. They do not prove the task caused a change.</p> : null}
        {error ? <Callout tone="warning" title="Run not started">{error}</Callout> : null}
      </div>
    </Dialog>
  );
}
