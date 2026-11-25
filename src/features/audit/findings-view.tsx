import { EmptyState } from "@/components/ui/feedback";
import type { AuditDetail, AuditFinding, AuditTaskLink } from "@/types/audit";

import { FindingsTable } from "./findings-table";

/** Findings register of an audit snapshot. Findings exist only after the evaluation stage completed. */
export function FindingsView({ audit, findings, storeId, tasks }: { audit: AuditDetail; findings: AuditFinding[]; storeId: string; tasks: AuditTaskLink[] }) {
  if (audit.provisional || audit.status === "draft") {
    return <EmptyState icon="alert-circle" title="No findings yet" />;
  }
  if (audit.status === "cancelled" || audit.status === "failed" || audit.status === "blocked") {
    return <EmptyState icon="alert-circle" title="No findings for this audit" description="Ended before evaluation." />;
  }
  if (findings.length === 0) return <EmptyState icon="shield-check" title="No findings in this snapshot" />;
  return <FindingsTable findings={findings} storeId={storeId} tasks={tasks} />;
}
