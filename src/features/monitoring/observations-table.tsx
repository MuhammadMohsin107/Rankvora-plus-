"use client";

import { useState } from "react";

import { Sparkline } from "@/components/charts/bars";
import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { ResponseButton } from "@/features/responses/response-drawer";
import { formatDate } from "@/lib/format";
import type { EventType, ObservationRow } from "@/types/monitoring";

import { EVENT_LABEL } from "./labels";
import { HistorySwitch } from "./monitoring-header";
import { useMonitoring } from "./state";

const outcomeStatus = { recommended: "recommended", mentioned: "merely_mentioned", absent: "none", uncertain: "unclear" } as const;

function LatestResult({ row }: { row: ObservationRow }) {
  const { latest } = row;
  return (
    <div className="flex flex-col items-start gap-1">
      {latest.best === "failed" ? <Status kind="job" value="failed" label="Failed (not absent)" /> : <Status kind="recommendation" value={outcomeStatus[latest.best]} />}
      <p className="tnum text-xs text-fg-subtle">
        {latest.d > 0 ? `${latest.n} / ${latest.d} samples mention` : "No successful sample"}
        {latest.failed > 0 && latest.d > 0 ? ` · ${latest.failed} failed` : ""}
      </p>
    </div>
  );
}

export function ObservationsTable({ rows }: { rows: ObservationRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;
  const groups = [...new Set(rows.map((r) => r.groupName))];
  const providers = [...new Map(rows.map((r) => [r.channelId, r.providerShort])).entries()];
  const eventTypes = [...new Set(rows.flatMap((r) => r.eventTypes))] as EventType[];

  const columns: Column<ObservationRow>[] = [
    {
      id: "prompt",
      header: "Prompt",
      sort: (r) => r.promptText,
      cell: (r) => (
        <div className="min-w-0 max-w-[18rem]">
          <p className="truncate text-body-sm text-fg" title={r.promptText}>{r.promptText}</p>
          <p className="truncate text-helper text-fg-muted">{r.groupName}</p>
        </div>
      ),
    },
    { id: "provider", header: "Provider", sort: (r) => r.providerShort, cell: (r) => <span className="whitespace-nowrap text-body-sm text-fg-muted">{r.providerShort}</span> },
    {
      id: "trend",
      header: "Mention trend",
      hideBelow: "md",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Sparkline values={r.series} width={88} height={26} />
          <span className="tnum text-xs text-fg-subtle">{r.history.length} runs</span>
        </div>
      ),
    },
    { id: "latest", header: "Latest result", sort: (r) => r.latest.n / Math.max(1, r.latest.d), cell: (r) => <LatestResult row={r} /> },
    { id: "date", header: "Latest run", hideBelow: "lg", sort: (r) => r.latestAt, cell: (r) => <span className="tnum whitespace-nowrap text-helper text-fg-muted">{formatDate(r.latestAt)}</span> },
    {
      id: "events",
      header: "Events",
      hideBelow: "2xl",
      cell: (r) =>
        r.eventTypes.length === 0 ? (
          <span className="text-fg-subtle">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {r.eventTypes.slice(0, 2).map((t) => (
              <Badge key={t}>{EVENT_LABEL[t]}</Badge>
            ))}
            {r.eventTypes.length > 2 ? <Badge>+{r.eventTypes.length - 2}</Badge> : null}
          </div>
        ),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <HistorySwitch current="prompts" />
      <DataTable
        label="Observations by prompt and provider"
        data={rows}
        rowKey={(r) => r.id}
        columns={columns}
        onRowClick={(r) => setOpenId(r.id)}
        rowLabel={(r) => `${r.promptText} on ${r.providerShort}`}
        mobileCards
        searchable={{ placeholder: "Search prompts", text: (r) => `${r.promptText} ${r.promptId}` }}
        filters={[
          { id: "provider", label: "Provider", options: providers.map(([value, label]) => ({ value, label })), value: (r) => r.channelId },
          { id: "group", label: "Prompt group", options: groups.map((g) => ({ value: g, label: g })), value: (r) => r.groupName },
          { id: "event", label: "Event type", options: eventTypes.map((t) => ({ value: t, label: EVENT_LABEL[t] })), value: (r) => r.eventTypes },
        ]}
        empty={<EmptyState icon="monitoring" title="No observations yet" />}
      />
      <Drawer open={open !== null} onClose={() => setOpenId(null)} title={open?.promptText ?? "Evidence"} description={open ? `${open.channelLabel} · market ${open.locale}` : undefined} size="lg">
        {open ? <Evidence row={open} /> : null}
      </Drawer>
    </div>
  );
}

function Evidence({ row }: { row: ObservationRow }) {
  const { data } = useMonitoring();
  const base = `/stores/${data.storeId}`;
  const samples = row.samples.map((x) => x.response);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="tnum text-helper text-fg-muted">{row.latest.d > 0 ? `${row.latest.n} / ${row.latest.d} samples mention the brand` : "No successful sample"}</span>
        <ButtonLink size="sm" href={`${base}/prompts/${row.promptId}`} icon="prompts">Open prompt</ButtonLink>
      </div>

      <section aria-label="History">
        <h3 className="mb-2 text-helper font-semibold uppercase tracking-wide text-fg-muted">Mentions per run</h3>
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-1.5 sm:grid-cols-2">
          {row.history.map((h) => (
            <li key={h.runId} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-1.5 text-body-sm">
              <span className="text-fg-muted">{h.label} · {h.runId}</span>
              <span className="tnum text-fg">
                {h.d > 0 ? `${h.n} / ${h.d}` : "No data"}
                {h.failed > 0 ? <span className="text-fg-subtle"> · {h.failed} failed</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Latest samples">
        <h3 className="mb-2 text-helper font-semibold uppercase tracking-wide text-fg-muted">Latest run · {row.latestRunId}</h3>
        <ul className="flex flex-col gap-2">
          {row.samples.map(({ sample, response }) => (
            <li key={response.id} className="rounded-control border border-line p-3">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-body-sm font-medium text-fg">
                  Sample {sample}
                  {response.status === "failed" ? <Status kind="job" value="failed" /> : <Status kind="recommendation" value={response.recommendation} />}
                </span>
                <ResponseButton response={response} samples={samples} evidence={{ promptId: row.promptId, sourceId: row.latestRunId }}>Open original answer</ResponseButton>
              </div>
              {response.status === "failed" ? (
                <Callout tone="warning">{response.failure?.message}</Callout>
              ) : (
                <p className="text-body-sm text-fg-muted">
                  {response.evidenceQuote ? `“${response.evidenceQuote}”` : `${response.answerText.replace(/\s+/g, " ").slice(0, 160)}…`}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {row.eventTypes.length > 0 ? (
        <section aria-label="Events">
          <h3 className="mb-2 text-helper font-semibold uppercase tracking-wide text-fg-muted">Events on this prompt and provider</h3>
          <div className="flex flex-wrap gap-1.5">
            {row.eventTypes.map((t) => (
              <Badge key={t}>{EVENT_LABEL[t]}</Badge>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
