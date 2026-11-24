"use client";

import { useMemo } from "react";

import { Callout } from "@/components/ui/card";
import type { AuditDetail, AuditRow } from "@/types/audit";

import { InProgressOverview } from "./in-progress-overview";
import { useAudits } from "./use-audits";

/**
 * Progress of a seeded audit that is still running (a frozen snapshot of the demo). Pause and Cancel from the header
 * still change its state: cancelling shows what was kept, and no snapshot exists.
 */
export function SeededProgress({ storeId, row, audit, channelLabelText }: { storeId: string; row: AuditRow; audit: AuditDetail; channelLabelText: string }) {
  const seeds = useMemo(() => [row], [row]);
  const { live } = useAudits(storeId, seeds);
  const current = live.find((r) => r.id === row.id) ?? row;
  if (current.status === "cancelled") {
    const kept = audit.succeededJobs + audit.failedJobs;
    return (
      <Callout tone="neutral" title="Cancelled">
        Stopped after {kept} of {audit.plannedJobs} requests and {audit.pages?.n ?? 0} pages. The completed work is kept as a partial result. No snapshot was created.
      </Callout>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {current.paused ? <Callout tone="warning" title="Paused">This audit is paused. Resume it from the header.</Callout> : null}
      <InProgressOverview audit={audit} channelLabelText={channelLabelText} />
    </div>
  );
}
