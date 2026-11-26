import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { WebsitesView } from "@/features/stores/websites-view";
import { listAlertHeadlines, listStores } from "@/services/core";
import { listWebsiteTasks } from "@/services/dashboard";

export const metadata: Metadata = { title: "Websites & Brands" };

export default async function WebsitesPage() {
  const [stores, alerts, tasks] = await Promise.all([listStores(), listAlertHeadlines(), listWebsiteTasks()]);
  return (
    <>
      <PageHeader title="Websites & Brands" />
      <WebsitesView stores={stores} alerts={alerts} tasks={tasks} />
    </>
  );
}
