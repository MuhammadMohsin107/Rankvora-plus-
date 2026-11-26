"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, KeyValue } from "@/components/ui/card";
import { DateRange, makeRange, type DateRangeValue } from "@/components/ui/date-range";
import { EmptyState } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Drawer } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { simulatedToast, useDemoSettings } from "@/demo-state";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import { ResponseButton } from "@/features/responses/response-drawer";
import { cn } from "@/lib/cn";
import { DEMO_NOW, formatDateTime } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { AlertStatus, DeliveryChannel, DeliveryStatus, EvidenceSide, MonitoringEvent } from "@/types/monitoring";

import { DELIVERY_ICON, DELIVERY_LABEL, EVENT_ICON, EVENT_LABEL, EVENT_TONE, SEVERITY_ORDER, SEVERITY_STATUS, eventMeta, titleHasType } from "./labels";
import { NoSchedules } from "./no-schedules";
import { monitoringNow, useMonitoring } from "./state";
import { When } from "./when";

const toneBg = { neutral: "bg-surface-2 text-fg-muted", success: "bg-success-soft text-success-text", warning: "bg-warning-soft text-warning-text", danger: "bg-danger-soft text-danger-text", info: "bg-info-soft text-info-text", accent: "bg-accent-soft text-accent-text" } as const;
const ANCHOR = DEMO_NOW.slice(0, 10);

type Handled = { action: string; by: string; at: string };
type Log = Record<string, Handled>;
const NO_LOG: Log = {};
type Deliveries = Record<string, DeliveryStatus>;
const NO_DELIVERIES: Deliveries = {};

function EvidenceCard({ side, current, evidence }: { side: EvidenceSide; current: boolean; evidence: { promptId: string | null; runId: string } }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-control border p-3", current ? "border-accent/40 bg-accent-soft/30" : "border-line bg-surface")}>
      <p className="text-helper font-semibold uppercase tracking-wide text-fg-muted">{side.label}</p>
      <p className="text-body-sm font-medium text-fg">{side.summary}</p>
      {side.excerpt ? <blockquote className="border-l-2 border-line-strong pl-2.5 text-helper italic text-fg-muted">“{side.excerpt}”</blockquote> : null}
      {side.response ? <ResponseButton response={side.response} evidence={{ promptId: evidence.promptId ?? undefined, sourceId: evidence.runId }}>View response</ResponseButton> : null}
    </div>
  );
}

/** Chips that say whether the two sides compare like with like (prompt version, provider, market). */
function Comparability({ event }: { event: MonitoringEvent }) {
  const a = event.previous?.response;
  const b = event.current.response;
  if (!a || !b) return null;
  const checks = [
    { ok: a.promptId === b.promptId && a.promptVersion === b.promptVersion, ok_label: `Same prompt v${b.promptVersion}`, bad: `Prompt version changed v${a.promptVersion} → v${b.promptVersion}` },
    { ok: a.channelId === b.channelId && a.model === b.model, ok_label: "Same provider and model", bad: "Provider or model changed" },
    { ok: a.market === b.market && a.language === b.language, ok_label: "Same market", bad: "Market or language changed" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Comparability">
      {checks.map((c) => (
        <Badge key={c.ok_label} tone={c.ok ? "success" : "warning"} icon={c.ok ? "check" : "alert-triangle"}>{c.ok ? c.ok_label : c.bad}</Badge>
      ))}
    </div>
  );
}

type Row = MonitoringEvent & { liveStatus: AlertStatus | null };

export function AlertsInbox({ events, storeTimezone }: { events: MonitoringEvent[]; storeTimezone: string }) {
  const api = useMonitoring();
  const { alerts, base, data, openRunNow, schedules } = api;
  const toast = useToast();
  const search = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(search.get("event"));
  const [category, setCategory] = useState<"all" | "visibility" | "data_quality">("all");
  const [range, setRange] = useState<DateRangeValue>(() => makeRange("90d", ANCHOR));
  const log = useDemoSettings<Log>(`monitoring.alert-log.${data.storeId}`, NO_LOG);

  const statusById = useMemo(() => new Map(alerts.rows.map((a) => [a.id, a.status])), [alerts.rows]);
  const rows = useMemo<Row[]>(
    () => events.map((e) => ({ ...e, liveStatus: e.alert ? ((statusById.get(e.alert.id) as AlertStatus | undefined) ?? e.alert.status) : null })),
    [events, statusById],
  );

  if (schedules.length === 0) return <NoSchedules />;

  const open = rows.find((e) => e.id === openId) ?? null;
  const dismissedFromList = (e: MonitoringEvent) => e.alert !== null && !statusById.has(e.alert.id);

  const record = (alertId: string, action: string) => log.patch({ [alertId]: { action, by: "You", at: formatDateTime(monitoringNow()) } });
  const act = (e: MonitoringEvent, kind: "read" | "unread" | "acknowledge" | "mute" | "dismiss") => {
    if (!e.alert) return;
    const id = e.alert.id;
    if (kind === "read") alerts.markRead(id);
    else if (kind === "unread") alerts.markUnread(id);
    else if (kind === "acknowledge") alerts.acknowledge(id);
    else if (kind === "mute") alerts.mute(id);
    else alerts.resolve(id);
    if (kind !== "read" && kind !== "unread") {
      record(id, { acknowledge: "Acknowledged", mute: "Muted", dismiss: "Dismissed" }[kind]);
      toast.push(simulatedToast({ acknowledge: "alert.acknowledged", mute: "alert.muted", dismiss: "Alert dismissed" }[kind]));
    }
  };

  const openEvent = (e: Row) => {
    setOpenId(e.id);
    if (e.alert && e.liveStatus === "new") alerts.markRead(e.alert.id);
  };

  const menuFor = (e: Row): MenuItem[] => {
    const s = e.liveStatus;
    if (!e.alert || !s) return [{ label: "Open", icon: "eye", onSelect: () => openEvent(e) }];
    const closed = s === "resolved" || s === "muted";
    return [
      s === "new" ? { label: "Mark read", icon: "eye", onSelect: () => act(e, "read") } : { label: "Mark unread", icon: "circle-dot", onSelect: () => act(e, "unread"), disabled: closed, disabledReason: "Already closed" },
      { label: "Acknowledge", icon: "check", onSelect: () => act(e, "acknowledge"), disabled: closed || s === "acknowledged", disabledReason: "Already handled" },
      { label: "Mute", icon: "eye-off", onSelect: () => act(e, "mute"), disabled: closed, disabledReason: "Already closed" },
      { label: "Dismiss", icon: "check-circle", onSelect: () => act(e, "dismiss"), disabled: s === "resolved", disabledReason: "Already dismissed" },
    ];
  };

  const inScope = rows.filter(
    (e) =>
      !dismissedFromList(e) &&
      (category === "all" || e.category === category) &&
      e.at.slice(0, 10) >= range.from &&
      (range.preset !== "custom" || e.at.slice(0, 10) <= range.to),
  );
  const count = (c: "visibility" | "data_quality") => rows.filter((e) => e.category === c).length;

  const columns: Column<Row>[] = [
    {
      id: "event",
      header: "Event",
      sort: (e) => e.title,
      cell: (e) => (
        <div className="flex min-w-0 items-start gap-2.5">
          <span aria-hidden="true" className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", toneBg[EVENT_TONE[e.type]])}><Icon name={EVENT_ICON[e.type]} size={13} /></span>
          <div className="min-w-0 max-w-[26rem]">
            <button type="button" onClick={() => openEvent(e)} className={cn("block max-w-full cursor-pointer truncate rounded text-left text-body-sm text-fg hover:text-accent-text hover:underline", e.liveStatus === "new" ? "font-semibold" : "font-medium")} title={e.title}>
              {e.liveStatus === "new" ? <span className="sr-only">Unread: </span> : null}
              {e.title}
            </button>
            <p className="truncate text-helper text-fg-muted">{eventMeta(e)}</p>
          </div>
        </div>
      ),
    },
    { id: "severity", header: "Severity", sort: (e) => (e.alert ? SEVERITY_ORDER[e.alert.severity] : 0), cell: (e) => (e.alert ? <Status kind="severity" value={SEVERITY_STATUS[e.alert.severity]} /> : <span className="text-helper text-fg-muted">No alert</span>) },
    { id: "status", header: "Status", sort: (e) => e.liveStatus ?? "", cell: (e) => (e.liveStatus ? <Status kind="alert" value={e.liveStatus} /> : <span className="text-fg-subtle">—</span>) },
    { id: "when", header: "Detected", hideBelow: "sm", sort: (e) => e.at, cell: (e) => <When iso={e.at} tz={storeTimezone} /> },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (e) => <Menu trigger={<IconButton icon="more" label={`Actions for ${e.title}`} size="sm" />} items={menuFor(e)} />,
    },
  ];

  const channels = [...new Map(events.filter((e) => e.channelId).map((e) => [e.channelId as string, e.providerShort ?? (e.channelId as string)])).entries()];
  const promptsOf = [...new Map(events.filter((e) => e.promptId).map((e) => [e.promptId as string, e.promptText ?? (e.promptId as string)])).entries()];
  const filters = [
    { id: "severity", label: "Severity", options: [{ value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }, { value: "info", label: "Informational" }], value: (e: Row) => e.alert?.severity ?? "" },
    { id: "status", label: "Status", options: [...Object.entries(STATUS.alert).map(([value, meta]) => ({ value, label: meta.label })), { value: "none", label: "No alert" }], value: (e: Row) => e.liveStatus ?? "none" },
    { id: "type", label: "Type", options: [...new Set(events.map((e) => e.type))].map((t) => ({ value: t, label: EVENT_LABEL[t] })), value: (e: Row) => e.type },
    { id: "provider", label: "Provider", options: channels.map(([value, label]) => ({ value, label })), value: (e: Row) => e.channelId ?? "" },
    { id: "prompt", label: "Prompt", options: promptsOf.map(([value, label]) => ({ value, label: label.slice(0, 48) })), value: (e: Row) => e.promptId ?? "" },
  ];

  if (events.length === 0) return <EmptyState icon="bell" title="No alerts yet" />;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Segmented
        label="Category"
        value={category}
        onChange={setCategory}
        options={[
          { value: "all", label: "All", count: rows.length },
          { value: "visibility", label: "Visibility", count: count("visibility") },
          { value: "data_quality", label: "Data quality", count: count("data_quality") },
        ]}
      />
      <DataTable
        label="Alerts and events"
        data={inScope}
        rowKey={(e) => e.id}
        columns={columns}
        pageSize={10}
        mobileCards
        filters={filters}
        searchable={{ placeholder: "Search alerts", text: (e) => `${e.title} ${e.promptText ?? ""}` }}
        toolbarExtra={<DateRange value={range} onChange={setRange} anchorDate={ANCHOR} presets={["7d", "30d", "90d"]} align="end" />}
        empty={<EmptyState icon="bell" title="Nothing here" />}
      />
      <Drawer
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open?.title ?? "Alert"}
        size="lg"
        footer={
          open?.alert && open.liveStatus ? (
            <>
              <Button icon="check" disabled={["acknowledged", "resolved", "muted"].includes(open.liveStatus)} onClick={() => act(open, "acknowledge")}>Acknowledge</Button>
              <Button icon="eye-off" disabled={["muted", "resolved"].includes(open.liveStatus)} onClick={() => act(open, "mute")}>Mute</Button>
              <Button variant="primary" icon="check-circle" disabled={open.liveStatus === "resolved"} onClick={() => act(open, "dismiss")}>Dismiss</Button>
            </>
          ) : undefined
        }
      >
        {open ? <EventDrawerBody event={open} status={open.liveStatus} tz={storeTimezone} handled={open.alert ? log.value[open.alert.id] : undefined} base={base} storeId={data.storeId} onVerify={() => openRunNow({ purpose: open.taskId ? "verification" : "manual", taskId: open.taskId ?? undefined, findingId: open.findingId ?? undefined })} /> : null}
      </Drawer>
    </div>
  );
}

function EventDrawerBody({ event, status, tz, handled, base, storeId, onVerify }: { event: MonitoringEvent; status: AlertStatus | null; tz: string; handled?: Handled; base: string; storeId: string; onVerify: () => void }) {
  const toast = useToast();
  const alert = event.alert;
  const deliveries = useDemoSettings<Deliveries>(`monitoring.delivery.${alert?.id ?? "none"}`, NO_DELIVERIES);
  const evidence = { promptId: event.promptId, runId: event.runId };

  const retry = (channel: DeliveryChannel) => {
    deliveries.patch({ [channel]: "retrying" });
    window.setTimeout(() => {
      deliveries.patch({ [channel]: "sent" });
      toast.push(simulatedToast(`${DELIVERY_LABEL[channel]} delivery recorded as sent`, "success"));
    }, 1200);
  };

  const audit = `/stores/${storeId}/audits/new?recheck=${encodeURIComponent(event.promptId ?? "")}&provider=${encodeURIComponent(event.channelId ?? "")}&from=${encodeURIComponent(event.runId)}&event=${encodeURIComponent(event.id)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {alert ? <Status kind="severity" value={SEVERITY_STATUS[alert.severity]} /> : null}
        {status ? <Status kind="alert" value={status} /> : null}
        {titleHasType(event) ? null : <Badge icon={EVENT_ICON[event.type]}>{EVENT_LABEL[event.type]}</Badge>}
        <Link href={`${base}/runs/${event.runId}`} className="tnum text-helper text-accent-text hover:underline">{event.runId}</Link>
        <span className="tnum text-helper text-fg-muted">{formatDateTime(event.at, tz)}</span>
      </div>
      <p className="text-body-sm text-fg-muted">{event.summary}</p>

      <section aria-label="Evidence">
        <h3 className="mb-2 text-helper font-semibold uppercase tracking-wide text-fg-muted">Evidence</h3>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          {event.previous ? <EvidenceCard side={event.previous} current={false} evidence={evidence} /> : <div className="rounded-control border border-dashed border-line-strong p-3 text-body-sm text-fg-muted">No earlier result to compare.</div>}
          <EvidenceCard side={event.current} current evidence={evidence} />
        </div>
        <div className="mt-3"><Comparability event={event} /></div>
        {event.note ? <p className="mt-2 text-helper text-fg-muted">{event.note}</p> : null}
      </section>

      {alert?.persistence ? <Callout tone="info" title={alert.persistence.rule}>{alert.persistence.progress}</Callout> : null}

      <section aria-label="Related">
        <h3 className="mb-2 text-helper font-semibold uppercase tracking-wide text-fg-muted">Related</h3>
        <EvidenceTrace
          className="mb-3"
          ids={{ storeId, sourceId: event.runId, promptId: event.promptId ?? undefined, responseId: event.current.response?.id, findingId: event.findingId ?? undefined, taskId: event.taskId ?? undefined, observationId: event.runId }}
          variant="full"
        />
        <div className="flex flex-wrap items-center gap-2">
          {event.promptId ? <Link href={audit} className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line-strong px-3 text-label font-medium text-fg hover:bg-surface-2 pointer-coarse:h-11"><Icon name="audit" size={14} />Focused re-check</Link> : null}
          {event.taskId ? <Button size="sm" icon="play" onClick={onVerify}>Verification run</Button> : null}
        </div>
        {!event.findingId ? <p className="mt-2 text-helper text-fg-muted">No finding linked to this event.</p> : null}
      </section>

      {alert ? (
        <>
          <section aria-label="Delivery">
            <h3 className="mb-2 text-helper font-semibold uppercase tracking-wide text-fg-muted">Delivery</h3>
            <ul className="divide-y divide-line rounded-control border border-line">
              {alert.delivery.map((d) => {
                const live = deliveries.value[d.channel] ?? d.status;
                return (
                  <li key={d.channel} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="flex items-center gap-2 text-body-sm text-fg"><Icon name={DELIVERY_ICON[d.channel]} size={15} className="text-fg-subtle" />{DELIVERY_LABEL[d.channel]}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-helper text-fg-muted">{d.detail}</span>
                      <Status kind="delivery" value={live} />
                      {live === "failed" ? <Button size="sm" variant="secondary" icon="refresh" onClick={() => retry(d.channel)}>Retry</Button> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          <details className="text-body-sm">
            <summary className="cursor-pointer text-fg-muted">Details</summary>
            <div className="mt-3">
              <KeyValue
                columns={1}
                items={[
                  { label: "Alert id", value: <span className="tnum">{alert.id}</span> },
                  { label: "Dedupe and cooldown", value: alert.cooldown },
                  ...(handled ? [{ label: "Handled by", value: `${handled.action} by ${handled.by} · ${handled.at} UTC` }] : alert.handledBy ? [{ label: "Handled by", value: alert.handledBy }] : []),
                ]}
              />
            </div>
          </details>
        </>
      ) : (
        <Callout tone="neutral">No alert was sent.</Callout>
      )}
    </div>
  );
}
