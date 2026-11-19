"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { SplitLayout } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { Checkbox, Field, Input, RadioCards, Select, Switch } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { SEARCH_MODE_LABEL } from "@/lib/labels";
import type { EventType, FrequencyKind, ScheduleConfig, ScheduleFormContext } from "@/types/monitoring";

import { EVENT_LABEL, WEEKDAY_LABEL, formatUsd } from "./labels";

// ---------------------------------------------------------------------------
// Time zone helpers (deterministic: fixed reference date, no clock reads)
// ---------------------------------------------------------------------------

function offsetMinutes(timeZone: string, atMs: number): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(atMs));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUtc - Math.floor(atMs / 1000) * 1000) / 60000);
  } catch {
    return null;
  }
}

/** "09:00" in `timeZone` on the reference date → "04:00" UTC. Null when the zone is invalid. */
function utcTimeFor(localTime: string, timeZone: string): string | null {
  const [h, m] = localTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const guess = Date.UTC(2026, 10, 19, h, m);
  const off = offsetMinutes(timeZone, guess);
  if (off === null) return null;
  const utc = new Date(guess - off * 60000);
  return `${String(utc.getUTCHours()).padStart(2, "0")}:${String(utc.getUTCMinutes()).padStart(2, "0")}`;
}

function observesDst(timeZone: string): boolean {
  const winter = offsetMinutes(timeZone, Date.UTC(2026, 0, 15, 12));
  const summer = offsetMinutes(timeZone, Date.UTC(2026, 6, 15, 12));
  return winter !== null && summer !== null && winter !== summer;
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

type Persistence = "1of1" | "2of3" | "3of3";
const PERSISTENCE: Record<Persistence, { required: number; window: number; label: string }> = {
  "1of1": { required: 1, window: 1, label: "Alert immediately" },
  "2of3": { required: 2, window: 3, label: "Confirm repeat 2 of 3 runs" },
  "3of3": { required: 3, window: 3, label: "Confirm repeat 3 of 3 runs" },
};

type FormState = {
  name: string;
  promptMode: "latest" | "pinned";
  promptIds: string[];
  channels: Record<string, { enabled: boolean; searchMode: string }>;
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

const CATEGORY_GROUPS: { title: string; types: EventType[] }[] = [
  { title: "Visibility", types: ["new_mention", "lost_mention", "new_recommendation", "lost_recommendation", "owned_citation_gained", "owned_citation_lost", "sentiment_shift", "competitor_increase", "competitor_decrease", "rank_movement"] },
  { title: "Data quality", types: ["provider_error_spike", "run_incomplete", "run_late"] },
];
const ALL_TYPES = CATEGORY_GROUPS.flatMap((g) => g.types);
const THRESHOLDS = ["Any change", "Any change in a ≥ 2-sample prompt", "Change of ≥ 10 pp in a rate"];

function persistenceOf(config: ScheduleConfig): Persistence {
  const { required, window } = config.alerts.persistence;
  return required >= 3 ? "3of3" : required === 2 && window === 3 ? "2of3" : "1of1";
}

function initialState(ctx: ScheduleFormContext, config: ScheduleConfig | null, name: string): FormState {
  const channels: FormState["channels"] = {};
  for (const c of ctx.channels) channels[c.id] = { enabled: config ? config.channelIds.includes(c.id) : true, searchMode: c.searchMode };
  const active = ctx.prompts.filter((p) => p.status === "active").map((p) => p.id);
  const f = config?.frequency;
  return {
    name,
    promptMode: config?.promptMode ?? "latest",
    promptIds: config ? config.promptIds.filter((id) => active.includes(id)) : active,
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
    capJobs: config?.usageCap.jobsPerMonth ?? 600,
    capCost: config?.usageCap.costUsd ?? 20,
    categories: config ? config.alerts.categories.filter((t) => ALL_TYPES.includes(t)) : ALL_TYPES,
    threshold: config?.alerts.threshold ?? THRESHOLDS[1],
    persistence: config ? persistenceOf(config) : "2of3",
    cooldown: config?.alerts.cooldownHours ?? 24,
    quiet: config?.alerts.quietHours.enabled ?? true,
    quietFrom: config?.alerts.quietHours.from ?? "22:00",
    quietTo: config?.alerts.quietHours.to ?? "07:00",
    inApp: config?.notify.inApp ?? true,
    emails: config ? config.notify.email : ctx.emails.slice(0, 1),
    webhook: config?.notify.webhook ?? "",
    webhookVerified: Boolean(config?.notify.webhook),
  };
}

function runsPerMonth(s: FormState): number {
  switch (s.kind) {
    case "daily":
      return 30;
    case "every_n_days":
      return 30 / Math.max(1, s.everyDays);
    case "weekly":
      return 4.33;
    case "monthly":
      return 1;
    default:
      return Math.max(0, s.customRuns);
  }
}

const clamp = (value: number, min: number, max: number) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min);

// ---------------------------------------------------------------------------
// UI pieces
// ---------------------------------------------------------------------------

function FormSection({ title, info, children, id }: { title: string; info?: string; children: ReactNode; id: string }) {
  return (
    <Card as="section">
      <CardHeader title={title} info={info} />
      <CardBody>
        <div id={id} className="flex flex-col gap-4">{children}</div>
      </CardBody>
    </Card>
  );
}

function NumberField({ label, value, onChange, min, max, suffix, hint }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; suffix?: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      {({ id, describedBy }) => (
        <div className="flex items-center gap-2">
          <Input id={id} aria-describedby={describedBy} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(event) => onChange(clamp(Number(event.target.value), min, max))} className="tnum" />
          {suffix ? <span className="shrink-0 text-xs text-fg-subtle">{suffix}</span> : null}
        </div>
      )}
    </Field>
  );
}

type Check = { id: string; label: string; ok: boolean };

export function ScheduleForm({ ctx, mode, scheduleId, initial }: { ctx: ScheduleFormContext; mode: "create" | "edit"; scheduleId?: string; initial?: { name: string; config: ScheduleConfig; version: number } }) {
  const router = useRouter();
  const toast = useToast();
  const base = `/stores/${ctx.storeId}/monitoring`;
  const start = useMemo(() => initialState(ctx, initial?.config ?? null, initial?.name ?? ""), [ctx, initial]);
  const [s, setS] = useState<FormState>(start);
  const [submitting, setSubmitting] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setS((current) => ({ ...current, [key]: value }));

  const activePrompts = ctx.prompts.filter((p) => p.status === "active");
  const excluded = ctx.prompts.filter((p) => p.status !== "active");
  const enabledChannels = ctx.channels.filter((c) => s.channels[c.id]?.enabled);
  const jobsPerRun = s.promptIds.length * enabledChannels.length * s.samples;
  const perMonth = runsPerMonth(s);
  const jobsPerMonth = Math.round(jobsPerRun * perMonth);
  const costPerMonth = jobsPerMonth * ctx.costPerJobUsd;
  const remainingPlan = Math.max(0, ctx.plan.requestCap - ctx.plan.used);
  const utc = utcTimeFor(s.localTime, s.timezone);
  const tzKnown = ctx.timezones.some((z) => z.value === s.timezone) && utc !== null;
  const dst = observesDst(s.timezone);
  const destinationsOk = (s.inApp || s.emails.length > 0 || s.webhook.trim() !== "") && (s.webhook.trim() === "" || s.webhookVerified);
  const cron = s.kind === "custom" ? s.cron.trim() : "ok";

  const checks: Check[] = [
    { id: "name", label: "Schedule name entered", ok: s.name.trim().length >= 3 },
    { id: "prompts", label: "At least 1 active prompt selected", ok: s.promptIds.length > 0 },
    { id: "providers", label: "At least 1 provider selected", ok: enabledChannels.length > 0 },
    { id: "credentials", label: "Provider credentials tested", ok: enabledChannels.length > 0 && enabledChannels.every((c) => c.credentials === "tested") },
    { id: "tz", label: "Time zone and local time valid", ok: tzKnown && cron.length > 0 },
    { id: "plan", label: `Within plan (${formatNumber(jobsPerMonth)} of ${formatNumber(remainingPlan)} requests left this month)`, ok: jobsPerMonth <= remainingPlan && jobsPerMonth <= s.capJobs },
    { id: "alerts", label: "Alert destinations verified", ok: destinationsOk },
  ];
  const blocking = checks.find((c) => !c.ok);

  const changes = useMemo(() => {
    if (mode !== "edit") return [] as string[];
    const out: string[] = [];
    const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    if (s.name !== start.name) out.push("Name");
    if (!eq(s.promptIds, start.promptIds) || s.promptMode !== start.promptMode) out.push("Prompts");
    if (!eq(s.channels, start.channels) || s.market !== start.market || s.language !== start.language) out.push("Providers and locale");
    if (!eq([s.kind, s.everyDays, s.weekday, s.dayOfMonth, s.cron, s.customRuns, s.timezone, s.localTime], [start.kind, start.everyDays, start.weekday, start.dayOfMonth, start.cron, start.customRuns, start.timezone, start.localTime])) out.push("Timetable");
    if (!eq([s.samples, s.windowMinutes, s.maxConcurrency, s.maxAttempts, s.backoffSeconds, s.capJobs, s.capCost], [start.samples, start.windowMinutes, start.maxConcurrency, start.maxAttempts, start.backoffSeconds, start.capJobs, start.capCost])) out.push("Limits");
    if (!eq([s.categories, s.threshold, s.persistence, s.cooldown, s.quiet, s.quietFrom, s.quietTo], [start.categories, start.threshold, start.persistence, start.cooldown, start.quiet, start.quietFrom, start.quietTo])) out.push("Alert rules");
    if (!eq([s.inApp, s.emails, s.webhook], [start.inApp, start.emails, start.webhook])) out.push("Notifications");
    return out;
  }, [mode, s, start]);

  const submit = () => {
    if (blocking) return;
    setSubmitting(true);
    if (mode === "edit" && initial) {
      toast.push({ title: `Saved as version ${initial.version + 1}`, description: "Earlier runs keep the snapshot they ran with. (Demo)", tone: "success" });
      router.push(`${base}/schedules/${scheduleId}`);
    } else {
      toast.push({ title: "Schedule created", description: `${s.name.trim()}: ${jobsPerRun} jobs per run. (Demo)`, tone: "success" });
      router.push(`${base}/schedules`);
    }
  };

  const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const main = (
    <>
      <FormSection id="basics" title="Name">
        <Field label="Schedule name" required hint="Shown on runs, alerts and reports.">
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={s.name} maxLength={80} onChange={(event) => set("name", event.target.value)} placeholder="e.g. Weekly visibility check" />}
        </Field>
      </FormSection>

      <FormSection id="prompts" title="Prompts" info="Only active prompts run. Paused and archived prompts are listed below and skipped.">
        <RadioCards
          label="Prompt version"
          columns={2}
          value={s.promptMode}
          onChange={(value) => set("promptMode", value)}
          options={[
            { value: "latest", label: "Latest approved version", description: "Edits apply from the next run." },
            { value: "pinned", label: "Pin current versions", description: "Versions stay fixed until you edit." },
          ]}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="tnum text-[13px] text-fg-muted">{s.promptIds.length} of {activePrompts.length} active prompts</p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => set("promptIds", activePrompts.map((p) => p.id))}>Select all</Button>
            <Button size="sm" variant="ghost" onClick={() => set("promptIds", [])}>Clear</Button>
          </div>
        </div>
        {activePrompts.length === 0 ? (
          <Callout tone="warning" title="No active prompts">
            Activate at least one prompt in the library first. <Link href={`/stores/${ctx.storeId}/prompts`} className="font-medium text-accent-text hover:underline">Open prompts</Link>
          </Callout>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {activePrompts.map((p) => (
              <li key={p.id} className="px-3 py-2.5">
                <Checkbox
                  checked={s.promptIds.includes(p.id)}
                  onChange={() => set("promptIds", toggleId(s.promptIds, p.id))}
                  label={<span className="text-[13px]">{p.text}</span>}
                  description={`${p.group} · ${s.promptMode === "pinned" ? `pinned at v${p.version}` : `latest, now v${p.version}`}${p.isCore ? " · core" : ""}`}
                />
              </li>
            ))}
          </ul>
        )}
        {excluded.length > 0 ? (
          <details className="rounded-control border border-line bg-surface-2/50 px-3 py-2 text-[13px]">
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
      </FormSection>

      <FormSection id="providers" title="Providers" info="Each result is an API answer sample from the provider, model and search mode listed here. It may differ from the consumer app.">
        {ctx.channels.length === 0 ? (
          <Callout tone="warning" title="No AI channel connected">Connect a provider in store settings first.</Callout>
        ) : (
          <ul className="flex flex-col gap-2">
            {ctx.channels.map((c) => {
              const state = s.channels[c.id];
              return (
                <li key={c.id} className="rounded-control border border-line p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Checkbox
                      checked={state.enabled}
                      onChange={() => setS((current) => ({ ...current, channels: { ...current.channels, [c.id]: { ...current.channels[c.id], enabled: !state.enabled } } }))}
                      label={<span className="text-[13px] font-medium">{c.providerLabel} API</span>}
                      description={`${c.model}${c.supportsCitations ? " · returns citations" : " · no citations"}`}
                    />
                    <Status kind="check" value={c.credentials === "tested" ? "pass" : "warning"} label={c.credentials === "tested" ? "Credentials tested" : "Test needed"} />
                  </div>
                  {state.enabled ? (
                    <div className="mt-3 max-w-xs">
                      <Field label="Search mode">
                        {({ id }) => (
                          <Select id={id} value={state.searchMode} onChange={(event) => setS((current) => ({ ...current, channels: { ...current.channels, [c.id]: { ...current.channels[c.id], searchMode: event.target.value } } }))}>
                            {Object.values(SEARCH_MODE_LABEL).map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <Field label="Market">
            {({ id }) => (
              <Select id={id} value={s.market} onChange={(event) => set("market", event.target.value)}>
                {[...new Set([ctx.market, "PK", "AE", "GB", "US"])].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Language">
            {({ id }) => (
              <Select id={id} value={s.language} onChange={(event) => set("language", event.target.value)}>
                {[...new Set([ctx.language, "en", "ur", "ar"])].map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </FormSection>

      <FormSection id="frequency" title="Timetable">
        <Field label="Frequency">
          {({ id }) => (
            <Select id={id} value={s.kind} onChange={(event) => set("kind", event.target.value as FrequencyKind)}>
              <option value="daily">Daily</option>
              <option value="every_n_days">Every N days</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          {s.kind === "every_n_days" ? <NumberField label="Every (days)" value={s.everyDays} onChange={(n) => set("everyDays", n)} min={2} max={30} suffix="days" /> : null}
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
            <>
              <Field label="Cron expression" hint="minute hour day month weekday" error={cron.length === 0 ? "Enter a cron expression" : undefined}>
                {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={s.cron} onChange={(event) => set("cron", event.target.value)} className="font-mono" />}
              </Field>
              <NumberField label="Runs per month (estimate)" value={s.customRuns} onChange={(n) => set("customRuns", n)} min={1} max={120} />
            </>
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
          <Field label="Local run time">
            {({ id }) => <Input id={id} type="time" value={s.localTime} onChange={(event) => set("localTime", event.target.value || "09:00")} className="tnum" />}
          </Field>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-fg-muted">
          <Icon name="clock" size={14} className="text-fg-subtle" />
          <span className="tnum">{s.localTime} {s.timezone}{utc ? ` = ${utc} UTC` : ""}</span>
          <Tooltip content={dst ? "Runs at the same local time all year, so the UTC time shifts by an hour when clocks change." : "This zone has no daylight saving, so the UTC time never shifts."}>
            <span className="flex cursor-help text-fg-subtle" tabIndex={0} aria-label="Daylight saving note"><Icon name="info" size={14} /></span>
          </Tooltip>
        </p>
      </FormSection>

      <FormSection id="limits" title="Run settings">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <NumberField label="Samples per job" value={s.samples} onChange={(n) => set("samples", n)} min={1} max={5} hint="Repeated answers per prompt and provider." />
          <NumberField label="Run window" value={s.windowMinutes} onChange={(n) => set("windowMinutes", n)} min={10} max={240} suffix="min" hint="Jobs unfinished after this are marked failed." />
          <NumberField label="Max concurrency" value={s.maxConcurrency} onChange={(n) => set("maxConcurrency", n)} min={1} max={10} suffix="jobs at once" />
          <NumberField label="Retry attempts" value={s.maxAttempts} onChange={(n) => set("maxAttempts", n)} min={1} max={5} suffix="per job" />
          <NumberField label="Retry backoff" value={s.backoffSeconds} onChange={(n) => set("backoffSeconds", n)} min={5} max={300} suffix="seconds" />
          <NumberField label="Usage cap (jobs)" value={s.capJobs} onChange={(n) => set("capJobs", n)} min={1} max={5000} suffix="per month" />
          <NumberField label="Cost cap (estimate)" value={s.capCost} onChange={(n) => set("capCost", n)} min={1} max={500} suffix="USD / month" />
        </div>
      </FormSection>

      <FormSection id="alerts" title="Alert rules" info="Events become alerts when they match these rules. Lost mentions wait for the repeat rule before alerting.">
        {CATEGORY_GROUPS.map((group) => (
          <fieldset key={group.title}>
            <legend className="mb-2 text-[13px] font-medium text-fg">{group.title} events</legend>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-2 sm:grid-cols-2">
              {group.types.map((type) => (
                <Checkbox key={type} checked={s.categories.includes(type)} onChange={() => set("categories", toggleId(s.categories, type) as EventType[])} label={<span className="text-[13px]">{EVENT_LABEL[type]}</span>} />
              ))}
            </div>
          </fieldset>
        ))}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
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
                  <option key={h} value={h}>{h} h per prompt × provider</option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-fg">Quiet hours</span>
            <div className="flex flex-wrap items-center gap-2">
              <Switch checked={s.quiet} onChange={(v) => set("quiet", v)} label="Quiet hours" />
              {s.quiet ? (
                <>
                  <Input type="time" aria-label="Quiet hours start" value={s.quietFrom} onChange={(event) => set("quietFrom", event.target.value || "22:00")} className="tnum w-28" />
                  <span className="text-xs text-fg-subtle">to</span>
                  <Input type="time" aria-label="Quiet hours end" value={s.quietTo} onChange={(event) => set("quietTo", event.target.value || "07:00")} className="tnum w-28" />
                </>
              ) : (
                <span className="text-xs text-fg-subtle">Off</span>
              )}
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection id="notify" title="Notifications">
        <div className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2.5">
          <span className="flex items-center gap-2 text-[13px] text-fg"><Icon name="bell" size={15} className="text-fg-subtle" />In-app</span>
          <Switch checked={s.inApp} onChange={(v) => set("inApp", v)} label="In-app notifications" />
        </div>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-fg">Email</legend>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
            {ctx.emails.map((email) => (
              <Checkbox key={email} checked={s.emails.includes(email)} onChange={() => set("emails", toggleId(s.emails, email))} label={<span className="text-[13px]">{email}</span>} description="Verified" />
            ))}
          </div>
        </fieldset>
        <Field label="Webhook URL" hint="Optional. Verify it before it can receive alerts.">
          {({ id, describedBy }) => (
            <div className="flex flex-wrap items-center gap-2">
              <Input id={id} aria-describedby={describedBy} type="url" value={s.webhook} onChange={(event) => setS((c) => ({ ...c, webhook: event.target.value, webhookVerified: false }))} placeholder="https://" className="min-w-0 flex-1" />
              {s.webhook.trim() ? (
                s.webhookVerified ? (
                  <Status kind="check" value="pass" label="Verified" />
                ) : (
                  <Button size="sm" onClick={() => { set("webhookVerified", true); toast.push({ title: "Test event delivered", description: "Webhook marked verified. (Demo)", tone: "success" }); }}>Send test</Button>
                )
              ) : null}
            </div>
          )}
        </Field>
      </FormSection>
    </>
  );

  const aside = (
    <>
      <Card>
        <CardHeader title="Estimate" info="Jobs per run = prompts × providers × samples. Cost is an estimate from recent runs." />
        <CardBody className="flex flex-col gap-3">
          <dl className="flex flex-col gap-2 text-[13px]">
            <div className="flex items-baseline justify-between gap-3"><dt className="text-fg-muted">Jobs per run</dt><dd className="tnum text-right font-semibold text-fg">{s.promptIds.length} × {enabledChannels.length} × {s.samples} = {jobsPerRun}</dd></div>
            <div className="flex items-baseline justify-between gap-3"><dt className="text-fg-muted">Runs per month</dt><dd className="tnum font-medium text-fg">~{perMonth % 1 === 0 ? perMonth : perMonth.toFixed(1)}</dd></div>
            <div className="flex items-baseline justify-between gap-3"><dt className="text-fg-muted">Jobs per month</dt><dd className="tnum font-medium text-fg">~{formatNumber(jobsPerMonth)}</dd></div>
            <div className="flex items-baseline justify-between gap-3"><dt className="text-fg-muted">Cost per month</dt><dd className="tnum font-medium text-fg">~{formatUsd(costPerMonth)} <span className="font-normal text-fg-subtle">estimate</span></dd></div>
          </dl>
          <div className="flex flex-col gap-1 border-t border-line pt-3">
            <div className="flex items-baseline justify-between text-xs text-fg-muted">
              <span>Plan requests left this month</span>
              <span className="tnum">{formatNumber(jobsPerMonth)} / {formatNumber(remainingPlan)}</span>
            </div>
            <Progress value={Math.min(jobsPerMonth, remainingPlan)} max={Math.max(remainingPlan, 1)} label="Estimated share of remaining plan requests" tone={jobsPerMonth > remainingPlan ? "danger" : jobsPerMonth > remainingPlan * 0.8 ? "warning" : "accent"} />
            {ctx.otherJobsPerMonth > 0 ? <p className="tnum text-xs text-fg-subtle">Active schedules already plan ~{formatNumber(ctx.otherJobsPerMonth)} jobs / month.</p> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Checklist" />
        <CardBody className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[13px]">
                <Icon name={c.ok ? "check-circle" : "x-circle"} size={16} className={c.ok ? "mt-0.5 shrink-0 text-success" : "mt-0.5 shrink-0 text-danger"} />
                <span className={c.ok ? "text-fg-muted" : "text-fg"}>{c.label}<span className="sr-only">{c.ok ? " (done)" : " (not done)"}</span></span>
              </li>
            ))}
          </ul>
          {mode === "edit" && initial ? (
            <div className="border-t border-line pt-3 text-xs text-fg-muted">
              <p className="font-medium text-fg">Saves as version {initial.version + 1}</p>
              <p className="mt-0.5">{changes.length > 0 ? `Changed: ${changes.join(", ")}` : "No changes yet"}</p>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <Button variant="primary" disabled={Boolean(blocking) || (mode === "edit" && changes.length === 0)} loading={submitting} onClick={submit}>
              {mode === "edit" && initial ? `Save as version ${initial.version + 1}` : "Create schedule"}
            </Button>
            {blocking ? <p className="text-xs text-fg-subtle">Blocked: {blocking.label.replace(/ \(.*\)$/, "")}</p> : mode === "edit" && changes.length === 0 ? <p className="text-xs text-fg-subtle">Change something to save a new version.</p> : null}
            <ButtonLink href={mode === "edit" ? `${base}/schedules/${scheduleId}` : `${base}/schedules`} variant="ghost">Cancel</ButtonLink>
          </div>
        </CardBody>
      </Card>
    </>
  );

  return <SplitLayout main={main} aside={<div className="flex flex-col gap-5 xl:sticky xl:top-36">{aside}</div>} />;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}
