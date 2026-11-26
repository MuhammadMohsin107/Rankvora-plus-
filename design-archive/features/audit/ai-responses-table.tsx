"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/table";
import { ResponseDrawer } from "@/features/responses/response-drawer";
import { siblingSamples } from "@/features/responses/response-model";
import type { ResponseSample } from "@/types/shared-records";

const mentionValue = (r: ResponseSample) => (r.status === "failed" ? "failed" : r.brandMentioned);
const recommendationValue = (r: ResponseSample) => (r.status === "failed" ? "failed" : r.recommendation);

const unique = (values: string[]) => [...new Set(values)].sort();

/**
 * Every response sample of the audit, including failed requests (never read as "brand absent").
 * Filters, all visible in the toolbar: provider, prompt, status, mention, recommendation and competitor; market and language only when the audit has more than one.
 */
export function AiResponsesTable({ responses, providers, prompts, findingByPrompt }: { responses: ResponseSample[]; providers: { id: string; label: string }[]; prompts: { id: string; text: string; version: number }[]; findingByPrompt?: Record<string, string> }) {
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(() => params.get("response"));
  const open = responses.find((r) => r.id === openId) ?? null;

  const competitors = useMemo(() => unique(responses.flatMap((r) => r.competitors.filter((c) => c.mentioned).map((c) => c.name))), [responses]);
  const markets = useMemo(() => unique(responses.map((r) => r.market)), [responses]);
  const languages = useMemo(() => unique(responses.map((r) => r.language)), [responses]);

  const columns: Column<ResponseSample>[] = [
    {
      id: "prompt",
      header: "Prompt",
      sort: (r) => r.promptId,
      cell: (r) => (
        <div className="min-w-0 max-w-[22rem]">
          <p className="truncate text-body-sm text-fg" title={r.promptText}>{r.promptText}</p>
          <p className="text-helper text-fg-subtle">v{r.promptVersion} · sample {r.sample}</p>
        </div>
      ),
    },
    { id: "provider", header: "Provider", sort: (r) => r.providerLabel, cell: (r) => <span className="whitespace-nowrap text-body-sm text-fg">{r.providerLabel}</span>, hideBelow: "sm" },
    {
      id: "outcome",
      header: "Outcome",
      sort: (r) => r.outcome,
      cell: (r) => (r.status === "failed" ? <Status kind="job" value="failed" /> : <Status kind="recommendation" value={r.recommendation} />),
    },
    {
      id: "citations",
      header: "Citations",
      align: "right",
      hideBelow: "lg",
      sort: (r) => r.citations.length,
      cell: (r) => (r.citationSupport === "not_supported" ? <span className="text-fg-subtle">N/A</span> : <span className="tnum">{r.citations.length}</span>),
    },
    { id: "open", header: "Open", srOnlyHeader: true, align: "right", cell: (r) => <Button variant="ghost" size="sm" onClick={() => setOpenId(r.id)}>View</Button> },
  ];

  return (
    <>
      <DataTable
        label="AI responses"
        data={responses}
        columns={columns}
        rowKey={(r) => r.id}
        pageSize={10}
        mobileCards
        onRowClick={(r) => setOpenId(r.id)}
        rowLabel={(r) => `${r.providerLabel} response to ${r.promptText.slice(0, 40)}`}
        searchable={{ placeholder: "Search prompts and answers", text: (r) => `${r.promptText} ${r.answerText}` }}
        filters={[
          { id: "provider", label: "Provider", options: providers.map((p) => ({ value: p.id, label: p.label })), value: (r) => r.channelId },
          { id: "prompt", label: "Prompt", options: prompts.map((p) => ({ value: p.id, label: p.text.length > 38 ? `${p.text.slice(0, 38)}…` : p.text })), value: (r) => r.promptId },
          {
            id: "status",
            label: "Status",
            options: [
              { value: "succeeded", label: "Succeeded" },
              { value: "failed", label: "Failed" },
            ],
            value: (r) => r.status,
          },
          { id: "mention", label: "Mention", options: [{ value: "yes", label: "Mentioned" }, { value: "no", label: "Not mentioned" }, { value: "failed", label: "Failed (no result)" }], value: mentionValue },
          {
            id: "recommendation",
            label: "Recommendation",
            options: [{ value: "recommended", label: "Recommended" }, { value: "merely_mentioned", label: "Mentioned only" }, { value: "none", label: "Not mentioned" }, { value: "failed", label: "Failed (no result)" }],
            value: recommendationValue,
          },
          ...(competitors.length > 0
            ? [{ id: "competitor", label: "Competitor", options: competitors.map((c) => ({ value: c, label: c })), value: (r: ResponseSample) => r.competitors.filter((c) => c.mentioned).map((c) => c.name) }]
            : []),
          ...(markets.length > 1 ? [{ id: "market", label: "Market", options: markets.map((m) => ({ value: m, label: m })), value: (r: ResponseSample) => r.market }] : []),
          ...(languages.length > 1 ? [{ id: "language", label: "Language", options: languages.map((l) => ({ value: l, label: l.toUpperCase() })), value: (r: ResponseSample) => r.language }] : []),
        ]}
      />
      {open ? (
        <ResponseDrawer
          response={open}
          open
          onClose={() => setOpenId(null)}
          samples={siblingSamples(open, responses)}
          evidence={findingByPrompt?.[open.promptId] ? { findingId: findingByPrompt[open.promptId] } : undefined}
        />
      ) : null}
    </>
  );
}
