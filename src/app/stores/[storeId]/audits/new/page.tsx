import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { AuditWizard } from "@/features/audit/audit-wizard";
import { AuditSetupBlocked } from "@/features/audit/setup-blocked";
import { getWizardData } from "@/services/audit";
import { storeIds } from "@/services/core";

export const metadata: Metadata = { title: "Start audit" };

export async function generateStaticParams() {
  return storeIds();
}

async function NewAuditPageContent(props: PageProps<"/stores/[storeId]/audits/new">) {
  const { storeId } = await props.params;
  const data = await getWizardData(storeId);
  if (!data) notFound();

  const header = <PageHeader title="Start audit" />;

  // Blocked state: no AI channel is connected, so the wizard cannot be completed.
  if (data.channels.length === 0) {
    return (
      <>
        {header}
        <AuditSetupBlocked storeId={data.store.id} storeName={data.store.name} />
      </>
    );
  }

  return (
    <>
      {header}
      <AuditWizard data={data} />
    </>
  );
}

export default function NewAuditPage(props: PageProps<"/stores/[storeId]/audits/new">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewAuditPageContent {...props} />
    </Suspense>
  );
}
