"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Chip, Status } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue, Section } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Menu } from "@/components/ui/menu";
import { Timeline } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { ScheduleRec } from "@/types/monitoring";

import { EVENT_LABEL, formatUsd } from "./labels";
import { RunsTable } from "./runs-table";
import { utcTimeFor } from "./schedule-logic";
import { CancelScheduleDialog, scheduleMenuItems } from "./schedules-table";
import { useMonitoring } from "./state";
import { When } from "./when";

function useSchedule(scheduleId: string): ScheduleRec | undefined {
  return useMonitoring().schedules.find((s) => s.id === scheduleId);
}

/** Header of the edit page. The form below it resolves the same id. */
export function EditScheduleHeader({ scheduleId }: { scheduleId: string }) {
  const rec = useSchedule(scheduleId);
  return <PageHeader title={rec ? `Edit ${rec.name}` : "Edit schedule"} />;
}

/** Schedule detail. Seeded and locally created schedules both render from the shared client state. */
export function ScheduleDetail({ scheduleId }: { scheduleId: string }) {
  const api = useMonitoring();
  const router = useRouter();
  const { base, runs, prompts, data } = api;
  const rec = useSchedule(scheduleId);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!rec) {
    return (
      <>
        <PageHeader title="Schedule" />
        <EmptyState icon="search" title="Schedule not found" headingAs="h1" description="It may have been created in another browser." action={<ButtonLink href={`${base}/schedules`}>All schedules</ButtonLink>} />
      </>
    );
  }

  const c = rec.config;
  const cancelled = rec.status === "cancelled";
  const draft = rec.status === "draft";
  const mine = runs.filter((r) => r.scheduleId === rec.id);
  const usedBy = (version: number) => mine.filter((r) => r.scheduleVersion === version).length;
  const utc = utcTimeFor(c.localTime, c.timezone);
  const stateButton = draft ? (
    <Button icon="play" onClick={() => api.activateSchedule(rec.id)}>Activate</Button>
  ) : rec.status === "paused" ? (
    <Button icon="play" onClick={() => api.resumeSchedule(rec.id)}>Resume</Button>
  ) : (
    <Button icon="pause" disabled={cancelled} onClick={() => api.pauseSchedule(rec.id)}>Pause</Button>
  );

  const promptRows = c.promptIds.map((id) => {
    const p = prompts.find((x) => x.id === id);
    return { id, text: p?.text ?? id, status: p?.status ?? "active", pinned: c.pinnedVersions[id] ?? null, version: p?.version ?? 1 };
  });

  const overview = (
    <div className="flex flex-col gap-6">
      {rec.statusReason ? <Callout tone={rec.status === "needs_attention" ? "warning" : "neutral"}>{rec.statusReason}</Callout> : null}
      <Card>
        <CardBody>
          <KeyValue
            columns={3}
            items={[
              { label: "Frequency", value: rec.frequencyLabel },
              { label: "Time zone", value: <span className="tnum">{c.timezone}{utc && c.timezone !== "UTC" ? ` · ${utc} UTC` : ""}</span> },
              { label: "Next run", value: rec.status === "active" || rec.status === "needs_attention" ? <When iso={rec.nextRunAt} tz={data.timezone} detail /> : <span className="text-fg-muted">{draft ? "Not scheduled yet" : "—"}</span> },
              { label: "Covers", value: <span className="tnum">{rec.activePromptCount} prompts × {rec.channels.length} providers × {rec.samples} samples</span> },
              { label: "Providers", value: rec.channels.map((ch) => ch.providerLabel).join(", ") || "—" },
              { label: "Estimate", value: <span className="tnum">{rec.jobsPerRun} jobs a run · ~{formatNumber(rec.jobsPerMonth)} a month · ~{formatUsd(rec.costPerMonthUsd)}</span> },
            ]}
          />
        </CardBody>
      </Card>
      <Section title="Recent runs" actions={<Link href={`${base}/runs`} className="text-label font-medium text-accent-text hover:underline">All runs</Link>}>
        <RunsTable runs={mine.slice(0, 5)} compact />
      </Section>
    </div>
  );

  const settings = (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Run settings" />
        <CardBody>
          <KeyValue
            columns={3}
            items={[
              { label: "Run window", value: <span className="tnum">{c.windowMinutes} min</span> },
              { label: "Max concurrency", value: <span className="tnum">{c.maxConcurrency}</span> },
              { label: "Retry", value: <span className="tnum">{c.retry.maxAttempts} attempts · {c.retry.backoffSeconds}s backoff</span> },
              { label: "Market · language", value: <span className="tnum">{c.market} · {c.language.toUpperCase()}</span> },
              { label: "Usage cap", value: <span className="tnum">{formatNumber(c.usageCap.jobsPerMonth)} jobs · {formatUsd(c.usageCap.costUsd)} a month</span> },
              { label: "Prompt version", value: c.promptMode === "pinned" ? "Pinned" : "Latest approved" },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Prompts" subtitle={`${promptRows.length} selected`} info="Only active prompts run. Paused or archived prompts are skipped." />
        <CardBody>
          <ul className="divide-y divide-line">
            {promptRows.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <Link href={`/stores/${data.storeId}/prompts/${p.id}`} className="min-w-0 text-body-sm text-fg hover:text-accent-text hover:underline">{p.text}</Link>
                <span className="flex shrink-0 items-center gap-2">
                  {p.pinned && p.pinned !== p.version ? (
                    <span className="tnum text-helper font-medium text-warning-text">pinned v{p.pinned} · latest v{p.version}</span>
                  ) : (
                    <span className="tnum text-helper text-fg-muted">{p.pinned ? `pinned v${p.pinned}` : `v${p.version}`}</span>
                  )}
                  {p.status === "active" ? null : <Status kind="prompt" value={p.status} />}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Alerts" />
        <CardBody className="flex flex-col gap-4">
          <KeyValue
            columns={3}
            items={[
              { label: "Threshold", value: c.alerts.threshold },
              { label: "Persistence", value: c.alerts.persistence.required === 1 ? "Alert immediately" : `Confirm repeat ${c.alerts.persistence.required} of ${c.alerts.persistence.window} runs` },
              { label: "Cooldown", value: <span className="tnum">{c.alerts.cooldownHours} h</span> },
              { label: "Quiet hours", value: c.alerts.quietHours.enabled ? <span className="tnum">{c.alerts.quietHours.from}–{c.alerts.quietHours.to}</span> : "Off" },
              { label: "Sent to", value: [c.notify.inApp ? "In-app" : null, c.notify.email.length ? `Email (${c.notify.email.length})` : null, c.notify.webhook ? "Webhook" : null].filter(Boolean).join(" · ") || "Nobody" },
            ]}
          />
          <details className="text-body-sm">
            <summary className="cursor-pointer text-fg-muted">{c.alerts.categories.length} event types</summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.alerts.categories.map((t) => (
                <Chip key={t}>{EVENT_LABEL[t]}</Chip>
              ))}
            </div>
          </details>
        </CardBody>
      </Card>
    </div>
  );

  const versions = (
    <Card>
      <CardBody>
        <Timeline
          items={rec.versions.map((v, i) => ({
            id: `v${v.version}`,
            title: `Version ${v.version}${i === 0 ? " · current" : ""}`,
            icon: i === 0 ? "circle-dot" : "history",
            tone: i === 0 ? "accent" : "neutral",
            time: formatDateTime(v.createdAt, data.timezone),
            meta: (
              <div className="flex flex-col gap-1">
                <ul className="list-disc pl-4">
                  {v.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
                <p className="text-fg-muted">{v.createdBy} · used by {usedBy(v.version)} run{usedBy(v.version) === 1 ? "" : "s"}</p>
              </div>
            ),
          }))}
        />
      </CardBody>
    </Card>
  );

  return (
    <>
      {!cancelled ? (
        <HeaderAction>
          <ButtonLink href={`${base}/schedules/${rec.id}/edit`} variant="primary" icon="pencil">Edit</ButtonLink>
        </HeaderAction>
      ) : null}
      <PageHeader
        title={rec.name}
        meta={<Status kind="schedule" value={rec.status} />}
        actions={
          <>
            <Button icon="bolt" disabled={cancelled || draft} onClick={() => api.openRunNow({ scheduleId: rec.id })}>Run now</Button>
            {stateButton}
            <Menu
              trigger={<IconButton icon="more" label="More actions" variant="secondary" />}
              items={scheduleMenuItems({ row: rec, api, onCancel: () => setCancelOpen(true), onDuplicated: (id) => router.push(`${base}/schedules/${id}/edit`), secondaryOnly: true })}
            />
          </>
        }
      />
      <Tabs
        label="Schedule sections"
        tabs={[
          { id: "overview", label: "Overview", content: overview },
          { id: "settings", label: "Settings", content: settings },
          { id: "versions", label: "Versions", count: rec.versions.length, content: versions },
        ]}
        panelClassName="pt-6"
      />
      <CancelScheduleDialog
        name={rec.name}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          api.cancelSchedule(rec.id);
          setCancelOpen(false);
        }}
      />
    </>
  );
}
