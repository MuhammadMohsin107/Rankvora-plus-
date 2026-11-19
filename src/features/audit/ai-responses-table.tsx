"use client";

import { Status } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/table";
import { ResponseButton } from "@/features/responses/response-inspector";
import type { ResponseSample } from "@/types/shared-records";

const mentionValue = (r: ResponseSample) => (r.status === "failed" ? "failed" : r.brandMentioned);
const recommendationValue = (r: ResponseSample) => (r.status === "failed" ? "failed" : r.recommendation);

/**
 * Every response sample of the audit, including failed requests (never read as "brand absent").
 * The Outcome column already says whether the brand was mentioned or recommended, so there is no separate mention column.
 */
export function AiResponsesTable({ responses, providers, prompts }: { responses: ResponseSample[]; providers: { id: string; label: string }[]; prompts: { id: string; text: string; version: number }[] }) {
  const columns: Column<ResponseSample>[] = [
    {
      id: "prompt",
      header: "Prompt",
      sort: (r) => r.promptId,
      cell: (r) => (
        <div className="min-w-0 max-w-[22rem]">
          <p className="truncate text-[13px] text-fg" title={r.promptText}>{r.promptText}</p>
          <p className="text-xs text-fg-subtle">{r.promptId} · v{r.promptVersion}</p>
        </div>
      ),
    },
    {
      id: "provider",
      header: "Provider",
      sort: (r) => r.providerLabel,
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className="text-[13px] text-fg">{r.providerLabel}</p>
          <p className="text-xs text-fg-subtle">Sample {r.sample}</p>
        </div>
      ),
      hideBelow: "sm",
    },
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
    { id: "open", header: "Open", srOnlyHeader: true, align: "right", cell: (r) => <ResponseButton response={r} /> },
  ];

  return (
    <DataTable
      label="AI responses"
      data={responses}
      columns={columns}
      rowKey={(r) => r.id}
      pageSize={10}
      searchable={{ placeholder: "Search prompts and answers", text: (r) => `${r.promptText} ${r.answerText}` }}
      filters={[
        { id: "provider", label: "Provider", options: providers.map((p) => ({ value: p.id, label: p.label })), value: (r) => r.channelId },
        { id: "prompt", label: "Prompt", options: prompts.map((p) => ({ value: p.id, label: `${p.id} · ${p.text.length > 38 ? `${p.text.slice(0, 38)}…` : p.text}` })), value: (r) => r.promptId },
        {
          id: "mention",
          label: "Mention",
          options: [
            { value: "yes", label: "Mentioned" },
            { value: "no", label: "Not mentioned" },
            { value: "failed", label: "Failed (no result)" },
          ],
          value: mentionValue,
        },
        {
          id: "recommendation",
          label: "Recommendation",
          options: [
            { value: "recommended", label: "Recommended" },
            { value: "merely_mentioned", label: "Mentioned only" },
            { value: "none", label: "Not mentioned" },
            { value: "failed", label: "Failed (no result)" },
          ],
          value: recommendationValue,
        },
      ]}
    />
  );
}
