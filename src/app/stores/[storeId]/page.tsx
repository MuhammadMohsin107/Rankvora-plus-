import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { DashboardView } from "@/features/stores/dashboard/dashboard-view";
import { UntrackedDashboard } from "@/features/stores/local-website";
import { isLocalWebsiteId } from "@/features/stores/website-model";
import { getStore, storeIds } from "@/services/core";
import { getDashboardData } from "@/services/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export async function generateStaticParams() {
  return storeIds();
}

async function DashboardPageContent(props: PageProps<"/stores/[storeId]">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  // Websites created in this browser are drawn by the layout's client gate.
  if (!store) return isLocalWebsiteId(storeId) ? null : notFound();

  const data = store.summary ? await getDashboardData(store.id) : null;
  if (!data) return <UntrackedDashboard store={store} />;
  return (
    <>
      <PageHeader title="Dashboard" />
      <DashboardView store={store} data={data} />
    </>
  );
}

export default function DashboardPage(props: PageProps<"/stores/[storeId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <DashboardPageContent {...props} />
    </Suspense>
  );
}
