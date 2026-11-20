import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { PortfolioView } from "@/features/stores/portfolio-view";
import { getOrgUsage, listAlertHeadlines, listStores } from "@/services/core";
import { listActivity, listPortfolioTasks } from "@/services/dashboard";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const [stores, alerts, usage, tasks, activity] = await Promise.all([listStores(), listAlertHeadlines(), getOrgUsage(), listPortfolioTasks(), listActivity()]);
  return (
    <>
      <PageHeader title="Portfolio" subtitle="Changes compare with each website's previous run" />
      <PortfolioView stores={stores} alerts={alerts} tasks={tasks} usage={usage} activity={activity} />
    </>
  );
}
