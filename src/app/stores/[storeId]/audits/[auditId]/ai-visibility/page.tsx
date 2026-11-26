import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { AiVisibilityView } from "@/features/audit/ai-visibility-view";
import { auditParams, getAiLane, getAudit, getAuditFindings } from "@/services/audit";

export const metadata: Metadata = { title: "AI visibility" };

export async function generateStaticParams() {
  return auditParams();
}

async function AiVisibilityPageContent(props: PageProps<"/stores/[storeId]/audits/[auditId]/ai-visibility">) {
  const { storeId, auditId } = await props.params;
  const [audit, lane, findings] = await Promise.all([getAudit(storeId, auditId), getAiLane(storeId, auditId), getAuditFindings(storeId, auditId)]);
  if (!audit) return null;
  return <AiVisibilityView audit={audit} lane={lane} findings={findings} />;
}

export default function AiVisibilityPage(props: PageProps<"/stores/[storeId]/audits/[auditId]/ai-visibility">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AiVisibilityPageContent {...props} />
    </Suspense>
  );
}
