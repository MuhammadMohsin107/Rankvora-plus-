"use client";

import { Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { StoreStatus } from "@/types/core";

import { transitionCopy } from "../status-transitions";

type Row = { to: StoreStatus; title: string; description: string; enabled: boolean; reason?: string };

export function DangerTab({ status, storeName, onStatus }: { status: StoreStatus; storeName: string; onStatus: (to: StoreStatus) => void }) {
  const rows: Row[] = [];

  if (status === "archived") {
    rows.push({ to: "paused", title: "Restore store", description: "Makes the store editable again. It stays paused until you resume it.", enabled: true });
  } else {
    if (status === "paused") rows.push({ to: "active", title: "Resume store", description: "Scheduled runs start again at their next scheduled time.", enabled: true });
    else
      rows.push({
        to: "paused",
        title: "Pause store",
        description: "Stops scheduled runs. Prompts, results and reports are kept.",
        enabled: status === "active",
        reason: status === "active" ? undefined : "Only active stores can be paused.",
      });
    rows.push({ to: "archived", title: "Archive store", description: "Makes the store read-only, cancels schedules and removes it from the store switcher. Results and reports are kept.", enabled: true });
  }

  return (
    <Card className="border-danger/30">
      <CardHeader title="Danger zone" actions={<Status kind="store" value={status} />} />
      <CardBody className="pt-2">
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const copy = transitionCopy(status, row.to, storeName);
            return (
              <li key={row.title} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 max-w-xl">
                  <p className="text-[13px] font-medium text-fg">{row.title}</p>
                  <p className="text-xs text-fg-muted">{row.description}</p>
                  {row.reason ? <p className="mt-0.5 text-xs text-fg-subtle">{row.reason}</p> : null}
                </div>
                <Button variant={copy.tone === "danger" ? "danger-ghost" : "secondary"} icon={copy.icon} disabled={!row.enabled} onClick={() => onStatus(row.to)}>
                  {row.title}
                </Button>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
