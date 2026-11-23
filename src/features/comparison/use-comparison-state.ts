"use client";

/**
 * Local (demo-state) behaviour of Comparison: create, archive, restore, generate report.
 * Everything is stored in this browser and labelled simulated; nothing is sent anywhere.
 * Rows carry `storeId`, so the shell and search can place them under the right website.
 */
import { useCallback, useMemo } from "react";

import { useToast } from "@/components/ui/toast";
import { demoNow, simulatedToast, useDemoCollection } from "@/demo-state";
import { encodeDefinition } from "@/features/comparison/definition";
import type { ComparisonDefinition, ComparisonRecord, ReportRecord } from "@/types/comparison";

const NO_REPORTS: ReportRecord[] = [];

export type CreateInput = {
  definition: ComparisonDefinition;
  title: string;
  comparability: ComparisonRecord["comparability"];
  status: ComparisonRecord["status"];
  matched: ComparisonRecord["matched"];
  methodologyVersion: string;
  createdBy: string;
};

export function useComparisonState(storeId: string, baseRows: ComparisonRecord[]) {
  const toast = useToast();
  const comparisons = useDemoCollection<ComparisonRecord>("comparisons", baseRows);
  const reports = useDemoCollection<ReportRecord>("reports", NO_REPORTS);
  const { update: updateComparison, create: createComparison } = comparisons;
  const { create: createReport } = reports;
  const push = toast.push;

  // A comparison's report may have been generated in Reports, so look it up there too (one report, one link, no duplicates).
  const rows = useMemo(
    () =>
      comparisons.rows
        .filter((r) => r.storeId === storeId)
        .map((r) => (r.reportId ? r : { ...r, reportId: reports.rows.find((x) => x.type === "comparison" && x.sourceId === r.id && x.storeId === storeId)?.id ?? null })),
    [comparisons.rows, reports.rows, storeId],
  );

  /** Saves a finished comparison. Returns the id; the same definition always gives the same id. */
  const create = useCallback(
    (input: CreateInput): { id: string; existed: boolean } => {
      const id = encodeDefinition(input.definition);
      if (comparisons.rows.some((r) => r.id === id)) return { id, existed: true };
      const { definition } = input;
      createComparison(
        {
          id,
          storeId,
          title: input.title,
          type: definition.type,
          baseline: definition.baseline,
          current: definition.current,
          filters: definition.filters,
          aggregation: definition.aggregation,
          ...(definition.taskId ? { taskId: definition.taskId } : {}),
          status: input.status,
          comparability: input.comparability,
          createdAt: demoNow(),
          createdBy: input.createdBy,
          methodologyVersion: input.methodologyVersion,
          reportId: null,
          archived: false,
          matched: input.matched,
        },
        { kind: "comparison.created", label: `Comparison created: ${input.title}`, refs: { comparisonId: id, websiteId: storeId } },
      );
      return { id, existed: false };
    },
    [comparisons.rows, createComparison, storeId],
  );

  /**
   * Archive keeps the comparison and its history; Restore brings it back. A comparison opened from a link
   * (not yet stored in this browser) is stored first, so the change is not lost.
   */
  const setArchived = useCallback(
    (record: ComparisonRecord, archived: boolean) => {
      const event = { kind: "comparison.archived" as const, label: archived ? `Comparison archived: ${record.title}` : `Comparison restored: ${record.title}`, refs: { comparisonId: record.id, websiteId: storeId } };
      if (comparisons.rows.some((r) => r.id === record.id)) updateComparison(record.id, { archived }, event);
      else createComparison({ ...record, archived, createdAt: demoNow() }, event);
      push(simulatedToast(archived ? "comparison.archived" : "Comparison restored"));
    },
    [comparisons.rows, updateComparison, createComparison, push, storeId],
  );

  /** Adds a ready report record to the reports collection and links it to the comparison. */
  const generateReport = useCallback(
    (record: ComparisonRecord, period: string): string => {
      const created = createReport(
        {
          storeId,
          type: "comparison",
          title: record.title,
          sourceId: record.id,
          period,
          createdAt: demoNow(),
          version: `Methodology ${record.methodologyVersion}`,
          status: "ready",
          sourceHref: `/stores/${storeId}/comparisons/${record.id}`,
          sourceLabel: record.title,
        },
        (row) => ({ kind: "report.generated", label: `Report generated: ${record.title}`, refs: { comparisonId: record.id, reportId: row.id, websiteId: storeId } }),
      );
      if (comparisons.rows.some((r) => r.id === record.id)) updateComparison(record.id, { reportId: created.id });
      else createComparison({ ...record, reportId: created.id, createdAt: demoNow() });
      push(simulatedToast("report.generated"));
      return created.id;
    },
    [comparisons.rows, createReport, createComparison, updateComparison, push, storeId],
  );

  return { rows, create, setArchived, generateReport };
}
