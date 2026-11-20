"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { IconName } from "@/components/ui/icon";
import { Timeline } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import type { Tone } from "@/lib/status";
import type { BillingHistoryEntry } from "@/types/settings";

import type { Billing, TimelineEntry } from "./use-billing";

const ICON: Record<BillingHistoryEntry["kind"], IconName> = { plan: "layers", payment: "credit-card", addon: "plus", refund: "undo", method: "credit-card" };

function toneOf(entry: TimelineEntry): Tone {
  const title = entry.title.toLowerCase();
  if (title.includes("failed")) return "danger";
  if (title.includes("received") || title.includes("recorded")) return "success";
  if (entry.local) return "accent";
  return "neutral";
}

/** Plan and payment events: seeded history plus every billing change made in this browser (from demo-state events). */
export function BillingHistory({ b }: { b: Billing }) {
  return (
    <Card>
      <CardHeader title="Billing history" />
      <CardBody>
        <Timeline
          items={b.timeline.map((e) => ({
            id: e.id,
            title: e.title,
            time: formatDate(e.at),
            icon: ICON[e.kind],
            tone: toneOf(e),
            meta: e.local ? <Badge tone="info" icon="layers">Simulated</Badge> : e.detail,
          }))}
        />
      </CardBody>
    </Card>
  );
}
