import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { FindingsView } from "@/features/audit/findings-view";
import { auditParams, getAudit, getAuditFindings, listAuditTasks } from "@/services/audit";

export const metadata: Metadata = { title: "Audit findings" };

export async function generateStaticParams() {
  return auditParams();
}

async function AuditFindingsPageContent(props: PageProps<"/stores/[storeId]/audits/[auditId]/findings">) {
  const { storeId, auditId } = await props.params;
  const [audit, findings, tasks] = await Promise.all([getAudit(storeId, auditId), getAuditFindings(storeId, auditId), listAuditTasks(storeId, auditId)]);
  if (!audit) return null;
  return <FindingsView audit={audit} findings={findings} storeId={storeId} tasks={tasks} />;
}

export default function AuditFindingsPage(props: PageProps<"/stores/[storeId]/audits/[auditId]/findings">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuditFindingsPageContent {...props} />
    </Suspense>
  );
}
