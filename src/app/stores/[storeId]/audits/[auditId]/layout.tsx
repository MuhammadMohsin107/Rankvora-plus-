import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import { AuditHeader } from "@/features/audit/audit-header";
import { LocalAuditShell } from "@/features/audit/local-audit-shell";
import { channelLabel } from "@/lib/labels";
import { auditParams, getAudit, getAuditBasis, getAuditFindings, getExtraAuditRow, listAuditRows } from "@/services/audit";
import { listStoreChannels } from "@/services/core";

export async function generateStaticParams() {
  return auditParams();
}

async function AuditLayoutContent({ children, params }: LayoutProps<"/stores/[storeId]/audits/[auditId]">) {
  const { storeId, auditId } = await params;
  const [audit, channels] = await Promise.all([getAudit(storeId, auditId), listStoreChannels(storeId)]);
  const channelOptions = channels.map((c) => ({ id: c.id, label: channelLabel(c) }));

  // Not a prerendered audit: an extra demonstration audit or one created in this browser. Rendered in the browser,
  // so ids made locally do not need a prerendered page.
  if (!audit) {
    const [basis, extra, rows] = await Promise.all([getAuditBasis(storeId), getExtraAuditRow(storeId, auditId), listAuditRows(storeId)]);
    const otherWithWebsite = rows.find((r) => !r.provisional && r.lanes.includes("website_readiness") && r.id !== auditId);
    return <LocalAuditShell storeId={storeId} auditId={auditId} basis={basis} seed={extra} channels={channelOptions} otherWithWebsite={otherWithWebsite ? { id: otherWithWebsite.id, title: otherWithWebsite.title } : null} />;
  }

  const [findings, rows] = await Promise.all([getAuditFindings(storeId, auditId), listAuditRows(storeId)]);
  const seed = rows.find((r) => r.id === auditId) ?? null;
  return (
    <>
      <AuditHeader storeId={storeId} auditId={auditId} seed={seed} config={audit.config} channels={channelOptions} findingsCount={audit.provisional ? null : findings.length} />
      {children}
    </>
  );
}

export default function AuditLayout(props: LayoutProps<"/stores/[storeId]/audits/[auditId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuditLayoutContent {...props} />
    </Suspense>
  );
}
