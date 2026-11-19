"use client";

import { useMemo, useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, KeyValue, Section } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Drawer } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ResponseButton } from "@/features/responses/response-inspector";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { AlertStatus, DeliveryRow, DeliveryStatus, EvidenceSide, MonitoringEvent } from "@/types/monitoring";

import { DELIVERY_ICON, DELIVERY_LABEL, EVENT_ICON, EVENT_LABEL, EVENT_TONE, SEVERITY_ORDER, SEVERITY_STATUS } from "./labels";
import { When } from "./when";

const toneBg = { neutral: "bg-surface-2 text-fg-subtle", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger", info: "bg-info-soft text-info", accent: "bg-accent-soft text-accent-text" } as const;

const DELIVERY_RANK: Record<DeliveryStatus, number> = { failed: 4, retrying: 3, pending: 2, sent: 1 };

function DeliveryCell({ delivery }: { delivery: DeliveryRow[] }) {
  const worst = [...delivery].sort((a, b) => DELIVERY_RANK[b.status] - DELIVERY_RANK[a.status])[0];
  const same = delivery.filter((d) => d.status === worst.status);
  const label = worst.status === "sent" && same.length === delivery.length ? `Sent · ${delivery.length}` : `${worst.status === "sent" ? "Sent" : STATUS.delivery[worst.status].label} · ${same.map((d) => DELIVERY_LABEL[d.channel].toLowerCase()).join(", ")}`;
  return <Status kind="delivery" value={worst.status} label={label} />;
}

type Handlers = { setStatus: (alertId: string, status: AlertStatus) => void };

function actionItems(event: MonitoringEvent, status: AlertStatus, { setStatus }: Handlers): MenuItem[] {
  const id = event.alert?.id ?? "";
  const closed = status === "resolved" || status === "muted";
  return [
    { label: "Acknowledge", icon: "check", onSelect: () => setStatus(id, "acknowledged"), disabled: closed || status === "acknowledged", disabledReason: closed ? "Already closed" : "Already acknowledged" },
    { label: "Mute", icon: "eye-off", onSelect: () => setStatus(id, "muted"), disabled: status === "muted" || status === "resolved", disabledReason: "Already closed" },
    { label: "Resolve", icon: "check-circle", onSelect: () => setStatus(id, "resolved"), disabled: status === "resolved", disabledReason: "Already resolved" },
  ];
}

function EvidenceCard({ side, tone }: { side: EvidenceSide; tone: "previous" | "current" }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-control border p-3", tone === "current" ? "border-accent/40 bg-accent-soft/30" : "border-line bg-surface")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{side.label}</p>
      <p className="flex items-start gap-1.5 text-[13px] font-medium text-fg">
        <span aria-hidden="true" className={cn("mt-1 size-2 shrink-0 rounded-full", { neutral: "bg-fg-subtle", success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info" }[side.tone])} />
        {side.summary}
      </p>
      {side.excerpt ? <blockquote className="border-l-2 border-line-strong pl-2.5 text-xs italic text-fg-muted">“{side.excerpt}”</blockquote> : null}
      {side.response ? <ResponseButton response={side.response}>View response</ResponseButton> : null}
    </div>
  );
}

function EventDrawerBody({ event, status, tz }: { event: MonitoringEvent; status: AlertStatus | null; tz: string }) {
  const toast = useToast();
  const alert = event.alert;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {alert ? <Status kind="severity" value={SEVERITY_STATUS[alert.severity]} /> : null}
        {status ? <Status kind="alert" value={status} /> : <Badge>No alert raised</Badge>}
        <Badge icon={EVENT_ICON[event.type]}>{EVENT_LABEL[event.type]}</Badge>
        <span className="tnum text-xs text-fg-subtle">{formatDateTime(event.at, tz)} · {event.runId}</span>
      </div>
      <p className="text-[13px] text-fg-muted">{event.summary}</p>

      <section aria-label="Evidence">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Evidence</h3>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          {event.previous ? <EvidenceCard side={event.previous} tone="previous" /> : <div className="rounded-control border border-dashed border-line-strong p-3 text-[13px] text-fg-muted">No earlier result to compare.</div>}
          <EvidenceCard side={event.current} tone="current" />
        </div>
        {event.note ? <p className="mt-2 text-xs text-fg-subtle">{event.note}</p> : null}
      </section>

      {alert?.persistence ? (
        <Callout tone="info" title={alert.persistence.rule}>{alert.persistence.progress}</Callout>
      ) : null}

      {alert ? (
        <>
          <section aria-label="Delivery">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Delivery</h3>
            <ul className="divide-y divide-line rounded-control border border-line">
              {alert.delivery.map((d) => (
                <li key={d.channel} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="flex items-center gap-2 text-[13px] text-fg"><Icon name={DELIVERY_ICON[d.channel]} size={15} className="text-fg-subtle" />{DELIVERY_LABEL[d.channel]}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-fg-subtle">{d.detail}</span>
                    <Status kind="delivery" value={d.status} />
                    {d.status === "failed" ? <Button size="sm" variant="secondary" icon="refresh" onClick={() => toast.push({ title: "Delivery retried", description: `${DELIVERY_LABEL[d.channel]} will be sent again. (Demo)`, tone: "info" })}>Retry</Button> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <KeyValue
            columns={1}
            items={[
              { label: "Dedupe and cooldown", value: alert.cooldown },
              { label: "Alert id", value: <span className="tnum">{alert.id}</span> },
              ...(alert.handledBy ? [{ label: "Handled by", value: alert.handledBy }] : []),
            ]}
          />
        </>
      ) : (
        <Callout tone="neutral">This event did not match an alert rule, so nothing was sent. It stays in the event log.</Callout>
      )}
    </div>
  );
}

export function AlertsInbox({ events, storeTimezone }: { events: MonitoringEvent[]; storeTimezone: string }) {
  const toast = useToast();
  const [mode, setMode] = useState<"alerts" | "events">("alerts");
  const [overrides, setOverrides] = useState<Record<string, { status: AlertStatus; by: string }>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const statusOf = (e: MonitoringEvent): AlertStatus | null => (e.alert ? (overrides[e.alert.id]?.status ?? e.alert.status) : null);

  const setStatus = (alertId: string, status: AlertStatus) => {
    setOverrides((current) => ({ ...current, [alertId]: { status, by: "You" } }));
    const text = { acknowledged: "Alert acknowledged", muted: "Alert muted", resolved: "Alert resolved", read: "Marked read", new: "Reopened" }[status];
    toast.push({ title: text, description: status === "muted" ? "No new alerts for this prompt and provider until the cooldown ends. (Demo)" : "Saved on the alert history. (Demo)", tone: "success" });
  };
  const handlers: Handlers = { setStatus };

  const shown = useMemo(() => events.filter((e) => mode === "events" || e.alert), [events, mode]);
  const visibility = shown.filter((e) => e.category === "visibility");
  const quality = shown.filter((e) => e.category === "data_quality");
  const openCount = events.filter((e) => e.alert && !["resolved", "muted"].includes(statusOf(e) ?? "")).length;
  const alertCount = events.filter((e) => e.alert).length;
  const open = events.find((e) => e.id === openId) ?? null;

  const makeColumns = (): Column<MonitoringEvent>[] => [
    {
      id: "event",
      header: "Event",
      sort: (e) => e.title,
      cell: (e) => (
        <div className="flex min-w-0 items-start gap-2.5">
          <span aria-hidden="true" className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", toneBg[EVENT_TONE[e.type]])}><Icon name={EVENT_ICON[e.type]} size={13} /></span>
          <div className="min-w-0 max-w-[26rem]">
            <button type="button" onClick={() => setOpenId(e.id)} className="block max-w-full cursor-pointer truncate rounded text-left text-[13px] font-medium text-fg hover:text-accent-text hover:underline" title={e.title}>{e.title}</button>
            <p className="truncate text-xs text-fg-subtle">{EVENT_LABEL[e.type]}{e.providerShort ? ` · ${e.providerShort}` : ""} · {e.runId}</p>
          </div>
        </div>
      ),
    },
    { id: "severity", header: "Severity", sort: (e) => (e.alert ? SEVERITY_ORDER[e.alert.severity] : 0), cell: (e) => (e.alert ? <Status kind="severity" value={SEVERITY_STATUS[e.alert.severity]} /> : <span className="text-xs text-fg-subtle">No alert</span>) },
    { id: "status", header: "Status", sort: (e) => statusOf(e) ?? "", cell: (e) => { const s = statusOf(e); return s ? <Status kind="alert" value={s} /> : <span className="text-fg-subtle">—</span>; } },
    { id: "delivery", header: "Delivery", hideBelow: "lg", cell: (e) => (e.alert ? <DeliveryCell delivery={e.alert.delivery} /> : <span className="text-fg-subtle">—</span>) },
    { id: "when", header: "Detected", hideBelow: "sm", sort: (e) => e.at, cell: (e) => <When iso={e.at} tz={storeTimezone} /> },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (e) =>
        e.alert && statusOf(e) ? (
          <Menu trigger={<IconButton icon="more" label={`Actions for ${e.title}`} size="sm" />} items={[{ label: "View evidence", icon: "eye", onSelect: () => setOpenId(e.id) }, { type: "separator" }, ...actionItems(e, statusOf(e) as AlertStatus, handlers)]} />
        ) : (
          <IconButton icon="eye" label={`View evidence for ${e.title}`} size="sm" onClick={() => setOpenId(e.id)} />
        ),
    },
  ];

  const filters = [
    { id: "severity", label: "Severity", options: [{ value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }, { value: "info", label: "Informational" }], value: (e: MonitoringEvent) => e.alert?.severity ?? "" },
    { id: "status", label: "Status", options: Object.entries(STATUS.alert).map(([value, meta]) => ({ value, label: meta.label })), value: (e: MonitoringEvent) => statusOf(e) ?? "" },
    { id: "type", label: "Type", options: [...new Set(events.map((e) => e.type))].map((t) => ({ value: t, label: EVENT_LABEL[t] })), value: (e: MonitoringEvent) => e.type },
  ];

  if (events.length === 0) return <EmptyState icon="bell" title="No alerts yet" description="Changes between runs are listed here." />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show"
          value={mode}
          onChange={setMode}
          options={[
            { value: "alerts", label: "Alerts", count: alertCount },
            { value: "events", label: "All events", count: events.length },
          ]}
        />
        <p className="tnum text-[13px] text-fg-muted">{openCount} open</p>
      </div>

      <Section title="Visibility changes">
        <DataTable label="Visibility alerts and events" data={visibility} rowKey={(e) => e.id} columns={makeColumns()} filters={filters} defaultSort={{ column: "when", dir: "desc" }} pageSize={10} empty={<EmptyState icon="bell" title="Nothing here" />} />
      </Section>

      <Section title="Provider and data quality">
        <DataTable label="Provider and data-quality alerts and events" data={quality} rowKey={(e) => e.id} columns={makeColumns()} defaultSort={{ column: "when", dir: "desc" }} pageSize={5} empty={<EmptyState icon="check-circle" title="No provider or data-quality issues" />} />
      </Section>

      <Drawer
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open?.title ?? "Alert"}
        size="lg"
        footer={
          open?.alert && statusOf(open) ? (
            <>
              <Button icon="check" disabled={["acknowledged", "resolved", "muted"].includes(statusOf(open) as string)} onClick={() => setStatus(open.alert!.id, "acknowledged")}>Acknowledge</Button>
              <Button icon="eye-off" disabled={["muted", "resolved"].includes(statusOf(open) as string)} onClick={() => setStatus(open.alert!.id, "muted")}>Mute</Button>
              <Button variant="primary" icon="check-circle" disabled={statusOf(open) === "resolved"} onClick={() => setStatus(open.alert!.id, "resolved")}>Resolve</Button>
            </>
          ) : undefined
        }
      >
        {open ? <EventDrawerBody event={open} status={statusOf(open)} tz={storeTimezone} /> : null}
      </Drawer>
    </div>
  );
}
