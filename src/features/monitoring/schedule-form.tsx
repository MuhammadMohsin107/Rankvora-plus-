"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Switch } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";
import type { EventType, FrequencyKind, ScheduleConfig, ScheduleRec } from "@/types/monitoring";

import { EVENT_LABEL, WEEKDAY_LABEL, formatUsd } from "./labels";
import { estimateSchedule, observesDst, parseCron, runsPerMonthOf, utcTimeFor } from "./schedule-logic";
import { useMonitoring } from "./state";

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

type Persistence = "1of1" | "2of3" | "3of3";
const PERSISTENCE: Record<Persistence, { required: number; window: number; label: string }> = {
  "1of1": { required: 1, window: 1, label: "Alert immediately" },
  "2of3": { required: 2, window: 3, label: "Confirm repeat 2 of 3 runs" },
  "3of3": { required: 3, window: 3, label: "Confirm repeat 3 of 3 runs" },
};

const VISIBILITY: EventType[] = ["new_mention", "lost_mention", "new_recommendation", "lost_recommendation", "owned_citation_gained", "owned_citation_lost", "sentiment_shift", "sentiment_share_change", "competitor_increase", "competitor_decrease", "competitor_mention_change", "rank_movement", "brand_fact_error"];
const QUALITY: EventType[] = ["provider_error_spike", "run_incomplete", "run_late", "coverage_change", "integration_attention"];
const ALL_TYPES = [...VISIBILITY, ...QUALITY];
const THRESHOLDS = ["Any change", "Any change in a ≥ 2-sample prompt", "Change of ≥ 10 pp in a rate"];

type PresetId = "balanced" | "all" | "critical" | "custom";
type AlertPreset = { label: string; categories: EventType[]; threshold: string; persistence: Persistence; cooldown: number; quiet: boolean };
const PRESETS: Record<Exclude<PresetId, "custom">, AlertPreset> = {
  balanced: {
    label: "Balanced",
    categories: ["new_mention", "lost_mention", "new_recommendation", "lost_recommendation", "owned_citation_gained", "owned_citation_lost", "brand_fact_error", "provider_error_spike", "run_incomplete"],
    threshold: THRESHOLDS[1],
    persistence: "2of3",
    cooldown: 24,
    quiet: true,
  },
  all: { label: "All changes", categories: ALL_TYPES, threshold: THRESHOLDS[0], persistence: "1of1", cooldown: 12, quiet: false },
  critical: { label: "Critical only", categories: ["lost_mention", "lost_recommendation", "brand_fact_error", "provider_error_spike", "run_incomplete"], threshold: THRESHOLDS[2], persistence: "2of3", cooldown: 48, quiet: true },
};

type FormState = {
  name: string;
  promptMode: "latest" | "pinned";
  promptIds: string[];
  channels: Record<string, boolean>;
  market: string;
  language: string;
  kind: FrequencyKind;
  everyDays: number;
  weekday: number;
  dayOfMonth: number;
  cron: string;
  customRuns: number;
  timezone: string;
  localTime: string;
  samples: number;
  windowMinutes: number;
  maxConcurrency: number;
  maxAttempts: number;
  backoffSeconds: number;
  capJobs: number;
  capCost: number;
  preset: PresetId;
  categories: EventType[];
  threshold: string;
  persistence: Persistence;
  cooldown: number;
  quiet: boolean;
  quietFrom: string;
  quietTo: string;
  inApp: boolean;
  emails: string[];
  webhook: string;
  webhookVerified: boolean;
};

function persistenceOf(config: ScheduleConfig): Persistence {
  const { required, window } = config.alerts.persistence;
  return required >= 3 ? "3of3" : required === 2 && window === 3 ? "2of3" : "1of1";
}

function matchPreset(s: Pick<FormState, "categories" | "threshold" | "persistence" | "cooldown" | "quiet">): PresetId {
  for (const [id, p] of Object.entries(PRESETS) as [Exclude<PresetId, "custom">, AlertPreset][]) {
    const same = p.categories.length === s.categories.length && p.categories.every((c) => s.categories.includes(c));
    if (same && p.threshold === s.threshold && p.persistence === s.persistence && p.cooldown === s.cooldown && p.quiet === s.quiet) return id;
  }
  return "custom";
}

function initialState(ctx: NonNullable<ReturnType<typeof useMonitoring>["data"]["ctx"]>, activeIds: string[], config: ScheduleConfig | null, name: string): FormState {
  const channels: FormState["channels"] = {};
  for (const c of ctx.channels) channels[c.id] = config ? config.channelIds.includes(c.id) : true;
  const f = config?.frequency;
  const base = {
    categories: config ? config.alerts.categories.filter((t) => ALL_TYPES.includes(t)) : PRESETS.balanced.categories,
    threshold: config?.alerts.threshold ?? PRESETS.balanced.threshold,
    persistence: config ? persistenceOf(config) : PRESETS.balanced.persistence,
    cooldown: config?.alerts.cooldownHours ?? PRESETS.balanced.cooldown,
    quiet: config?.alerts.quietHours.enabled ?? PRESETS.balanced.quiet,
  };
  return {
    name,
    promptMode: config?.promptMode ?? "latest",
    promptIds: config ? config.promptIds.filter((id) => activeIds.includes(id)) : activeIds,
    channels,
    market: config?.market ?? ctx.market,
    language: config?.language ?? ctx.language,
    kind: f?.kind ?? "weekly",
    everyDays: f?.everyDays ?? 2,
    weekday: f?.weekday ?? 2,
    dayOfMonth: f?.dayOfMonth ?? 1,
    cron: f?.cron ?? "0 9 * * 1,4",
    customRuns: f?.kind === "custom" ? f.runsPerMonth : 8,
    timezone: config?.timezone ?? ctx.storeTimezone,
    localTime: config?.localTime ?? "09:00",
    samples: config?.samples ?? 2,
    windowMinutes: config?.windowMinutes ?? 60,
    maxConcurrency: config?.maxConcurrency ?? 3,
    maxAttempts: config?.retry.maxAttempts ?? 3,
    backoffSeconds: config?.retry.backoffSeconds ?? 30,
    capJobs: config?.usageCap.jobsPerMonth ?? ctx.defaultCap.jobsPerMonth,
    capCost: config?.usageCap.costUsd ?? ctx.defaultCap.costUsd,
    ...base,
    preset: matchPreset(base),
    quietFrom: config?.alerts.quietHours.from ?? "22:00",
    quietTo: config?.alerts.quietHours.to ?? "07:00",
    inApp: config?.notify.inApp ?? true,
    emails: config ? config.notify.email : ctx.emails.slice(0, 1),
    webhook: config?.notify.webhook ?? "",
    webhookVerified: Boolean(config?.notify.webhook),
  };
}

const clamp = (value: number, min: number, max: number) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min);

function toConfig(s: FormState, versions: Record<string, number>): ScheduleConfig {
  const runsPerMonth = runsPerMonthOf(s.kind, { everyDays: s.everyDays, customRuns: s.customRuns });
  const p = PERSISTENCE[s.persistence];
  return {
    promptMode: s.promptMode,
    promptIds: s.promptIds,
    promptCount: s.promptIds.length,
    pinnedVersions: s.promptMode === "pinned" ? Object.fromEntries(s.promptIds.map((id) => [id, versions[id] ?? 1])) : {},
    channelIds: Object.entries(s.channels).filter(([, on]) => on).map(([id]) => id),
    market: s.market,
    language: s.language,
    frequency: {
      kind: s.kind,
      ...(s.kind === "every_n_days" ? { everyDays: s.everyDays } : {}),
      ...(s.kind === "weekly" ? { weekday: s.weekday } : {}),
      ...(s.kind === "monthly" ? { dayOfMonth: s.dayOfMonth } : {}),
      ...(s.kind === "custom" ? { cron: s.cron.trim() } : {}),
      runsPerMonth,
    },
    timezone: s.timezone,
    localTime: s.localTime,
    samples: s.samples,
    windowMinutes: s.windowMinutes,
    maxConcurrency: s.maxConcurrency,
    retry: { maxAttempts: s.maxAttempts, backoffSeconds: s.backoffSeconds },
    usageCap: { jobsPerMonth: s.capJobs, costUsd: s.capCost },
    alerts: {
      categories: s.categories,
      threshold: s.threshold,
      persistence: { required: p.required, window: p.window },
      cooldownHours: s.cooldown,
      quietHours: { enabled: s.quiet, from: s.quietFrom, to: s.quietTo },
    },
    notify: { inApp: s.inApp, email: s.emails, webhook: s.webhook.trim() || null },
  };
}

// ---------------------------------------------------------------------------
// UI pieces
// ---------------------------------------------------------------------------

function Advanced({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return (
    <details className="group rounded-card border border-line bg-surface shadow-card">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-card py-2.5 text-card-title font-semibold text-fg marker:content-none">
        <span>{title}</span>
        <span className="flex items-center gap-2 text-label font-normal text-fg-muted">
          {summary}
          <Icon name="chevron-down" size={16} className="transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-line p-card">{children}</div>
    </details>
  );
}

function Block({ title, info, children }: { title: string; info?: string; children: ReactNode }) {
  return (
    <Card as="section">
      <CardHeader title={title} info={info} />
      <CardBody className="flex flex-col gap-3">{children}</CardBody>
    </Card>
  );
}

function NumberField({ label, value, onChange, min, max, suffix }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; suffix?: string }) {
  return (
    <Field label={label}>
      {({ id, describedBy }) => (
        <div className="flex items-center gap-2">
          <Input id={id} aria-describedby={describedBy} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(event) => onChange(clamp(Number(event.target.value), min, max))} className="tnum" />
          {suffix ? <span className="shrink-0 text-helper text-fg-muted">{suffix}</span> : null}
        </div>
      )}
    </Field>
  );
}

const toggle = <T,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

type Props = { mode: "create" | "edit"; scheduleId?: string };

/** Create and edit form. Basics first; sampling, alert rules and usage limits sit in closed sections with working defaults. */
export function ScheduleForm({ mode, scheduleId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { data, base, schedules, prompts, createSchedule, saveSchedule, activateSchedule } = useMonitoring();
  const rec = scheduleId ? schedules.find((s) => s.id === scheduleId) : undefined;
  const ctx = data.ctx;

  if (!ctx) {
    return <EmptyState icon="plug" title="Connect an AI provider first" description="Schedules need at least one provider." action={<ButtonLink href={`/stores/${data.storeId}/settings`} variant="primary">Open website settings</ButtonLink>} />;
  }
  if (mode === "edit" && !rec) {
    return <EmptyState icon="search" title="Schedule not found" headingAs="h1" description="It may have been created in another browser." action={<ButtonLink href={`${base}/schedules`}>All schedules</ButtonLink>} />;
  }
  if (mode === "edit" && rec?.status === "cancelled") {
    return <EmptyState icon="lock" title="Cancelled schedules are read-only" action={<ButtonLink href={`${base}/schedules/${rec.id}`}>Back to schedule</ButtonLink>} />;
  }
  return <FormBody key={rec?.id ?? "new"} mode={mode} rec={rec} ctx={ctx} base={base} prompts={prompts} schedules={schedules} api={{ createSchedule, saveSchedule, activateSchedule }} router={router} toastPush={toast.push} />;
}

type BodyProps = {
  mode: "create" | "edit";
  rec?: ScheduleRec;
  ctx: NonNullable<ReturnType<typeof useMonitoring>["data"]["ctx"]>;
  base: string;
  prompts: ReturnType<typeof useMonitoring>["prompts"];
  schedules: ScheduleRec[];
  api: Pick<ReturnType<typeof useMonitoring>, "createSchedule" | "saveSchedule" | "activateSchedule">;
  router: ReturnType<typeof useRouter>;
  toastPush: ReturnType<typeof useToast>["push"];
};

function FormBody({ mode, rec, ctx, base, prompts, schedules, api, router, toastPush }: BodyProps) {
  const activePrompts = prompts.filter((p) => p.status === "active");
  const activeIds = useMemo(() => activePrompts.map((p) => p.id), [activePrompts]);
  const [s, setS] = useState<FormState>(() => initialState(ctx, activeIds, rec?.config ?? null, rec?.name ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setS((current) => ({ ...current, [key]: value }));

  const excluded = prompts.filter((p) => p.status !== "active");
  const versions = useMemo(() => Object.fromEntries(prompts.map((p) => [p.id, p.version])), [prompts]);
  const config = useMemo(() => toConfig(s, versions), [s, versions]);
  const est = useMemo(() => estimateSchedule(config, new Set(activeIds), ctx.costPerJobUsd), [config, activeIds, ctx.costPerJobUsd]);
  const enabledCount = config.channelIds.length;

  const others = schedules.filter((x) => x.id !== rec?.id && (x.status === "active" || x.status === "needs_attention"));
  const otherJobs = others.reduce((n, x) => n + x.jobsPerMonth, 0);
  const remainingPlan = Math.max(0, ctx.plan.requestCap - ctx.plan.used);
  const utc = utcTimeFor(s.localTime, s.timezone);
  const tzKnown = ctx.timezones.some((z) => z.value === s.timezone) && utc !== null;
  const cronOk = s.kind !== "custom" || parseCron(s.cron) !== null;
  const destinationsOk = (s.inApp || s.emails.length > 0 || s.webhook.trim() !== "") && (s.webhook.trim() === "" || s.webhookVerified);
  const overlap = others
    .map((x) => ({ name: x.name, pairs: x.config.promptIds.filter((id) => s.promptIds.includes(id)).length * x.config.channelIds.filter((id) => config.channelIds.includes(id)).length }))
    .filter((x) => x.pairs > 0);

  const checks = [
    { id: "name", label: "Enter a schedule name", ok: s.name.trim().length >= 3 },
    { id: "prompts", label: "Select at least 1 active prompt", ok: s.promptIds.length > 0 },
    { id: "providers", label: "Select at least 1 provider", ok: enabledCount > 0 },
    { id: "credentials", label: "Test provider credentials", ok: ctx.channels.filter((c) => s.channels[c.id]).every((c) => c.credentials === "tested") },
    { id: "tz", label: cronOk ? "Use a valid time zone and time" : "Use a valid cron expression", ok: tzKnown && cronOk },
    { id: "plan", label: "Stay within the plan and usage cap", ok: est.jobsPerMonth <= remainingPlan && est.jobsPerMonth <= s.capJobs },
    { id: "alerts", label: "Verify the webhook or turn it off", ok: destinationsOk },
    { id: "aliases", label: "Confirm brand names and owned domains in website settings", ok: ctx.brandConfirmed },
  ];
  const failing = checks.filter((c) => !c.ok);
  const nameOk = s.name.trim().length >= 3;
  const dirty = mode === "create" || JSON.stringify(config) !== JSON.stringify(rec?.config) || s.name.trim() !== rec?.name;

  const applyPreset = (id: PresetId) => {
    if (id === "custom") return set("preset", "custom");
    const p = PRESETS[id];
    setS((cur) => ({ ...cur, preset: id, categories: p.categories, threshold: p.threshold, persistence: p.persistence, cooldown: p.cooldown, quiet: p.quiet }));
  };

  const submit = (status: "active" | "draft", thenActivate = false) => {
    if (status === "active" && failing.length > 0) return;
    if (!nameOk) return;
    setSubmitting(true);
    const name = s.name.trim();
    if (mode === "edit" && rec) {
      api.saveSchedule(rec.id, name, config);
      if (thenActivate) api.activateSchedule(rec.id);
      router.push(`${base}/schedules/${rec.id}`);
    } else {
      const created = api.createSchedule({ name, config, status });
      router.push(`${base}/schedules/${created.id}`);
    }
  };

  const primaryLabel = mode === "edit" && rec ? `Save as version ${rec.currentVersion + 1}` : "Create schedule";
  const primaryDisabled = mode === "edit" ? !dirty || failing.length > 0 : failing.length > 0;
  const primary = (className?: string) => (
    <Button variant="primary" className={className} disabled={primaryDisabled} loading={submitting} onClick={() => submit("active")}>
      {primaryLabel}
    </Button>
  );

  const providerList = (
    <ul className="flex flex-col gap-2">
      {ctx.channels.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line px-3 py-2.5">
          <Checkbox
            checked={s.channels[c.id]}
            onChange={() => setS((cur) => ({ ...cur, channels: { ...cur.channels, [c.id]: !cur.channels[c.id] } }))}
            label={<span className="text-body-sm font-medium">{c.providerLabel}</span>}
            description={`${c.model} · ${c.searchMode}${c.supportsCitations ? "" : " · no citations"}`}
          />
          <Status kind="check" value={c.credentials === "tested" ? "pass" : "warning"} label={c.credentials === "tested" ? "Credentials tested" : "Test needed"} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <HeaderAction>{primary("max-sm:hidden")}</HeaderAction>

      <div className="flex min-w-0 flex-col gap-3">
        <Block title="Basics">
          <Field label="Name" required>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={s.name} maxLength={80} onChange={(event) => set("name", event.target.value)} placeholder="e.g. Weekly visibility check" />}
          </Field>
        </Block>

        <Block title="Prompts" info="Only active prompts run. Paused and archived prompts are skipped.">
          <div className="flex items-center justify-between gap-2">
            <p className="tnum text-body-sm text-fg-muted">{s.promptIds.length} of {activePrompts.length} active prompts</p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => set("promptIds", activePrompts.map((p) => p.id))}>Select all</Button>
              <Button size="sm" variant="ghost" onClick={() => set("promptIds", [])}>Clear</Button>
            </div>
          </div>
          {activePrompts.length === 0 ? (
            <Callout tone="warning" title="No active prompts">
              Activate at least one prompt first. <Link href={`/stores/${ctx.storeId}/prompts`} className="font-medium text-accent-text hover:underline">Open prompts</Link>
            </Callout>
          ) : (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-control border border-line">
              {activePrompts.map((p) => (
                <li key={p.id} className="px-3 py-2.5">
                  <Checkbox checked={s.promptIds.includes(p.id)} onChange={() => set("promptIds", toggle(s.promptIds, p.id))} label={<span className="text-body-sm">{p.text}</span>} description={`${p.group} · v${p.version}${p.isCore ? " · core" : ""}`} />
                </li>
              ))}
            </ul>
          )}
          {excluded.length > 0 ? (
            <details className="text-body-sm">
              <summary className="cursor-pointer text-fg-muted">Not included ({excluded.length})</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {excluded.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-fg-muted">{p.text}</span>
                    <Status kind="prompt" value={p.status} />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Block>

        <Block title="Providers" info="Each result is an API answer sample from the provider, model and search mode listed. It may differ from the consumer app.">
          {providerList}
        </Block>

        <Block title="Timetable">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            <Field label="Frequency">
              {({ id }) => (
                <Select id={id} value={s.kind} onChange={(event) => set("kind", event.target.value as FrequencyKind)}>
                  <option value="daily">Daily</option>
                  <option value="every_n_days">Every N days</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom (cron)</option>
                </Select>
              )}
            </Field>
            {s.kind === "every_n_days" ? <NumberField label="Every" value={s.everyDays} onChange={(n) => set("everyDays", n)} min={2} max={30} suffix="days" /> : null}
            {s.kind === "weekly" ? (
              <Field label="Day of week">
                {({ id }) => (
                  <Select id={id} value={s.weekday} onChange={(event) => set("weekday", Number(event.target.value))}>
                    {WEEKDAY_LABEL.map((day, i) => (
                      <option key={day} value={i}>{day}</option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
            {s.kind === "monthly" ? <NumberField label="Day of month" value={s.dayOfMonth} onChange={(n) => set("dayOfMonth", n)} min={1} max={28} /> : null}
            {s.kind === "custom" ? (
              <Field label="Cron" hint="minute hour day month weekday" error={cronOk ? undefined : "Not a valid 5-field cron expression"}>
                {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={s.cron} onChange={(event) => set("cron", event.target.value)} className="font-mono" />}
              </Field>
            ) : null}
            <Field label="Time zone">
              {({ id }) => (
                <Select id={id} value={s.timezone} onChange={(event) => set("timezone", event.target.value)}>
                  {ctx.timezones.map((z) => (
                    <option key={z.value} value={z.value}>{z.label}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Local time">
              {({ id }) => <Input id={id} type="time" value={s.localTime} onChange={(event) => set("localTime", event.target.value || "09:00")} className="tnum" />}
            </Field>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-body-sm text-fg-muted">
            <Icon name="clock" size={14} className="text-fg-subtle" />
            <span className="tnum">{utc ? `= ${utc} UTC` : "Unknown time zone"}</span>
            <Tooltip content={observesDst(s.timezone) ? "Runs at the same local time all year, so the UTC time shifts by an hour when clocks change." : "This zone has no daylight saving, so the UTC time never shifts."}>
              <span className="flex cursor-help text-fg-subtle" tabIndex={0} aria-label="Daylight saving note"><Icon name="info" size={14} /></span>
            </Tooltip>
          </p>
        </Block>

        <Advanced title="Sampling and retries" summary={`${s.samples} samples · ${s.maxAttempts} attempts`}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            <NumberField label="Samples per job" value={s.samples} onChange={(n) => set("samples", n)} min={1} max={5} />
            <NumberField label="Run window" value={s.windowMinutes} onChange={(n) => set("windowMinutes", n)} min={10} max={240} suffix="min" />
            <NumberField label="Max concurrency" value={s.maxConcurrency} onChange={(n) => set("maxConcurrency", n)} min={1} max={10} suffix="jobs at once" />
            <NumberField label="Retry attempts" value={s.maxAttempts} onChange={(n) => set("maxAttempts", n)} min={1} max={5} suffix="per job" />
            <NumberField label="Retry backoff" value={s.backoffSeconds} onChange={(n) => set("backoffSeconds", n)} min={5} max={300} suffix="seconds" />
            <Field label="Prompt version">
              {({ id }) => (
                <Select id={id} value={s.promptMode} onChange={(event) => set("promptMode", event.target.value as "latest" | "pinned")}>
                  <option value="latest">Latest approved</option>
                  <option value="pinned">Pin current versions</option>
                </Select>
              )}
            </Field>
            <Field label="Market">
              {({ id }) => (
                <Select id={id} value={s.market} onChange={(event) => set("market", event.target.value)}>
                  {[...new Set([ctx.market, s.market, "PK", "AE", "GB", "US"])].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Language">
              {({ id }) => (
                <Select id={id} value={s.language} onChange={(event) => set("language", event.target.value)}>
                  {[...new Set([ctx.language, s.language, "en", "ur", "ar"])].map((l) => (
                    <option key={l} value={l}>{l.toUpperCase()}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <p className="text-helper text-fg-muted">Runs never overlap. A missed run is caught up once within 24 hours.</p>
        </Advanced>

        <Advanced title="Alerts" summary={s.preset === "custom" ? "Custom" : PRESETS[s.preset].label}>
          <Field label="Alert rules">
            {({ id }) => (
              <Select id={id} value={s.preset} onChange={(event) => applyPreset(event.target.value as PresetId)}>
                {(Object.keys(PRESETS) as Exclude<PresetId, "custom">[]).map((p) => (
                  <option key={p} value={p}>{PRESETS[p].label}</option>
                ))}
                <option value="custom">Custom</option>
              </Select>
            )}
          </Field>
          {s.preset === "custom" ? (
            <>
              {[
                { title: "Visibility events", types: VISIBILITY },
                { title: "Data quality events", types: QUALITY },
              ].map((group) => (
                <fieldset key={group.title}>
                  <legend className="mb-2 text-label font-medium text-fg">{group.title}</legend>
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-2 sm:grid-cols-2">
                    {group.types.map((type) => (
                      <Checkbox key={type} checked={s.categories.includes(type)} onChange={() => set("categories", toggle(s.categories, type))} label={<span className="text-body-sm">{EVENT_LABEL[type]}</span>} />
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                <Field label="Threshold">
                  {({ id }) => (
                    <Select id={id} value={s.threshold} onChange={(event) => set("threshold", event.target.value)}>
                      {THRESHOLDS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Persistence">
                  {({ id }) => (
                    <Select id={id} value={s.persistence} onChange={(event) => set("persistence", event.target.value as Persistence)}>
                      {Object.entries(PERSISTENCE).map(([value, p]) => (
                        <option key={value} value={value}>{p.label}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Cooldown">
                  {({ id }) => (
                    <Select id={id} value={s.cooldown} onChange={(event) => set("cooldown", Number(event.target.value))}>
                      {[6, 12, 24, 48, 72].map((h) => (
                        <option key={h} value={h}>{h} h per prompt and provider</option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            </>
          ) : (
            <p className="text-body-sm text-fg-muted">{PRESETS[s.preset].categories.length} event types · {PRESETS[s.preset].threshold.toLowerCase()} · {PERSISTENCE[PRESETS[s.preset].persistence].label.toLowerCase()}.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Switch checked={s.quiet} onChange={(v) => set("quiet", v)} label="Quiet hours" />
            <span className="text-body-sm text-fg">Quiet hours</span>
            {s.quiet ? (
              <>
                <Input type="time" aria-label="Quiet hours start" value={s.quietFrom} onChange={(event) => set("quietFrom", event.target.value || "22:00")} className="tnum w-28" />
                <span className="text-helper text-fg-muted">to</span>
                <Input type="time" aria-label="Quiet hours end" value={s.quietTo} onChange={(event) => set("quietTo", event.target.value || "07:00")} className="tnum w-28" />
              </>
            ) : null}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label font-medium text-fg">Send alerts to</legend>
            <div className="flex items-center gap-3">
              <Switch checked={s.inApp} onChange={(v) => set("inApp", v)} label="In-app notifications" />
              <span className="text-body-sm text-fg">In-app</span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
              {ctx.emails.map((email) => (
                <Checkbox key={email} checked={s.emails.includes(email)} onChange={() => set("emails", toggle(s.emails, email))} label={<span className="text-body-sm">{email}</span>} />
              ))}
            </div>
            <Field label="Webhook URL" hint="Optional. Verify it before it can receive alerts.">
              {({ id, describedBy }) => (
                <div className="flex flex-wrap items-center gap-2">
                  <Input id={id} aria-describedby={describedBy} type="url" value={s.webhook} onChange={(event) => setS((c) => ({ ...c, webhook: event.target.value, webhookVerified: false }))} placeholder="https://" className="min-w-0 flex-1" />
                  {s.webhook.trim() ? (
                    s.webhookVerified ? (
                      <Status kind="check" value="pass" label="Verified" />
                    ) : (
                      <Button size="sm" onClick={() => { set("webhookVerified", true); toastPush({ title: "Test delivery recorded (simulated)", tone: "simulated" }); }}>Send test</Button>
                    )
                  ) : null}
                </div>
              )}
            </Field>
          </fieldset>
        </Advanced>

        <Advanced title="Usage limits" summary={`${formatNumber(s.capJobs)} jobs · ${formatUsd(s.capCost)}`}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            <NumberField label="Jobs cap" value={s.capJobs} onChange={(n) => set("capJobs", n)} min={1} max={5000} suffix="per month" />
            <NumberField label="Cost cap (estimate)" value={s.capCost} onChange={(n) => set("capCost", n)} min={1} max={500} suffix="USD per month" />
          </div>
          <p className="tnum text-helper text-fg-muted">Website budget: {formatNumber(ctx.budget.requests)} requests · {formatUsd(ctx.budget.costUsd)} estimate per month. Runs stop at a cap and finish as partial.</p>
        </Advanced>
      </div>

      <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardHeader title="Estimate" />
          <CardBody className="flex flex-col gap-3">
            <p className="tnum text-body text-fg">
              <span className="font-semibold">{s.promptIds.length} × {enabledCount} × {s.samples} = {est.jobsPerRun}</span> jobs per run
            </p>
            <p className="tnum text-body-sm text-fg-muted">~{formatNumber(est.jobsPerMonth)} jobs a month · ~{formatUsd(est.costPerMonthUsd)} estimate</p>
            <Progress value={Math.min(est.jobsPerMonth, s.capJobs)} max={Math.max(s.capJobs, 1)} label="Estimated jobs per month against the cap" tone={est.jobsPerMonth > s.capJobs ? "danger" : est.jobsPerMonth > s.capJobs * 0.8 ? "warning" : "accent"} />
            <p className="tnum text-helper text-fg-muted">
              {formatNumber(est.jobsPerMonth)} / {formatNumber(s.capJobs)} cap · plan has {formatNumber(remainingPlan)} requests left{otherJobs > 0 ? ` · other schedules plan ~${formatNumber(otherJobs)}` : ""}
            </p>
            {overlap.length > 0 ? (
              <p className="text-helper text-warning-text">
                {overlap.map((o) => `${o.pairs} prompt and provider pairs also run in ${o.name}`).join("; ")}.
              </p>
            ) : null}
          </CardBody>
        </Card>

        {failing.length > 0 ? (
          <Card>
            <CardHeader title="To do" />
            <CardBody>
              <ul className="flex flex-col gap-2">
                {failing.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-body-sm text-fg">
                    <Icon name="x-circle" size={16} className="mt-0.5 shrink-0 text-danger-icon" />
                    {c.label}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        <div className="flex flex-col gap-2">
          {primary("sm:hidden")}
          {mode === "create" ? (
            <Button variant="secondary" disabled={!nameOk} onClick={() => submit("draft")}>Save as draft</Button>
          ) : rec?.status === "draft" ? (
            <Button variant="secondary" disabled={!nameOk || failing.length > 0} onClick={() => submit("active", true)}>Save and activate</Button>
          ) : null}
          <ButtonLink href={mode === "edit" && rec ? `${base}/schedules/${rec.id}` : `${base}/schedules`} variant="ghost">Cancel</ButtonLink>
          {mode === "edit" && rec && dirty ? <p className="text-helper text-fg-muted">Earlier runs keep the settings they ran with.</p> : null}
        </div>
      </div>
    </div>
  );
}
