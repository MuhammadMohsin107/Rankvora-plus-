import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { AuditWizard } from "@/features/audit/audit-wizard";
import { getWizardData } from "@/services/audit";
import { storeIds } from "@/services/core";

export const metadata: Metadata = { title: "Start audit" };

export async function generateStaticParams() {
  return storeIds();
}

export default async function NewAuditPage(props: PageProps<"/stores/[storeId]/audits/new">) {
  const { storeId } = await props.params;
  const data = await getWizardData(storeId);
  if (!data) notFound();

  const header = <PageHeader title="Start audit" subtitle={`${data.store.name} · ${data.store.domain}`} breadcrumb={[{ label: "Audits", href: `/stores/${storeId}/audits` }, { label: "New" }]} />;

  const activePrompts = data.prompts.filter((p) => p.status === "active").length;
  if (activePrompts === 0) {
    return (
      <>
        {header}
        <EmptyState icon="prompts" title="No active prompts" description="An audit asks AI providers your prompts. Add one first." action={<ButtonLink href={`/stores/${storeId}/prompts/new`} variant="primary" icon="plus">Create a prompt</ButtonLink>} />
      </>
    );
  }
  if (data.channels.length === 0) {
    return (
      <>
        {header}
        <EmptyState icon="plug" title="No AI channels" description="Choose at least one provider channel for this store." action={<ButtonLink href={`/stores/${storeId}/settings`} variant="primary">Open store settings</ButtonLink>} />
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
