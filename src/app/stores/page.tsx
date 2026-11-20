import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { WebsitesView } from "@/features/stores/websites-view";
import { listAlertHeadlines, listStores } from "@/services/core";
import { listPortfolioTasks } from "@/services/dashboard";

export const metadata: Metadata = { title: "Websites & Brands" };

export default async function WebsitesPage() {
  const [stores, alerts, tasks] = await Promise.all([listStores(), listAlertHeadlines(), listPortfolioTasks()]);
  return (
    <>
      <PageHeader title="Websites & Brands" />
      <WebsitesView stores={stores} alerts={alerts} tasks={tasks} />
    </>
  );
}
