"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import type { StoreStatus } from "@/types/core";

import { transitionCopy } from "../status-transitions";

type Row = { to: StoreStatus; label: string; description: string; enabled: boolean; reason?: string };

export function DangerTab({ status, websiteName, reactivateBlocked, onStatus, onDelete }: { status: StoreStatus; websiteName: string; reactivateBlocked?: string; onStatus: (to: StoreStatus) => void; onDelete: () => void }) {
  const rows: Row[] = [];

  if (status === "archived") {
    rows.push({ to: "paused", label: "Restore website", description: "Makes the website editable again. It stays paused until you resume it.", enabled: true });
  } else {
    if (status === "paused") rows.push({ to: "active", label: "Resume website", description: "Scheduled runs start again.", enabled: true });
    else {
      if (status === "disconnected") rows.push({ to: "active", label: "Reactivate website", description: "Scheduled runs start again.", enabled: !reactivateBlocked, reason: reactivateBlocked });
      rows.push({
        to: "paused",
        label: "Pause website",
        description: "Stops scheduled runs.",
        enabled: status === "active",
        reason: status === "active" ? undefined : "Only active websites can be paused.",
      });
    }
    rows.push({ to: "archived", label: "Archive website", description: "Makes the website read-only and cancels schedules.", enabled: true });
  }

  return (
    <Card className="border-danger/30">
      <CardBody className="pt-2">
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const copy = transitionCopy(status, row.to, websiteName);
            return (
              <li key={row.label} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 max-w-xl">
                  <p className="text-[13px] text-fg">{row.description}</p>
                  {row.reason ? <p className="mt-0.5 text-helper text-fg-muted">{row.reason}</p> : null}
                </div>
                <Button variant={copy.tone === "danger" ? "danger-ghost" : "secondary"} icon={copy.icon} disabled={!row.enabled} onClick={() => onStatus(row.to)}>
                  {row.label}
                </Button>
              </li>
            );
          })}
          <li className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 max-w-xl">
              <p className="text-[13px] text-fg">Permanently removes this website with its prompts, results, tasks and settings. This cannot be undone.</p>
            </div>
            <Button variant="danger" icon="trash" onClick={onDelete}>
              Delete website
            </Button>
          </li>
        </ul>
      </CardBody>
    </Card>
  );
}
