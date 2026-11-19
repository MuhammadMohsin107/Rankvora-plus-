"use client";

import { Badge, Status } from "@/components/ui/badge";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { REASON_LABEL } from "@/features/comparison/engine";
import { ResponseButton } from "@/features/responses/response-inspector";
import type { ExcludedSlot, PairRowWithResponses, PairSummary, UnmatchedSlot } from "@/types/comparison";
import type { ResponseOutcome } from "@/types/shared-records";

const outcomeStatus = (outcome: ResponseOutcome | null) =>
  outcome === "recommended" ? "recommended" : outcome === "mentioned" ? "merely_mentioned" : outcome === "absent" ? "none" : "unclear";

function ResultCell({ summary }: { summary: PairSummary }) {
  if (summary.d === 1 && summary.outcome) {
    return <Status kind="recommendation" value={outcomeStatus(summary.outcome)} />;
  }
  return (
    <div className="tnum flex flex-col text-[13px] text-fg">
      <span>{summary.n} / {summary.d} mentioned</span>
      <span className="text-xs text-fg-subtle">{summary.recommended} recommended{summary.failed ? ` · ${summary.failed} failed` : ""}</span>
    </div>
  );
}

const changeMeta = {
  gained: { tone: "success", icon: "arrow-up", label: "Mention gained" },
  lost: { tone: "danger", icon: "arrow-down", label: "Mention lost" },
  unchanged: { tone: "neutral", icon: "minus", label: "No change" },
} as const;

type Context = { promptText: Record<string, string>; channelLabels: Record<string, string> };

function PromptCell({ promptId, version, sample, ctx }: { promptId: string; version: number; sample: number; ctx: Context }) {
  return (
    <div className="min-w-0 max-w-sm">
      <p className="truncate text-[13px] text-fg" title={ctx.promptText[promptId]}>{ctx.promptText[promptId] ?? promptId}</p>
      <p className="tnum text-xs text-fg-subtle">{promptId} · v{version} · sample {sample}</p>
    </div>
  );
}

export function MatchedTable({ rows, ctx }: { rows: PairRowWithResponses[]; ctx: Context }) {
  const columns: Column<PairRowWithResponses>[] = [
    { id: "prompt", header: "Prompt", sort: (r) => r.promptId, cell: (r) => <PromptCell promptId={r.promptId} version={r.promptVersion} sample={r.sample} ctx={ctx} /> },
    { id: "provider", header: "Provider", hideBelow: "lg", cell: (r) => <span className="block max-w-[11rem] text-xs text-fg-muted">{r.channelLabel}</span> },
    { id: "baseline", header: "Baseline", cell: (r) => <ResultCell summary={r.baseline} /> },
    { id: "current", header: "Current", cell: (r) => <ResultCell summary={r.current} /> },
    {
      id: "change",
      header: "Change",
      sort: (r) => r.change,
      cell: (r) => {
        const meta = changeMeta[r.change];
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
            {r.recommendationChange !== "unchanged" ? <span className="text-xs text-fg-subtle">{r.recommendationChange === "gained" ? "Recommendation gained" : "Recommendation lost"}</span> : null}
          </div>
        );
      },
    },
    {
      id: "responses",
      header: "Responses",
      cell: (r) => (
        <div className="flex gap-3">
          {r.baselineResponse ? <ResponseButton response={r.baselineResponse}>Before</ResponseButton> : <span className="text-xs text-fg-subtle">—</span>}
          {r.currentResponse ? <ResponseButton response={r.currentResponse}>After</ResponseButton> : <span className="text-xs text-fg-subtle">—</span>}
        </div>
      ),
    },
  ];
  const filters: TableFilter<PairRowWithResponses>[] = [
    { id: "provider", label: "Provider", options: Object.entries(ctx.channelLabels).filter(([id]) => rows.some((r) => r.channelId === id)).map(([value, label]) => ({ value, label })), value: (r) => r.channelId },
    { id: "change", label: "Change", options: Object.entries(changeMeta).map(([value, meta]) => ({ value, label: meta.label })), value: (r) => r.change },
  ];
  return (
    <DataTable
      label="Matched prompts"
      data={rows}
      columns={columns}
      rowKey={(r) => r.key}
      searchable={{ placeholder: "Search prompts", text: (r) => `${r.promptText} ${r.promptId}` }}
      filters={filters}
      pageSize={10}
      empty={<p className="p-2 text-center text-[13px] text-fg-muted">No matched slots.</p>}
    />
  );
}

export function UnmatchedTable({ rows, ctx }: { rows: UnmatchedSlot[]; ctx: Context }) {
  const columns: Column<UnmatchedSlot>[] = [
    { id: "prompt", header: "Prompt", sort: (r) => r.promptId, cell: (r) => <PromptCell promptId={r.promptId} version={r.promptVersion} sample={r.sample} ctx={ctx} /> },
    { id: "provider", header: "Provider", hideBelow: "lg", cell: (r) => <span className="block max-w-[11rem] text-xs text-fg-muted">{ctx.channelLabels[r.channelId] ?? r.channelId}</span> },
    { id: "side", header: "Present on", sort: (r) => r.presentOn, cell: (r) => <Badge tone="neutral">{r.presentOn === "baseline" ? "Baseline only" : "Current only"}</Badge> },
    {
      id: "reason",
      header: "Reason",
      sort: (r) => r.reason,
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone="warning" icon="alert-triangle">{REASON_LABEL[r.reason]}</Badge>
          <span className="text-xs text-fg-subtle">{r.detail}</span>
        </div>
      ),
    },
  ];
  const filters: TableFilter<UnmatchedSlot>[] = [
    { id: "reason", label: "Reason", options: [...new Set(rows.map((r) => r.reason))].map((value) => ({ value, label: REASON_LABEL[value] })), value: (r) => r.reason },
    { id: "side", label: "Present on", options: [{ value: "baseline", label: "Baseline only" }, { value: "current", label: "Current only" }], value: (r) => r.presentOn },
  ];
  return (
    <DataTable
      label="Unmatched slots"
      data={rows}
      columns={columns}
      rowKey={(r) => `${r.key}-${r.presentOn}`}
      filters={filters}
      pageSize={10}
      dense
      empty={<p className="p-2 text-center text-[13px] text-fg-muted">Every slot has a counterpart on the other side.</p>}
    />
  );
}

export function ExcludedTable({ rows, ctx }: { rows: ExcludedSlot[]; ctx: Context }) {
  const columns: Column<ExcludedSlot>[] = [
    { id: "prompt", header: "Prompt", sort: (r) => r.promptId, cell: (r) => <PromptCell promptId={r.promptId} version={r.promptVersion} sample={r.sample} ctx={ctx} /> },
    { id: "provider", header: "Provider", hideBelow: "lg", cell: (r) => <span className="block max-w-[11rem] text-xs text-fg-muted">{ctx.channelLabels[r.channelId] ?? r.channelId}</span> },
    {
      id: "reason",
      header: "Reason",
      sort: (r) => r.reason,
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone="danger" icon="x-circle">{REASON_LABEL[r.reason]}</Badge>
          <span className="text-xs text-fg-subtle">{r.detail}</span>
        </div>
      ),
    },
  ];
  return (
    <DataTable
      label="Excluded slots"
      data={rows}
      columns={columns}
      rowKey={(r) => r.key}
      pageSize={10}
      dense
      empty={<p className="p-2 text-center text-[13px] text-fg-muted">No slot was excluded.</p>}
    />
  );
}
