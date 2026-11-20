"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Popover } from "@/components/ui/popover";
import { DataTable, type Column } from "@/components/ui/table";
import { ResponseDrawer } from "@/features/responses/response-drawer";
import { siblingSamples } from "@/features/responses/response-model";
import type { ResponseSample } from "@/types/shared-records";

const mentionValue = (r: ResponseSample) => (r.status === "failed" ? "failed" : r.brandMentioned);
const recommendationValue = (r: ResponseSample) => (r.status === "failed" ? "failed" : r.recommendation);

type More = { competitor: string; market: string; language: string; mention: string; recommendation: string };
const NO_MORE: More = { competitor: "", market: "", language: "", mention: "", recommendation: "" };

const unique = (values: string[]) => [...new Set(values)].sort();

/**
 * Every response sample of the audit, including failed requests (never read as "brand absent").
 * Filters: provider, prompt and status in the toolbar; competitor, market, language, mention and recommendation under "More filters".
 */
export function AiResponsesTable({ responses, providers, prompts, findingByPrompt }: { responses: ResponseSample[]; providers: { id: string; label: string }[]; prompts: { id: string; text: string; version: number }[]; findingByPrompt?: Record<string, string> }) {
  const params = useSearchParams();
  const [more, setMore] = useState<More>(NO_MORE);
  const [openId, setOpenId] = useState<string | null>(() => params.get("response"));
  const open = responses.find((r) => r.id === openId) ?? null;

  const competitors = useMemo(() => unique(responses.flatMap((r) => r.competitors.filter((c) => c.mentioned).map((c) => c.name))), [responses]);
  const markets = useMemo(() => unique(responses.map((r) => r.market)), [responses]);
  const languages = useMemo(() => unique(responses.map((r) => r.language)), [responses]);

  const data = useMemo(
    () =>
      responses.filter(
        (r) =>
          (!more.competitor || r.competitors.some((c) => c.mentioned && c.name === more.competitor)) &&
          (!more.market || r.market === more.market) &&
          (!more.language || r.language === more.language) &&
          (!more.mention || mentionValue(r) === more.mention) &&
          (!more.recommendation || recommendationValue(r) === more.recommendation),
      ),
    [responses, more],
  );
  const activeMore = Object.values(more).filter(Boolean).length;
  const set = (patch: Partial<More>) => setMore((m) => ({ ...m, ...patch }));

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

  const field = (label: string, value: string, options: { value: string; label: string }[], onChange: (v: string) => void) => (
    <label className="flex flex-col gap-1 text-label font-medium text-fg">
      {label}
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </label>
  );

  return (
    <>
      <DataTable
        label="AI responses"
        data={data}
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
        ]}
        toolbarExtra={
          <Popover
            label="More filters"
            align="end"
            width={300}
            trigger={<Button size="sm" icon="filter" variant={activeMore > 0 ? "secondary" : "ghost"}>More filters{activeMore > 0 ? ` (${activeMore})` : ""}</Button>}
          >
            <div className="flex flex-col gap-3 p-3">
              {field("Competitor named", more.competitor, competitors.map((c) => ({ value: c, label: c })), (competitor) => set({ competitor }))}
              {field("Market", more.market, markets.map((m) => ({ value: m, label: m })), (market) => set({ market }))}
              {field("Language", more.language, languages.map((l) => ({ value: l, label: l.toUpperCase() })), (language) => set({ language }))}
              {field("Mention", more.mention, [{ value: "yes", label: "Mentioned" }, { value: "no", label: "Not mentioned" }, { value: "failed", label: "Failed (no result)" }], (mention) => set({ mention }))}
              {field("Recommendation", more.recommendation, [{ value: "recommended", label: "Recommended" }, { value: "merely_mentioned", label: "Mentioned only" }, { value: "none", label: "Not mentioned" }, { value: "failed", label: "Failed (no result)" }], (recommendation) => set({ recommendation }))}
              {activeMore > 0 ? <Button size="sm" variant="ghost" onClick={() => setMore(NO_MORE)}>Clear these filters</Button> : null}
            </div>
          </Popover>
        }
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
