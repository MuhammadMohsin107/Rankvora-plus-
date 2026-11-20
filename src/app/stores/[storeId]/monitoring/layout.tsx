import { Suspense } from "react";

import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { MonitoringHeader } from "@/features/monitoring/monitoring-header";
import { RunNowHost } from "@/features/monitoring/run-now-dialog";
import { MonitoringProvider } from "@/features/monitoring/state";
import { getMonitoringShell } from "@/services/monitoring";

async function MonitoringLayoutContent({ children, params }: LayoutProps<"/stores/[storeId]/monitoring">) {
  const { storeId } = await params;
  const data = await getMonitoringShell(storeId);
  if (!data) notFound();
  return (
    <MonitoringProvider data={data}>
      <MonitoringHeader />
      <RunNowHost />
      {children}
    </MonitoringProvider>
  );
}

export default function MonitoringLayout(props: LayoutProps<"/stores/[storeId]/monitoring">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <MonitoringLayoutContent {...props} />
    </Suspense>
  );
}
