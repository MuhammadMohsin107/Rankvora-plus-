import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SplitLayout } from "@/components/shell/page-header";
import { Chip, Status } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, KeyValue, Section } from "@/components/ui/card";
import { Timeline } from "@/components/ui/misc";
import { EVENT_LABEL, formatUsd } from "@/features/monitoring/labels";
import { RunsTable } from "@/features/monitoring/runs-table";
import { ScheduleHeader } from "@/features/monitoring/schedule-header";
import { When } from "@/features/monitoring/when";
import { formatDateTime, formatTime } from "@/lib/format";
import { getSchedule, listRuns, scheduleParams } from "@/services/monitoring";

export const metadata: Metadata = { title: "Schedule" };

export async function generateStaticParams() {
  return scheduleParams();
}

export default async function ScheduleDetailPage(props: PageProps<"/stores/[storeId]/monitoring/schedules/[scheduleId]">) {
  const { storeId, scheduleId } = await props.params;
  const detail = await getSchedule(storeId, scheduleId);
  if (!detail) notFound();
  const runs = (await listRuns(storeId)).filter((r) => r.scheduleId === scheduleId);
  const { row, versions, prompts, storeTimezone } = detail;
  const c = row.config;
  const tz = row.timezone;
  const base = `/stores/${storeId}/monitoring`;
  const usedBy = (version: number) => runs.filter((r) => r.scheduleVersion === version).length;
  const lastRun = runs[0];
  const localTime = row.nextRunAt && tz !== "UTC" ? `${c.localTime} = ${formatTime(row.nextRunAt)} UTC` : c.localTime;

  return (
    <>
      <ScheduleHeader storeId={storeId} row={row} />
      <SplitLayout
        main={
          <>
            <Card>
              <CardHeader title="Configuration" subtitle={`Version ${row.currentVersion} · read-only`} />
              <CardBody>
                <KeyValue
                  columns={3}
                  items={[
                    { label: "Frequency", value: row.frequencyLabel },
                    { label: "Time zone", value: tz },
                    { label: "Local run time", value: <span className="tnum">{localTime}</span> },
                    { label: "Samples per job", value: <span className="tnum">{c.samples}</span> },
                    { label: "Run window", value: <span className="tnum">{c.windowMinutes} min</span> },
                    { label: "Max concurrency", value: <span className="tnum">{c.maxConcurrency}</span> },
                    { label: "Retry", value: <span className="tnum">{c.retry.maxAttempts} attempts · {c.retry.backoffSeconds}s backoff</span> },
                    { label: "Usage cap", value: <span className="tnum">{c.usageCap.jobsPerMonth} jobs · {formatUsd(c.usageCap.costUsd)} estimate / month</span> },
                    { label: "Estimate", value: <span className="tnum">{row.jobsPerRun} jobs / run · ~{row.jobsPerMonth} / mo · ~{formatUsd(row.costPerMonthUsd)} estimate</span> },
                  ]}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Prompts" subtitle={c.promptMode === "pinned" ? "Versions pinned" : "Latest approved version"} info="Only active prompts run. Paused or archived prompts are skipped." />
              <CardBody>
                {prompts.length === 0 ? (
                  <p className="tnum text-[13px] text-fg-muted">{c.promptCount} prompts. The prompt library is not part of the demo for this store.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {prompts.map((p) => (
                      <li key={p.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                        <p className="min-w-0 text-[13px] text-fg">{p.text}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="tnum text-xs text-fg-subtle">{p.pinned ? `pinned v${p.pinned}` : `v${p.version}`}</span>
                          <Status kind="prompt" value={p.status as "active" | "paused" | "draft" | "archived"} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Providers" subtitle={`Market ${c.market} · ${c.language.toUpperCase()}`} info="API answer samples: provider API, model and search mode. They may differ from consumer apps." />
              <CardBody>
                <ul className="flex flex-col gap-2">
                  {row.channels.map((ch) => (
                    <li key={ch.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span className="text-fg">{ch.label}</span>
                      <span className="text-xs text-fg-subtle">{ch.supportsCitations ? "Returns citations" : "No citations"}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Alert rules" />
              <CardBody className="flex flex-col gap-4">
                <KeyValue
                  columns={3}
                  items={[
                    { label: "Threshold", value: c.alerts.threshold },
                    { label: "Persistence", value: c.alerts.persistence.required === 1 ? "Alert immediately" : `Confirm repeat ${c.alerts.persistence.required} of ${c.alerts.persistence.window} runs` },
                    { label: "Cooldown", value: <span className="tnum">{c.alerts.cooldownHours} h per prompt × provider</span> },
                    { label: "Quiet hours", value: c.alerts.quietHours.enabled ? <span className="tnum">{c.alerts.quietHours.from}–{c.alerts.quietHours.to} {tz}</span> : "Off" },
                    { label: "Notifications", value: [c.notify.inApp ? "In-app" : null, c.notify.email.length ? `Email (${c.notify.email.length})` : null, c.notify.webhook ? "Webhook" : null].filter(Boolean).join(" · ") || "None" },
                  ]}
                />
                <div className="flex flex-wrap gap-1.5">
                  {c.alerts.categories.map((t) => (
                    <Chip key={t}>{EVENT_LABEL[t]}</Chip>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Section title="Recent runs" actions={<Link href={`${base}/runs`} className="text-[13px] font-medium text-accent-text hover:underline">All runs</Link>}>
              <RunsTable storeId={storeId} runs={detail.recentRuns} storeTimezone={storeTimezone} compact />
            </Section>
          </>
        }
        aside={
          <>
            <Card>
              <CardHeader title="Next and last run" />
              <CardBody className="flex flex-col gap-3">
                <div>
                  <p className="text-xs text-fg-subtle">Next run</p>
                  {row.status === "active" || row.status === "needs_attention" ? <When iso={row.nextRunAt} tz={tz} /> : <p className="text-[13px] text-fg-muted">None while {row.status === "paused" ? "paused" : "cancelled"}</p>}
                </div>
                <div>
                  <p className="text-xs text-fg-subtle">Last run</p>
                  {lastRun ? (
                    <div className="flex items-start justify-between gap-2">
                      <When iso={lastRun.scheduledFor} tz={tz} />
                      <Link href={`${base}/runs/${lastRun.id}`} className="text-[13px] font-medium text-accent-text hover:underline">{lastRun.id}</Link>
                    </div>
                  ) : (
                    <p className="text-[13px] text-fg-muted">No runs yet</p>
                  )}
                </div>
                {row.statusReason ? <p className="border-t border-line pt-3 text-xs text-fg-muted">{row.statusReason}</p> : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Version history" info="Editing creates a new version. Earlier runs keep the snapshot they ran with." />
              <CardBody>
                <Timeline
                  items={versions.map((v, i) => ({
                    id: `v${v.version}`,
                    title: `Version ${v.version}${i === 0 ? " · current" : ""}`,
                    icon: i === 0 ? "circle-dot" : "history",
                    tone: i === 0 ? "accent" : "neutral",
                    time: formatDateTime(v.createdAt, storeTimezone),
                    meta: (
                      <div className="flex flex-col gap-1">
                        <ul className="list-disc pl-4">
                          {v.changes.map((change) => (
                            <li key={change}>{change}</li>
                          ))}
                        </ul>
                        <p className="text-fg-subtle">{v.createdBy} · used by {usedBy(v.version)} run{usedBy(v.version) === 1 ? "" : "s"}</p>
                      </div>
                    ),
                  }))}
                />
              </CardBody>
            </Card>
          </>
        }
      />
    </>
  );
}
