import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { ReportView } from "@/features/audit/report-view";
import { DEMO_NOW } from "@/lib/format";
import { getStore } from "@/services/core";
import { auditParams, getAiLane, getAudit, getAuditFindings, getWebsiteLane, listAuditTasks } from "@/services/audit";

export const metadata: Metadata = { title: "Audit report" };

export async function generateStaticParams() {
  return auditParams();
}

async function AuditReportPageContent(props: PageProps<"/stores/[storeId]/audits/[auditId]/report">) {
  const { storeId, auditId } = await props.params;
  const [audit, ai, web, findings, tasks, store] = await Promise.all([
    getAudit(storeId, auditId),
    getAiLane(storeId, auditId),
    getWebsiteLane(storeId, auditId),
    getAuditFindings(storeId, auditId),
    listAuditTasks(storeId, auditId),
    getStore(storeId),
  ]);
  if (!audit) return null;
  const hasWebsite = audit.lanes.includes("website_readiness");
  return (
    <ReportView
      storeId={storeId}
      data={{ audit, ai: audit.lanes.includes("ai_visibility") ? ai : null, web: hasWebsite ? web : null, findings, tasks, websiteName: store?.domain ?? storeId, simulated: false, generatedAt: audit.completedAt ?? DEMO_NOW }}
    />
  );
}

export default function AuditReportPage(props: PageProps<"/stores/[storeId]/audits/[auditId]/report">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuditReportPageContent {...props} />
    </Suspense>
  );
}
