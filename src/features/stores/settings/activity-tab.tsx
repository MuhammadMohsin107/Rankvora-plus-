"use client";

import { useState } from "react";

import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import type { IconName } from "@/components/ui/icon";
import { Timeline } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/status";
import type { ActivityEntry, ActivityKind } from "@/types/settings";

const KIND: Record<ActivityKind, { label: string; icon: IconName; tone: Tone }> = {
  store: { label: "Website", icon: "globe", tone: "accent" },
  integration: { label: "Integrations", icon: "plug", tone: "info" },
  competitor: { label: "Competitors", icon: "users", tone: "neutral" },
  brand: { label: "Brand", icon: "file-text", tone: "accent" },
  domain: { label: "Domains", icon: "globe", tone: "neutral" },
  product: { label: "Products and services", icon: "layers", tone: "neutral" },
  notification: { label: "Notifications", icon: "bell", tone: "neutral" },
};

export function ActivityTab({ entries, timezone }: { entries: ActivityEntry[]; timezone: string }) {
  const [kind, setKind] = useState<"" | ActivityKind>("");
  const shown = kind ? entries.filter((e) => e.kind === kind) : entries;
  const kinds = (Object.keys(KIND) as ActivityKind[]).filter((k) => entries.some((e) => e.kind === k));

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
        <p className="text-helper text-fg-muted">Times in {timezone}</p>
        <div className="w-44">
          <Select aria-label="Filter by type" value={kind} onChange={(e) => setKind(e.target.value as "" | ActivityKind)}>
            <option value="">Type: all</option>
            {kinds.map((k) => (
              <option key={k} value={k}>{KIND[k].label}</option>
            ))}
          </Select>
        </div>
      </div>
      <CardBody>
        {shown.length === 0 ? (
          <EmptyState icon="history" title="No activity" />
        ) : (
          <Timeline
            items={shown.map((entry) => ({
              id: entry.id,
              title: entry.title,
              icon: KIND[entry.kind].icon,
              tone: KIND[entry.kind].tone,
              time: formatDateTime(entry.at, timezone),
              meta: entry.detail ? `${entry.actor} · ${entry.detail}` : entry.actor,
            }))}
          />
        )}
      </CardBody>
    </Card>
  );
}
