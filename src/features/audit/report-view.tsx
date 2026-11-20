"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { SimulatedBadge } from "@/components/ui/demo";
import { EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useDemoSettings } from "@/demo-state";
import { ExportActions } from "@/features/reports/export-actions";
import { formatDateTime } from "@/lib/format";

import { buildCsv, buildHtml, buildJson, reportBaseName, type AuditReportData } from "./export";

type Regenerated = { at: string | null };
const NOT_REGENERATED: Regenerated = { at: null };

/**
 * Report tab: a real HTML preview of the audit, with the shared export menu (preview, HTML, CSV, JSON, print) built
 * in the browser from the data on the other tabs. Formal generated reports live in the Reports module.
 */
export function ReportView({ data, storeId }: { data: AuditReportData; storeId: string }) {
  const toast = useToast();
  const { audit } = data;
  const regenerated = useDemoSettings<Regenerated>(`audit.report.${audit.id}`, NOT_REGENERATED);
  const [generating, setGenerating] = useState(false);

  if (!audit.snapshotId) {
    const running = audit.provisional || audit.status === "draft";
    return (
      <EmptyState
        icon="reports"
        title={running ? "The report is created when the audit completes" : "No report for this audit"}
        description={running ? undefined : `${audit.status === "cancelled" ? "Cancelled" : audit.status === "draft" ? "Draft" : "Blocked or failed"} audits have no snapshot, so there is nothing to export.`}
      />
    );
  }

  const failed = audit.reportStatus === "failed" && !regenerated.value.at;
  const html = buildHtml(data);
  const regenerate = () => {
    setGenerating(true);
    window.setTimeout(() => {
      regenerated.save({ at: new Date().toISOString() }, { kind: "report.generated", label: "Audit report regenerated", refs: { auditId: audit.id, websiteId: storeId } });
      setGenerating(false);
      toast.push({ title: "Report regenerated (simulated)", description: `Snapshot ${audit.snapshotId} is unchanged.`, tone: "success" });
    }, 1800);
  };

  return (
    <div className="flex flex-col gap-4">
      {failed ? (
        <Callout tone="danger" title="The formatted report failed to generate" actions={<Button icon="refresh" loading={generating} onClick={regenerate}>Regenerate</Button>}>
          The preview and exports below are built from the immutable snapshot, so they are complete.
        </Callout>
      ) : null}
      <Card as="section">
        <CardHeader
          title="Report preview"
          subtitle={`${audit.snapshotId} · generated ${formatDateTime(regenerated.value.at ?? data.generatedAt)} UTC`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {data.simulated ? <SimulatedBadge /> : <Badge tone="neutral">Demo data</Badge>}
              <ExportActions baseName={reportBaseName(data)} csv={() => buildCsv(data)} json={() => buildJson(data)} html={html} title={audit.title} />
              <ButtonLink href={`/stores/${storeId}/reports`} variant="ghost" trailingIcon="arrow-right">All reports</ButtonLink>
            </div>
          }
        />
        <CardBody>
          <iframe title="Audit report preview" srcDoc={html} sandbox="allow-same-origin" className="h-[640px] w-full rounded-control border border-line bg-white" />
        </CardBody>
      </Card>
    </div>
  );
}
