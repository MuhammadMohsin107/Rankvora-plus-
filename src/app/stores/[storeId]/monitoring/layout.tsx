import { notFound } from "next/navigation";

import { MonitoringHeader } from "@/features/monitoring/monitoring-header";
import { getMonitoringHeader } from "@/services/monitoring";

export default async function MonitoringLayout({ children, params }: LayoutProps<"/stores/[storeId]/monitoring">) {
  const { storeId } = await params;
  const header = await getMonitoringHeader(storeId);
  if (!header) notFound();
  return (
    <>
      <MonitoringHeader data={header} />
      {children}
    </>
  );
}
