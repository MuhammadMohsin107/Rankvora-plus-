import { Badge } from "@/components/ui/badge";
import type { ReportKind, ReportState } from "@/types/shared-records";

export function ReportStatusBadge({ status }: { status: ReportState }) {
  if (status === "ready") return <Badge tone="success" icon="check-circle">Ready</Badge>;
  if (status === "generating") return <Badge tone="accent" icon="loader">Generating</Badge>;
  return <Badge tone="danger" icon="x-circle">Failed</Badge>;
}

const typeMeta = {
  audit: { label: "Audit", icon: "audit" },
  monitoring: { label: "Monitoring", icon: "monitoring" },
  comparison: { label: "Comparison", icon: "compare" },
} as const;

export function ReportTypeBadge({ type }: { type: ReportKind }) {
  return <Badge tone="neutral" icon={typeMeta[type].icon}>{typeMeta[type].label}</Badge>;
}

export const reportTypeLabel = (type: ReportKind) => typeMeta[type].label;
