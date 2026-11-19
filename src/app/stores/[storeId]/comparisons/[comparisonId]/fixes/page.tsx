import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Status } from "@/components/ui/badge";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Mono, Timeline } from "@/components/ui/misc";
import { formatDate, formatPoints, formatShortDate } from "@/lib/format";
import { pointChange } from "@/lib/stats";
import type { StatusValue } from "@/lib/status";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";
import type { FixTimelineItem } from "@/types/comparison";

export const metadata: Metadata = { title: "Comparison fixes timeline" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

function Visibility({ item }: { item: FixTimelineItem }) {
  if (!item.completed) return <p className="mt-1 text-xs text-fg-subtle">Not completed. No visibility change is shown for it.</p>;
  if (!item.before || !item.after) return <p className="mt-1 text-xs text-fg-subtle">No monitoring run on both sides of this task.</p>;
  const change = pointChange(item.before.rate, item.after.rate);
  return (
    <div className="mt-1.5 flex flex-col gap-1 rounded-control border border-line bg-surface-2/50 px-2.5 py-2">
      <p className="text-xs font-medium text-fg">Visibility changed after this task was completed</p>
      <p className="tnum flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
        <span>Mention rate, whole run</span>
        <span className="text-fg">{item.before.rate.n} / {item.before.rate.d}</span>
        <span aria-hidden="true">→</span>
        <span className="sr-only">to</span>
        <span className="text-fg">{item.after.rate.n} / {item.after.rate.d}</span>
        <span>{formatPoints(change)}</span>
      </p>
      <p className="text-xs text-fg-subtle">Runs {item.before.runId} ({formatShortDate(item.before.date)}) and {item.after.runId} ({formatShortDate(item.after.date)}). Context only, not a cause.</p>
    </div>
  );
}

export default async function ComparisonFixesPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/fixes">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { fixes, rangeFrom, rangeTo } = detail;

  return (
    <div className="flex flex-col gap-5">
      <Callout tone="info" title="Context, not cause">
        Tasks due between {formatDate(rangeFrom)} and {formatDate(rangeTo)}. Visibility changed after a task was completed does not show the task caused it.
      </Callout>

      {fixes.length === 0 ? (
        <EmptyState icon="fixes" title="No tasks in this period" description="No fix task has a due date between the two sources." />
      ) : (
        <Card>
          <CardHeader title="Fix tasks" subtitle={`${fixes.filter((f) => f.completed).length} completed · ${fixes.length} in range`} info="Completion times are not recorded yet, so tasks are placed by due date. Completed means applied or later." />
          <CardBody>
            <Timeline
              items={fixes.map((item) => ({
                id: item.taskId,
                icon: item.completed ? "check-circle" : "clock",
                tone: item.completed ? "success" : "neutral",
                time: item.dueAt ? `Due ${formatShortDate(item.dueAt)}` : undefined,
                title: (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Mono>{item.taskId}</Mono>
                    <Link href={`/stores/${storeId}/fixes/tasks/${item.taskId}`} className="hover:underline">{item.title}</Link>
                  </span>
                ),
                meta: (
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Status kind="task" value={item.status as StatusValue<"task">} />
                      <Badge tone="neutral">{item.priority}</Badge>
                    </div>
                    <Visibility item={item} />
                  </div>
                ),
              }))}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
