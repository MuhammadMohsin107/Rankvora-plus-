"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { StackedBar } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/form";
import { Mono } from "@/components/ui/misc";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { INTENT_LABEL, SCOPE_LABEL } from "@/lib/labels";
import { pluralize } from "@/lib/format";
import type { PromptIntent, PromptScope } from "@/types/core";
import type { NewPromptData } from "@/types/prompts";

import type { SessionPrompt } from "./create-types";
import { CSV_COLUMNS, MAX_IMPORT_ROWS, previewImport, toCsvText, type ImportRow, type ImportRowResult } from "./import-parse";

type Props = {
  data: NewPromptData;
  csv: string;
  setCsv: (next: string) => void;
  fileName: string | null;
  setFileName: (next: string | null) => void;
  session: SessionPrompt[];
  onImported: (texts: string[]) => void;
};

const RESULT_BADGE: Record<ImportRowResult, { tone: "success" | "warning" | "danger"; icon: "check-circle" | "copy" | "alert-circle"; label: string }> = {
  create: { tone: "success", icon: "check-circle", label: "Will create" },
  duplicate: { tone: "warning", icon: "copy", label: "Duplicate" },
  invalid: { tone: "danger", icon: "alert-circle", label: "Invalid" },
};

export function ImportTab({ data, csv, setCsv, fileName, setFileName, session, onImported }: Props) {
  const { store, groups, existing, suggestionBatches } = data;
  const router = useRouter();
  const toast = useToast();
  const [reading, setReading] = useState(false);
  const base = `/stores/${store.id}/prompts`;

  const preview = useMemo(
    () => previewImport(csv, { language: store.language, market: store.market, groups, existing: [...existing, ...session] }),
    [csv, store.language, store.market, groups, existing, session],
  );

  const tally = useMemo(() => {
    const t = { create: 0, duplicate: 0, invalid: 0 };
    for (const row of preview.rows) t[row.result] += 1;
    return t;
  }, [preview.rows]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
      setReading(false);
    };
    reader.onerror = () => {
      setReading(false);
      toast.push({ title: "Could not read the file", description: "Try pasting the CSV text instead.", tone: "danger" });
    };
    reader.readAsText(file);
  };

  const download = () => {
    const sample = toCsvText([[`What are the best ${store.brandName} alternatives?`, "alternative", "Alternatives", groups[0]?.name ?? "", store.language, store.market, "draft", "both", "false"]]);
    const url = URL.createObjectURL(new Blob([`${sample}\n`], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "prompt-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.push({ title: "Template downloaded", description: "prompt-import-template.csv", tone: "info" });
  };

  const loadExample = () => {
    const extra = suggestionBatches[1] ?? [];
    const rows: string[][] = [
      ...extra.slice(0, 2).map((s) => [s.text, s.intent, s.topic, groups[0]?.name ?? "", store.language, store.market, "draft", "both", "false"]),
    ];
    if (existing[0]) rows.push([existing[0].text, "discovery", "Existing", "", store.language, store.market, "draft", "both", "false"]);
    rows.push(["Too short", "banana", "", "", store.language, store.market, "draft", "both", "false"]);
    setCsv(toCsvText(rows));
    setFileName(null);
  };

  const confirm = () => {
    const created = preview.rows.filter((r) => r.result === "create");
    if (created.length === 0) return;
    const skipped = tally.duplicate + tally.invalid;
    toast.push({
      title: `${pluralize(created.length, "prompt")} imported`,
      description: skipped ? `${pluralize(skipped, "row")} skipped (${tally.duplicate} duplicate, ${tally.invalid} invalid).` : "Added with the status from the file.",
    });
    onImported(created.map((r) => r.text));
    router.push(base);
  };

  const columns: Column<ImportRow>[] = [
    { id: "line", header: "Row", width: "w-14", sort: (r) => r.line, cell: (r) => <span className="tnum text-fg-muted">{r.line}</span> },
    { id: "text", header: "Prompt", cell: (r) => <span className="line-clamp-2 max-w-[26rem] [overflow-wrap:anywhere]">{r.text || <span className="text-fg-subtle">(empty)</span>}</span> },
    { id: "intent", header: "Intent", hideBelow: "md", cell: (r) => <span className="whitespace-nowrap text-fg-muted">{INTENT_LABEL[r.intent as PromptIntent] ?? "—"}</span> },
    { id: "scope", header: "Scope", hideBelow: "lg", cell: (r) => <span className="whitespace-nowrap text-fg-muted">{SCOPE_LABEL[r.scope as PromptScope] ?? "—"}</span> },
    {
      id: "result",
      header: "Result",
      cell: (r) => {
        const badge = RESULT_BADGE[r.result];
        return (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge>
            {r.notes.length ? <ul className="flex flex-col gap-0.5 text-xs text-fg-muted">{r.notes.map((note) => <li key={note} className="[overflow-wrap:anywhere]">{note}</li>)}</ul> : null}
          </div>
        );
      },
    },
  ];

  const filters: TableFilter<ImportRow>[] = [
    { id: "result", label: "Result", options: Object.entries(RESULT_BADGE).map(([value, b]) => ({ value, label: b.label })), value: (r) => r.result },
  ];

  const hasRows = preview.rows.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <Card as="section">
        <CardHeader
          title="Import from CSV"
          subtitle={`Up to ${MAX_IMPORT_ROWS} rows. Nothing is created until you confirm.`}
          actions={
            <>
              <Button size="sm" icon="download" onClick={download}>Template</Button>
              <Button size="sm" icon="sparkles" onClick={loadExample}>Load example</Button>
            </>
          }
        />
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="CSV columns">
            {CSV_COLUMNS.map((column) => (
              <Mono key={column} className={column === "prompt_text" ? "text-fg" : undefined}>{column}{column === "prompt_text" ? " *" : ""}</Mono>
            ))}
          </div>
          <Field label="Paste CSV">
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                rows={6}
                spellCheck={false}
                className="font-mono"
                value={csv}
                placeholder={CSV_COLUMNS.join(",")}
                onChange={(event) => {
                  setCsv(event.target.value);
                  setFileName(null);
                }}
              />
            )}
          </Field>
          <Field label="Or choose a file" hint={fileName ? `Loaded ${fileName}` : "CSV, read in your browser. It is not uploaded."}>
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                type="file"
                accept=".csv,text/csv"
                disabled={reading}
                onChange={(event) => {
                  onFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
                className="block w-full text-[13px] text-fg-muted file:mr-3 file:cursor-pointer file:rounded-control file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-fg hover:file:bg-surface-2"
              />
            )}
          </Field>
          {csv ? (
            <div>
              <Button size="sm" variant="ghost" icon="x" onClick={() => { setCsv(""); setFileName(null); }}>Clear</Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {preview.fileError ? <Callout tone="danger" title="This file can't be imported">{preview.fileError}</Callout> : null}
      {preview.ignoredColumns.length > 0 && !preview.fileError ? <Callout tone="info" title="Unknown columns are ignored">{preview.ignoredColumns.join(", ")}</Callout> : null}

      {hasRows ? (
        <Card as="section">
          <CardHeader title="Dry run" subtitle="Check every row before importing." />
          <CardBody className="flex flex-col gap-4">
            <StackedBar
              unit="rows"
              segments={[
                { id: "create", label: "Will create", value: tally.create, tone: "success" },
                { id: "duplicate", label: "Duplicate, skipped", value: tally.duplicate, tone: "warning" },
                { id: "invalid", label: "Invalid, skipped", value: tally.invalid, tone: "danger" },
              ]}
            />
            <DataTable label="Import preview" data={preview.rows} columns={columns} rowKey={(r) => String(r.line)} filters={filters} pageSize={10} dense />
          </CardBody>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-4 py-3">
            <ButtonLink href={base} variant="ghost">Cancel</ButtonLink>
            <Button variant="primary" icon="upload" disabled={tally.create === 0} onClick={confirm}>
              Import {pluralize(tally.create, "prompt")}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
