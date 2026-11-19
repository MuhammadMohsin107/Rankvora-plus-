"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { Mono } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { downloadText } from "@/features/reports/download";

type Revision = { id: string; note: string; meta: string };

type ExportPanelProps = {
  comparisonId: string;
  methodologyVersion: string;
  analysisVersion: string;
  matching: string;
  aggregation: string;
  sources: { label: string; runs: string[] }[];
  rowCsv: string;
  aggregateCsv: string;
  json: string;
  createdBy: string;
  createdAtLabel: string;
};

export function ExportPanel({ comparisonId, methodologyVersion, analysisVersion, matching, aggregation, sources, rowCsv, aggregateCsv, json, createdBy, createdAtLabel }: ExportPanelProps) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([{ id: "r1", note: "Original result", meta: `${createdAtLabel} · ${createdBy}` }]);

  const files: { id: string; title: string; description: string; icon: IconName; action: string; run: () => void }[] = [
    {
      id: "rows",
      title: "Row-level CSV",
      description: "Every slot: matched, unmatched and excluded, with reasons.",
      icon: "list",
      action: "Download",
      run: () => {
        downloadText(`${comparisonId}-rows.csv`, "text/csv", rowCsv);
        toast.push({ title: "Row-level CSV exported", description: `${comparisonId}-rows.csv`, tone: "success" });
      },
    },
    {
      id: "aggregate",
      title: "Aggregate CSV",
      description: "Each metric with numerator, denominator, changes and intervals.",
      icon: "database",
      action: "Download",
      run: () => {
        downloadText(`${comparisonId}-aggregate.csv`, "text/csv", aggregateCsv);
        toast.push({ title: "Aggregate CSV exported", description: `${comparisonId}-aggregate.csv`, tone: "success" });
      },
    },
    {
      id: "json",
      title: "JSON",
      description: "Verdict, checks and metrics as structured data.",
      icon: "code",
      action: "Download",
      run: () => {
        downloadText(`${comparisonId}.json`, "application/json", json);
        toast.push({ title: "JSON exported", description: `${comparisonId}.json`, tone: "success" });
      },
    },
    {
      id: "pdf",
      title: "PDF summary",
      description: "Executive summary, verdict, headline table and limitations.",
      icon: "file-text",
      action: "Request",
      run: () => toast.push({ title: "PDF summary requested", description: "Demo: no file is generated. The report page holds the same content.", tone: "info" }),
    },
  ];

  const recalculate = () => {
    setConfirm(false);
    const next = `r${revisions.length + 1}`;
    setRevisions((current) => [...current, { id: next, note: "Recalculated with methodology " + methodologyVersion, meta: `Queued · ${createdBy}` }]);
    toast.push({ title: `Revision ${next} queued`, tone: "success" });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader title="Files" info="Files reflect the matched cohort and list what was left out." />
          <CardBody className="pt-2">
            <ul className="divide-y divide-line">
              {files.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg-muted">
                      <Icon name={file.icon} size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-fg">{file.title}</p>
                      <p className="text-xs text-fg-subtle">{file.description}</p>
                    </div>
                  </div>
                  <Button size="sm" icon={file.id === "pdf" ? "file-text" : "download"} onClick={file.run}>{file.action}</Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Methodology and sources" />
          <CardBody className="flex flex-col gap-4">
            <KeyValue
              columns={2}
              items={[
                { label: "Methodology version", value: <span className="tnum">{methodologyVersion}</span> },
                { label: "Analysis version", value: <span className="tnum">{analysisVersion}</span> },
                { label: "Matching", value: matching },
                { label: "Aggregation", value: aggregation },
              ]}
            />
            <ul className="divide-y divide-line rounded-control border border-line">
              {sources.map((source) => (
                <li key={source.label} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] text-fg">{source.label}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {source.runs.map((run) => (
                      <Mono key={run}>{run}</Mono>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader title="Revisions" info="Results are immutable. Recalculating adds a revision and never overwrites an earlier result." actions={<Button size="sm" icon="refresh" onClick={() => setConfirm(true)}>Recalculate</Button>} />
        <CardBody>
          <ol className="flex flex-col gap-3">
            {revisions.map((revision) => (
              <li key={revision.id} className="flex items-start gap-3">
                <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-text">{revision.id}</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-fg">{revision.note}</p>
                  <p className="text-xs text-fg-subtle">{revision.meta}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={recalculate} title="Recalculate comparison?" confirmLabel="Create revision" tone="primary">
        Creates revision r{revisions.length + 1} from the same sources and methodology {methodologyVersion}.
      </ConfirmDialog>
    </div>
  );
}
