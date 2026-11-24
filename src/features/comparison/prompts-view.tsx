"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import { Drawer } from "@/components/ui/overlay";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { LeftOutTable, type LeftOutRow } from "@/features/comparison/left-out-table";
import { groupByPrompt, type PromptChange, type PromptGroupRow } from "@/features/comparison/prompt-groups";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import { ResponseButton } from "@/features/responses/response-inspector";
import { pluralize, formatPoints } from "@/lib/format";
import type { Comparability, PairRowWithResponses, PairSummary } from "@/types/comparison";
import type { ResponseOutcome } from "@/types/shared-records";

const outcomeStatus = (outcome: ResponseOutcome | null) =>
  outcome === "recommended" ? "recommended" : outcome === "mentioned" ? "merely_mentioned" : outcome === "absent" ? "none" : "unclear";

const changeMeta = {
  gained: { tone: "success", icon: "arrow-up", label: "Mention up" },
  lost: { tone: "danger", icon: "arrow-down", label: "Mention down" },
  unchanged: { tone: "neutral", icon: "minus", label: "No change" },
} as const;

function Side({ summary }: { summary: PairSummary }) {
  if (summary.d === 1 && summary.outcome) return <Status kind="recommendation" value={outcomeStatus(summary.outcome)} />;
  return (
    <div className="tnum flex flex-col text-body-sm text-fg">
      <span>{summary.n} of {summary.d} mentioned</span>
      <span className="text-helper text-fg-subtle">{summary.recommended} recommended{summary.failed ? ` · ${summary.failed} failed` : ""}</span>
    </div>
  );
}

function SlotsDrawer({ group, storeId, comparisonId, channelLabels, onClose }: { group: PromptGroupRow<PairRowWithResponses> | null; storeId: string; comparisonId: string; channelLabels: Record<string, string>; onClose: () => void }) {
  return (
    <Drawer open={group !== null} onClose={onClose} title={group?.text ?? "Prompt"} description={group ? `${group.promptId} · ${pluralize(group.slots.length, "matched slot")}` : undefined} size="lg">
      {group ? (
        <div className="flex flex-col gap-3">
          <EvidenceTrace ids={{ storeId, promptId: group.promptId, comparisonId }} live={false} />
          <ul className="divide-y divide-line">
            {group.slots.map((slot) => (
              <li key={slot.key} className="flex flex-col gap-2 py-2 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-sm font-medium text-fg">{channelLabels[slot.channelId] ?? slot.channelId}</p>
                  <p className="tnum text-helper text-fg-subtle">v{slot.promptVersion} · sample {slot.sample}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="mb-1 text-helper text-fg-subtle">Baseline</p><Side summary={slot.baseline} /></div>
                  <div><p className="mb-1 text-helper text-fg-subtle">Current</p><Side summary={slot.current} /></div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={changeMeta[slot.change].tone} icon={changeMeta[slot.change].icon}>{changeMeta[slot.change].label}</Badge>
                  {slot.recommendationChange !== "unchanged" ? <span className="text-helper text-fg-muted">Recommendation {slot.recommendationChange === "gained" ? "gained" : "lost"}</span> : null}
                  {slot.citationChange === "n/a" ? <span className="text-helper text-fg-subtle">Citation: N/A</span> : slot.citationChange !== "unchanged" ? <span className="text-helper text-fg-muted">Owned citation {slot.citationChange === "gained" ? "gained" : "lost"}</span> : null}
                  <span className="ml-auto flex gap-3">
                    {slot.baselineResponse ? <ResponseButton response={slot.baselineResponse}>Baseline answer</ResponseButton> : null}
                    {slot.currentResponse ? <ResponseButton response={slot.currentResponse}>Current answer</ResponseButton> : null}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Drawer>
  );
}

type Props = {
  storeId: string;
  comparisonId: string;
  rows: PairRowWithResponses[];
  leftOut: LeftOutRow[];
  channelLabels: Record<string, string>;
  verdict: Comparability;
};

/** One row per prompt (slots grouped). Details open in a drawer. Slots left out sit behind one disclosure. */
export function PromptsView({ storeId, comparisonId, rows, leftOut, channelLabels, verdict }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const changeParam = params.get("change");
  const forced: PromptChange | null = changeParam === "lost" || changeParam === "gained" || changeParam === "unchanged" ? changeParam : null;
  const [open, setOpen] = useState<PromptGroupRow<PairRowWithResponses> | null>(null);

  const all = useMemo(() => groupByPrompt(rows), [rows]);
  const groups = useMemo(() => (forced ? all.filter((g) => g.change === forced) : all), [all, forced]);

  const columns: Column<PromptGroupRow<PairRowWithResponses>>[] = [
    {
      id: "prompt",
      header: "Prompt",
      sort: (r) => r.text,
      cell: (r) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate text-body-sm font-medium text-fg" title={r.text}>{r.text}</p>
          <p className="tnum text-helper text-fg-subtle">{r.promptId} · {pluralize(r.slots.length, "slot")}</p>
        </div>
      ),
    },
    { id: "baseline", header: "Baseline", hideBelow: "sm", cell: (r) => <span className="tnum text-body-sm text-fg">{r.baseline.n} of {r.baseline.d}</span> },
    { id: "current", header: "Current", hideBelow: "sm", cell: (r) => <span className="tnum text-body-sm text-fg">{r.current.n} of {r.current.d}</span> },
    {
      id: "change",
      header: "Change",
      sort: (r) => r.points ?? 0,
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={changeMeta[r.change].tone} icon={changeMeta[r.change].icon}><span className="tnum">{formatPoints(r.points)}</span></Badge>
          {r.lostSlots + r.gainedSlots > 0 ? <span className="text-helper text-fg-subtle">{r.lostSlots} lost · {r.gainedSlots} gained</span> : null}
        </div>
      ),
    },
    { id: "open", header: "Details", srOnlyHeader: true, align: "right", cell: (r) => <Button size="sm" variant="ghost" onClick={() => setOpen(r)}>Slots</Button> },
  ];
  const filters: TableFilter<PromptGroupRow<PairRowWithResponses>>[] = [{ id: "change", label: "Change", options: Object.entries(changeMeta).map(([value, meta]) => ({ value, label: meta.label })), value: (r) => r.change }];

  const clear = () => router.replace(pathname);

  return (
    <div className="flex flex-col gap-3">
      {verdict === "insufficient_data" ? <Callout tone="warning" title="Fewer than 20 matched pairs: read these rows as examples, not a trend." /> : null}
      {forced ? (
        <p className="flex items-center gap-2 text-body-sm text-fg-muted">
          Showing prompts with {changeMeta[forced].label.toLowerCase()}.
          <Button size="sm" variant="ghost" onClick={clear}>Show all</Button>
        </p>
      ) : null}
      <DataTable
        label="Prompts"
        data={groups}
        columns={columns}
        rowKey={(r) => r.promptId}
        searchable={{ placeholder: "Search prompts", text: (r) => `${r.text} ${r.promptId}` }}
        filters={filters}
        onRowClick={(r) => setOpen(r)}
        rowLabel={(r) => r.text}
        pageSize={10}
        mobileCards
        empty={<p className="p-2 text-center text-body-sm text-fg-muted">No matched prompts.</p>}
      />
      <details className="rounded-card border border-line bg-surface shadow-card" open={params.get("left") === "1" ? true : undefined}>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-card px-card py-2.5 text-card-title font-semibold text-fg focus-visible:outline-2 focus-visible:outline-ring">
          Left out
          <span className="tnum text-helper font-normal text-fg-subtle">{leftOut.length}</span>
        </summary>
        <div className="px-card pb-card">
          <LeftOutTable rows={leftOut} />
        </div>
      </details>
      <SlotsDrawer group={open} storeId={storeId} comparisonId={comparisonId} channelLabels={channelLabels} onClose={() => setOpen(null)} />
    </div>
  );
}
