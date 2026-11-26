import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { OverviewView } from "@/features/audit/overview-view";
import { SeededProgress } from "@/features/audit/seeded-progress";
import { channelLabel } from "@/lib/labels";
import { auditParams, getAudit, getLaneSummary, listAuditRows } from "@/services/audit";
import { listStoreChannels } from "@/services/core";

export const metadata: Metadata = { title: "Audit overview" };

export async function generateStaticParams() {
  return auditParams();
}

async function AuditOverviewPageContent(props: PageProps<"/stores/[storeId]/audits/[auditId]">) {
  const { storeId, auditId } = await props.params;
  const [audit, summary, channels, rows] = await Promise.all([getAudit(storeId, auditId), getLaneSummary(storeId, auditId), listStoreChannels(storeId), listAuditRows(storeId)]);
  // Audits that are not prerendered are drawn by the layout in the browser.
  if (!audit || !summary) return null;

  if (audit.provisional) {
    const row = rows.find((r) => r.id === auditId);
    const current = audit.progress ? channels.find((c) => audit.progress?.current.provider.startsWith(c.providerLabel)) : undefined;
    return row ? <SeededProgress storeId={storeId} row={row} audit={audit} channelLabelText={current ? channelLabel(current) : ""} /> : null;
  }
  return <OverviewView audit={audit} summary={summary} storeId={storeId} />;
}

export default function AuditOverviewPage(props: PageProps<"/stores/[storeId]/audits/[auditId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuditOverviewPageContent {...props} />
    </Suspense>
  );
}
