import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "../ui/icon";
import { Skeleton } from "../ui/feedback";

type FrameProps = { height?: number; className?: string };

/** Loading placeholder shaped like a chart: reserves the space so nothing jumps when data arrives. */
export function ChartSkeleton({ height = 230, className }: FrameProps) {
  return (
    <div aria-busy="true" aria-label="Loading chart" role="status" className={cn("flex flex-col gap-3", className)} style={{ height }}>
      <Skeleton className="h-3 w-40" />
      <div className="relative flex-1 overflow-hidden rounded-control">
        <div className="absolute inset-0 flex flex-col justify-between py-1" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-px w-full bg-grid" />
          ))}
        </div>
        <Skeleton className="absolute inset-x-0 bottom-0 h-1/2 opacity-60" />
      </div>
    </div>
  );
}

function Frame({ icon, title, detail, action, height, className, tone }: FrameProps & { icon: IconName; title: string; detail?: string; action?: ReactNode; tone: "neutral" | "danger" }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      style={{ minHeight: height }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-control border border-dashed px-6 py-5 text-center",
        tone === "danger" ? "border-danger/30 bg-danger-soft" : "border-line-strong bg-surface-2",
        className,
      )}
    >
      <Icon name={icon} size={20} className={tone === "danger" ? "text-danger-icon" : "text-fg-faint"} />
      <p className="text-body font-semibold text-fg">{title}</p>
      {detail ? <p className="max-w-sm text-body-sm text-fg-muted">{detail}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** No data yet, or not enough points. Say why and offer one next step. Never draw an empty axis as zero. */
export function ChartEmpty({ title = "No data yet", detail, action, height = 230, className }: FrameProps & { title?: string; detail?: string; action?: ReactNode }) {
  return <Frame tone="neutral" icon="monitoring" title={title} detail={detail} action={action} height={height} className={className} />;
}

/** The data could not be loaded. A failed request is not a zero. */
export function ChartError({ title = "Chart unavailable", detail, action, height = 230, className }: FrameProps & { title?: string; detail?: string; action?: ReactNode }) {
  return <Frame tone="danger" icon="alert-circle" title={title} detail={detail} action={action} height={height} className={className} />;
}
