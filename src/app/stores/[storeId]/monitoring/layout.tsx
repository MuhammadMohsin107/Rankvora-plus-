import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import { notFound } from "next/navigation";

import { MonitoringHeader } from "@/features/monitoring/monitoring-header";
import { getMonitoringHeader } from "@/services/monitoring";

async function MonitoringLayoutContent({ children, params }: LayoutProps<"/stores/[storeId]/monitoring">) {
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

export default function MonitoringLayout(props: LayoutProps<"/stores/[storeId]/monitoring">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <MonitoringLayoutContent {...props} />
    </Suspense>
  );
}
