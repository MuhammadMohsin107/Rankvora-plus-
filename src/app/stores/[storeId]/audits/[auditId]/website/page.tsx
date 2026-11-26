import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { WebsiteView } from "@/features/audit/website-view";
import { auditParams, getAudit, getWebsiteLane, listAudits } from "@/services/audit";

export const metadata: Metadata = { title: "Website readiness" };

export async function generateStaticParams() {
  return auditParams();
}

async function WebsiteReadinessPageContent(props: PageProps<"/stores/[storeId]/audits/[auditId]/website">) {
  const { storeId, auditId } = await props.params;
  const [audit, lane, audits] = await Promise.all([getAudit(storeId, auditId), getWebsiteLane(storeId, auditId), listAudits(storeId)]);
  if (!audit) return null;
  const other = audits.find((a) => !a.provisional && a.lanes.includes("website_readiness") && a.id !== auditId && a.snapshotId) ?? null;
  return <WebsiteView audit={audit} lane={lane} storeId={storeId} otherWithWebsite={other} />;
}

export default function WebsiteReadinessPage(props: PageProps<"/stores/[storeId]/audits/[auditId]/website">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <WebsiteReadinessPageContent {...props} />
    </Suspense>
  );
}
