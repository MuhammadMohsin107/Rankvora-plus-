import Link from "next/link";

import { Badge, Status } from "@/components/ui/badge";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Timeline } from "@/components/ui/misc";
import { NotComputed } from "@/features/comparison/compatibility";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import { formatDate, formatPoints, formatShortDate } from "@/lib/format";
import { pointChange } from "@/lib/stats";
import type { StatusValue } from "@/lib/status";
import type { ComparisonDetail, FixTimelineItem } from "@/types/comparison";

function Visibility({ item }: { item: FixTimelineItem }) {
  if (!item.completed) return <p className="mt-1 text-helper text-fg-subtle">Not completed. No visibility change is shown.</p>;
  if (!item.before || !item.after) return <p className="mt-1 text-helper text-fg-subtle">No monitoring run on both sides of this task.</p>;
  const change = pointChange(item.before.rate, item.after.rate);
  return (
    <div className="mt-1.5 flex flex-col gap-0.5 rounded-control border border-line bg-surface-2 px-2.5 py-2">
      <p className="tnum flex flex-wrap items-center gap-x-2 text-helper text-fg-muted">
        <span>Mention rate, whole run</span>
        <span className="text-fg">{item.before.rate.n} of {item.before.rate.d}</span>
        <span aria-hidden="true">→</span>
        <span className="sr-only">to</span>
        <span className="text-fg">{item.after.rate.n} of {item.after.rate.d}</span>
        <span>{formatPoints(change)}</span>
      </p>
      <p className="text-helper text-fg-subtle">Runs {item.before.runId} ({formatShortDate(item.before.date)}) and {item.after.runId} ({formatShortDate(item.after.date)})</p>
    </div>
  );
}

/** Fixes placed by their completion date, each linked to its finding, task and verification. Context only, never a cause. */
export function FixesView({ detail }: { detail: ComparisonDetail }) {
  const { fixes, rangeFrom, rangeTo, record, result } = detail;
  if (result.verdict === "not_comparable") return <NotComputed checks={result.checks} what="Fixes timeline" />;
  if (fixes.length === 0) return <EmptyState icon="fixes" title="No fixes in this period" description={`No task was completed or due between ${formatDate(rangeFrom)} and ${formatDate(rangeTo)}.`} />;
  const done = fixes.filter((f) => f.placedBy === "completed").length;

  return (
    <div className="flex flex-col gap-4">
      <Callout tone="info" title="Context, not cause. A change after a fix does not show the fix caused it." />
      <Card>
        <CardHeader title="Fixes" subtitle={`${done} completed of ${fixes.length}, placed by completion date. ${formatDate(rangeFrom)} to ${formatDate(rangeTo)}`} />
        <CardBody>
          <Timeline
            items={fixes.map((item) => ({
              id: item.taskId,
              icon: item.placedBy === "completed" ? "check-circle" : "clock",
              tone: item.placedBy === "completed" ? "success" : "neutral",
              time: `${item.placedBy === "completed" ? "Completed" : "Due"} ${formatShortDate(item.placedAt)}`,
              title: (
                <Link href={`/stores/${record.storeId}/fixes/tasks/${item.taskId}`} className="hover:underline">{item.title}</Link>
              ),
              meta: (
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Status kind="task" value={item.status as StatusValue<"task">} />
                    <Badge tone="neutral">{item.priority}</Badge>
                    {item.placedBy === "due" ? <Badge tone="neutral">Not completed</Badge> : null}
                  </div>
                  <EvidenceTrace
                    variant="compact"
                    ids={{ storeId: record.storeId, findingId: item.findingId, taskId: item.taskId, ...(item.verificationId ? { verificationId: item.verificationId } : {}), comparisonId: record.id, labels: { finding: item.findingTitle.length > 32 ? `${item.findingTitle.slice(0, 31)}…` : item.findingTitle } }}
                  />
                  <Visibility item={item} />
                </div>
              ),
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
