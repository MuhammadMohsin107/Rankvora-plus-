"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/feedback";
import { Card, CardBody } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Timeline } from "@/components/ui/misc";
import { useDemoEvents } from "@/demo-state";
import { formatDateTime } from "@/lib/format";
import type { HistoryKind } from "@/types/fixes";

import { historyKindOf, splitLabel } from "./history";
import { HISTORY_VIEW } from "./task-history";

export type HistoryItem = { id: string; at: string; kind: HistoryKind; title: string; detail?: string; actor: string; taskId?: string; findingId?: string; local: boolean };

const KIND_LABEL: Record<HistoryKind, string> = {
  created: "Created",
  draft: "Drafts",
  approval: "Approvals",
  execution: "Execution",
  verification: "Verification",
  rollback: "Rollbacks",
  status: "Status changes",
};

/** Timeline of everything that happened in Fixes: seeded history plus the local events (task and finding changes). */
export function FixesHistory({ storeId, seeded, actorName }: { storeId: string; seeded: (Omit<HistoryItem, "local"> & { taskTitle?: string })[]; actorName: string }) {
  const events = useDemoEvents({ websiteId: storeId });
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const base = `/stores/${storeId}/fixes`;

  const items = useMemo<HistoryItem[]>(() => {
    const local = events
      .filter((e) => e.kind.startsWith("task.") || e.kind === "finding.updated" || e.kind === "comparison.annotated")
      .map((e) => {
        const { title, detail } = splitLabel(e.label);
        return { id: e.id, at: e.at, kind: historyKindOf(e), title, detail, actor: actorName, taskId: e.refs.taskId, findingId: e.refs.findingId, local: true };
      });
    return [...seeded.map((s) => ({ ...s, local: false })), ...local].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [events, seeded, actorName]);

  const shown = items.filter((i) => (!kind || i.kind === kind) && (!query.trim() || `${i.title} ${i.detail ?? ""} ${i.taskId ?? ""} ${i.findingId ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <FilterBar
        label="History filters"
        search={{ value: query, onChange: setQuery, placeholder: "Search history", label: "Search history" }}
        filters={[{ id: "kind", label: "Type", value: kind, onChange: setKind, options: (Object.keys(KIND_LABEL) as HistoryKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })) }]}
        onClearAll={() => {
          setKind("");
          setQuery("");
        }}
        resultCount={{ shown: shown.length, total: items.length }}
      />
      {shown.length === 0 ? (
        <EmptyState icon="history" title="No history matches" />
      ) : (
        <Card>
          <CardBody>
            <Timeline
              items={shown.slice(0, 60).map((i) => ({
                id: i.id,
                icon: HISTORY_VIEW[i.kind].icon,
                tone: HISTORY_VIEW[i.kind].tone,
                title: i.title,
                time: formatDateTime(i.at),
                meta: (
                  <>
                    {i.actor}
                    {i.detail ? <span> · {i.detail}</span> : null}
                    {i.taskId ? (
                      <>
                        {" · "}
                        <Link href={`${base}/tasks/${i.taskId}`} className="text-accent-text underline underline-offset-2">{i.taskId}</Link>
                      </>
                    ) : null}
                    {i.findingId ? (
                      <>
                        {" · "}
                        <Link href={`${base}/findings/${i.findingId}`} className="text-accent-text underline underline-offset-2">{i.findingId}</Link>
                      </>
                    ) : null}
                    {i.local ? " · Simulated" : ""}
                  </>
                ),
              }))}
            />
            {shown.length > 60 ? <p className="mt-3 text-helper text-fg-subtle">Showing the latest 60 of {shown.length}.</p> : null}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
