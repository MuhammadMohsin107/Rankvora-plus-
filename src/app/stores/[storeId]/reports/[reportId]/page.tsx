import { Suspense } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { ReportDetail } from "@/features/reports/report-detail";
import { getStore } from "@/services/core";
import { getGeneratingProgress, getReport, getReportDocument, getReportDocuments, reportDocumentKey, reportStaticParams } from "@/services/reports";

export const metadata: Metadata = { title: "Report" };

export async function generateStaticParams() {
  return reportStaticParams();
}

async function ReportPageContent(props: PageProps<"/stores/[storeId]/reports/[reportId]">) {
  const { storeId, reportId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const record = await getReport(storeId, reportId);
  if (!record) {
    // Not in the static data: it may be a report generated in this browser. The client resolves it from every source's document.
    return <ReportDetail storeId={storeId} reportId={reportId} seeded={null} documents={await getReportDocuments(storeId)} />;
  }

  const seeded = { ...record, storeId };
  const doc = record.status === "generating" ? null : await getReportDocument(storeId, record);
  const progress = record.status === "generating" ? await getGeneratingProgress(storeId, record) : null;
  return <ReportDetail storeId={storeId} reportId={reportId} seeded={seeded} documents={doc ? { [reportDocumentKey(record.type, record.sourceId)]: doc } : {}} progress={progress} />;
}

export default function ReportPage(props: PageProps<"/stores/[storeId]/reports/[reportId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ReportPageContent {...props} />
    </Suspense>
  );
}
