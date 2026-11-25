"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Timeline } from "@/components/ui/misc";
import { useDemoEvents } from "@/demo-state";
import { formatDateTime } from "@/lib/format";

/** What was done to this comparison in this browser (created, archived, restored, report added). Simulated, local. */
export function ComparisonHistory({ comparisonId }: { comparisonId: string }) {
  const events = useDemoEvents({ comparisonId });
  return (
    <Card>
      <CardHeader title="History" />
      <CardBody className="pt-3">
        {events.length === 0 ? (
          <p className="text-body-sm text-fg-muted">No history yet.</p>
        ) : (
          <Timeline
            items={[...events].reverse().map((e) => ({
              id: e.id,
              icon: e.kind === "comparison.archived" ? "minus-circle" : e.kind === "report.generated" ? "reports" : "compare",
              tone: "neutral",
              time: `${formatDateTime(e.at)} UTC`,
              title: e.label,
            }))}
          />
        )}
      </CardBody>
    </Card>
  );
}
