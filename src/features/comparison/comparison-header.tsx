"use client";

import { useRouter } from "next/navigation";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { LinkTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { TYPE_NAME } from "@/features/comparison/definition";
import type { ExportBundle } from "@/features/comparison/export";
import { useComparisonState } from "@/features/comparison/use-comparison-state";
import { downloadText } from "@/features/reports/download";
import { ExportActions } from "@/features/reports/export-actions";
import { formatDate } from "@/lib/format";
import type { ComparisonRecord } from "@/types/comparison";

export type ComparisonTab = { href: string; label: string; count?: number; exact?: boolean };

type Props = {
  storeId: string;
  /** The record the server computed. Local changes (title, author, archive, report) overlay it. */
  record: ComparisonRecord;
  /** True for comparisons from the seeded demo data. */
  seeded: boolean;
  baselineLabel: string;
  currentLabel: string;
  period: string;
  exports: ExportBundle | null;
  tabs: ComparisonTab[];
};

/**
 * Title, status, the page's one primary action (the shared Export menu, in the global header), a More menu
 * (row-level CSV, Reports, archive) and the tabs.
 */
export function ComparisonHeader({ storeId, record, seeded, baselineLabel, currentLabel, period, exports, tabs }: Props) {
  const router = useRouter();
  const toast = useToast();
  const state = useComparisonState(storeId, seeded ? [record] : []);
  const local = state.rows.find((r) => r.id === record.id);
  const effective: ComparisonRecord = local ? { ...record, ...local, comparability: record.comparability, status: record.status, matched: record.matched } : record;

  const more: MenuItem[] = [
    ...(exports
      ? [
          {
            label: "Row-level CSV",
            icon: "download" as const,
            onSelect: () => {
              downloadText(`${exports.fileBase}-rows.csv`, "text/csv", exports.rowCsv);
              toast.push({ title: `Downloaded ${exports.fileBase}-rows.csv`, tone: "success" as const });
            },
          },
        ]
      : []),
    effective.reportId
      ? { label: "Open in Reports", icon: "reports" as const, href: `/stores/${storeId}/reports/${effective.reportId}` }
      : { label: "Add to Reports", icon: "reports" as const, onSelect: () => router.push(`/stores/${storeId}/reports/${state.generateReport(effective, period)}`) },
    { type: "separator" },
    effective.archived
      ? { label: "Restore", icon: "refresh" as const, onSelect: () => state.setArchived(effective, false) }
      : { label: "Archive", icon: "minus-circle" as const, onSelect: () => state.setArchived(effective, true) },
  ];

  return (
    <>
      {exports ? (
        <HeaderAction>
          <ExportActions baseName={exports.fileBase} csv={exports.aggregateCsv} json={exports.json} html={exports.html} title={effective.title} />
        </HeaderAction>
      ) : null}
      <PageHeader
        title={effective.title}
        subtitle={`${TYPE_NAME[effective.type]} · ${formatDate(effective.createdAt)} · ${effective.createdBy}`}
        meta={
          <span className="flex items-center gap-2">
            <Status kind="comparability" value={record.comparability} />
            {effective.archived ? <Badge tone="neutral" icon="minus-circle">Archived</Badge> : null}
          </span>
        }
        actions={<Menu align="end" label="More actions" trigger={<IconButton icon="more" label="More actions" variant="secondary" />} items={more} width={220} />}
        tabs={
          <>
            <p className="text-body-sm text-fg-muted">
              <span className="text-fg-subtle">Baseline</span> {baselineLabel} <span aria-hidden="true">→</span><span className="sr-only">to</span> <span className="text-fg-subtle">Current</span> {currentLabel}
            </p>
            <LinkTabs label="Comparison sections" items={tabs} />
          </>
        }
      />
      {effective.archived ? <Callout tone="info" title="Archived. History is kept. Restore it to bring it back to the list." className="mb-4" /> : null}
    </>
  );
}
