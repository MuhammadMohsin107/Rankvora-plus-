import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { NewComparisonWizard } from "@/features/comparison/wizard";
import { getWizardData, wizardCatalog } from "@/services/comparison";
import { getStore, storeIds } from "@/services/core";

export const metadata: Metadata = { title: "New comparison" };

export async function generateStaticParams() {
  return storeIds();
}

export default async function NewComparisonPage(props: PageProps<"/stores/[storeId]/comparisons/new">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const data = await getWizardData(storeId);
  if (!data) notFound();

  const header = (
    <PageHeader
      title="New comparison"
      subtitle={store.name}
      breadcrumb={[{ label: "Comparisons", href: `/stores/${storeId}/comparisons` }, { label: "New" }]}
    />
  );

  if (data.snapshots.length < 2) {
    return (
      <>
        {header}
        <EmptyState
          icon="compare"
          title="Two snapshots needed"
          description="Run an audit or a monitoring run first. Then compare it with another snapshot."
          action={<ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <NewComparisonWizard storeId={storeId} data={data} catalog={wizardCatalog()} />
    </>
  );
}
