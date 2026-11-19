import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Callout } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { FindingsTable } from "@/features/audit/findings-table";
import { auditParams, getAudit, getAuditFindings } from "@/services/audit";

export const metadata: Metadata = { title: "Audit findings" };

export async function generateStaticParams() {
  return auditParams();
}

export default async function AuditFindingsPage(props: PageProps<"/stores/[storeId]/audits/[auditId]/findings">) {
  const { storeId, auditId } = await props.params;
  const [audit, findings] = await Promise.all([getAudit(storeId, auditId), getAuditFindings(storeId, auditId)]);
  if (!audit) notFound();

  if (audit.provisional) {
    return <EmptyState icon="alert-circle" title="No findings yet" description="Findings are created after the evaluation stage, which starts when the crawl finishes." />;
  }
  if (findings.length === 0) {
    return <EmptyState icon="shield-check" title="No findings in this snapshot" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Callout tone="neutral">
        Findings register at snapshot {audit.snapshotId}: {findings.length} findings. Statuses shown are current, not as of the snapshot.
      </Callout>
      <FindingsTable findings={findings} storeId={storeId} />
    </div>
  );
}
