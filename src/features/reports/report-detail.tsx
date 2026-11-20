"use client";

import { useMemo, useSyncExternalStore } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { simulatedToast } from "@/demo-state";
import { ReportExportMenu } from "@/features/reports/export-actions";
import { GeneratingState, type GeneratingProgress } from "@/features/reports/generating-state";
import { ReportStatusBadge, ReportTypeBadge } from "@/features/reports/report-parts";
import { generationProgress, useNow, useReports } from "@/features/reports/report-state";
import { ReportView } from "@/features/reports/report-view";
import type { ReportDocument, ReportRow } from "@/types/shared-records";

const subscribe = () => () => {};

/** True after hydration. Local reports live in this browser, so "not found" may only be said once they were read. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export type ReportDetailProps = {
  storeId: string;
  reportId: string;
  /** The seeded row, or null when the id is not in the static data (it may exist in this browser). */
  seeded: ReportRow | null;
  /** Documents by `type:sourceId`. Seeded pages pass their own; other ids get every source of the website. */
  documents: Record<string, ReportDocument>;
  /** Source progress of a seeded report that waits on its audit. */
  progress?: GeneratingProgress | null;
};

/** One report: generating (simulated progress), failed (retry) or ready (document, exports). */
export function ReportDetail({ storeId, reportId, seeded, documents, progress }: ReportDetailProps) {
  const toast = useToast();
  const hydrated = useHydrated();
  const base = useMemo(() => (seeded ? [seeded] : []), [seeded]);
  const api = useReports(storeId, base);
  const row = api.rows.find((r) => r.id === reportId);
  const generating = row?.status === "generating" && Boolean(row.readyAt);
  const now = useNow(generating);

  if (!row) {
    if (!hydrated) {
      return (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      );
    }
    return (
      <>
        <PageHeader title="Report not found" />
        <EmptyState icon="reports" title="This report is not in this browser" description="Reports you generate are kept in this browser only." action={<ButtonLink href={`/stores/${storeId}/reports`} variant="primary">All reports</ButtonLink>} />
      </>
    );
  }

  const source = documents[`${row.type}:${row.sourceId}`];
  const doc: ReportDocument | null = source ? { ...source, title: row.title, period: row.period, version: row.version, generatedAt: row.createdAt } : null;
  const header = (
    <PageHeader
      title={row.title}
      subtitle={`${row.period} · ${row.version}`}
      meta={
        <>
          <ReportTypeBadge type={row.type} />
          <ReportStatusBadge status={row.status} />
          {row.archived ? <Badge tone="neutral">Archived</Badge> : null}
        </>
      }
    />
  );

  if (row.status === "generating") {
    const fraction = generating && now > 0 ? generationProgress(row, now) : generating ? 0 : null;
    return (
      <>
        {header}
        <GeneratingState report={row} progress={progress} fraction={fraction} />
      </>
    );
  }

  if (row.status === "failed" || !doc) {
    return (
      <>
        {header}
        <ErrorState
          title="The report could not be generated"
          detail="The source data is intact. Retry to build it again."
          action={
            doc ? (
              <Button icon="refresh" onClick={() => { api.retry(row.id); toast.push(simulatedToast("Report generation restarted")); }}>Retry</Button>
            ) : (
              <ButtonLink href={row.sourceHref} variant="secondary">Open source</ButtonLink>
            )
          }
        />
      </>
    );
  }

  return (
    <>
      <HeaderAction>
        <ReportExportMenu reportId={row.id} doc={doc} />
      </HeaderAction>
      {header}
      <ReportView doc={doc} />
    </>
  );
}
