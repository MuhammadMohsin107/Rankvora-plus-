"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { Field, Input, RadioCards, Segmented, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { WizardFrame } from "@/components/ui/wizard";
import { simulatedToast } from "@/demo-state";
import { CheckSummary, VerdictBanner } from "@/features/comparison/compatibility";
import { buildTitle, encodeDefinition, filterCount, findSnapshot, normalizeFilters, sideTitle, snapshotsAround, statusForVerdict } from "@/features/comparison/definition";
import { COVERAGE_COMPARABLE, COVERAGE_WITH_WARNINGS, previewComparison } from "@/features/comparison/engine";
import { LeftOutTable, leftOutRows, type LeftOutRow } from "@/features/comparison/left-out-table";
import { parseWindow, resolveSide, windowReference } from "@/features/comparison/sides";
import { useComparisonState } from "@/features/comparison/use-comparison-state";
import { usePromptGroups, usePrompts } from "@/features/prompts/use-prompts";
import { MIN_MATCHED_PAIRS } from "@/lib/stats";
import { formatDate, pluralize } from "@/lib/format";
import type { PromptBase, PromptGroup } from "@/types/core";
import type { AggregationPolicy, ComparisonDefinition, ComparisonFilters, ComparisonRecord, ComparisonType, SlotCore, WizardCatalog, WizardData } from "@/types/comparison";

const STEPS = [
  { id: "type", label: "Type" },
  { id: "sources", label: "Sources" },
  { id: "scope", label: "Scope" },
  { id: "check", label: "Check and create" },
];

const STEP_TITLE = ["Comparison type", "Baseline and current", "Scope", "Check and create"];

type WindowState = { from: string; to: string };
const windowOf = (reference: string): WindowState => parseWindow(reference) ?? { from: "", to: "" };

const TYPE_VALUES: ComparisonType[] = ["snapshot_vs_snapshot", "period_vs_period", "initial_vs_latest", "before_after_fixes"];

type Props = {
  storeId: string;
  data: WizardData;
  catalog: WizardCatalog;
  /** Static prompts from the server. Prompts created in this browser are added by usePrompts. */
  prompts: PromptBase[];
  groups: PromptGroup[];
  /** Comparisons that already exist for this website (seeded). */
  records: ComparisonRecord[];
  createdBy: string;
};

type Phase = "idle" | "validating" | "running";

export function NewComparisonWizard({ storeId, data, catalog, prompts: staticPrompts, groups: staticGroups, records, createdBy }: Props) {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const state = useComparisonState(storeId, records);
  const { prompts: allPrompts, isLocal } = usePrompts(storeId, staticPrompts);
  const { groups } = usePromptGroups(storeId, staticGroups);

  // Monitoring and others open the wizard with ?baseline= and ?current= (snapshot id or run/audit id), optionally ?type= and ?task=.
  const [seed] = useState(() => {
    const baseline = findSnapshot(data.snapshots, params.get("baseline"));
    const current = findSnapshot(data.snapshots, params.get("current"));
    const typeParam = params.get("type") as ComparisonType | null;
    const task = data.tasks.find((t) => t.id === params.get("task"));
    const type: ComparisonType = typeParam && TYPE_VALUES.includes(typeParam) ? typeParam : task ? "before_after_fixes" : "snapshot_vs_snapshot";
    return { baseline, current, type, task, fromLink: Boolean((baseline && current) || task || typeParam) };
  });

  const [step, setStep] = useState(seed.fromLink ? 1 : 0);
  const [reached, setReached] = useState(seed.fromLink ? 1 : 0);
  const [type, setType] = useState<ComparisonType>(seed.type);
  const [baseSnap, setBaseSnap] = useState(seed.baseline?.snapshotId ?? catalog.presets[seed.type].baseline);
  const [curSnap, setCurSnap] = useState(seed.current?.snapshotId ?? catalog.presets[seed.type].current);
  const [baseWindow, setBaseWindow] = useState<WindowState>(windowOf(catalog.presets.period_vs_period.baseline));
  const [curWindow, setCurWindow] = useState<WindowState>(windowOf(catalog.presets.period_vs_period.current));
  const [taskId, setTaskId] = useState(seed.task?.id ?? data.tasks[0]?.id ?? "");
  const [filters, setFilters] = useState<ComparisonFilters>({});
  const [providerId, setProviderId] = useState("");
  const [aggregation, setAggregation] = useState<AggregationPolicy>("matched_slot_macro");
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const isPeriod = type === "period_vs_period";
  const isFix = type === "before_after_fixes";
  const task = data.tasks.find((t) => t.id === taskId);
  const around = useMemo(() => (task ? snapshotsAround(data.snapshots, task.completedAt) : { before: null, after: null }), [task, data.snapshots]);

  const baseRef = isPeriod ? windowReference(baseWindow.from, baseWindow.to) : isFix ? (around.before?.snapshotId ?? "") : baseSnap;
  const curRef = isPeriod ? windowReference(curWindow.from, curWindow.to) : isFix ? (around.after?.snapshotId ?? "") : curSnap;

  const baseSide = useMemo(() => (baseRef ? resolveSide<SlotCore>(baseRef, data.snapshots, data.cores, data.brand) : null), [baseRef, data]);
  const curSide = useMemo(() => (curRef ? resolveSide<SlotCore>(curRef, data.snapshots, data.cores, data.brand) : null), [curRef, data]);

  const cleanFilters = useMemo(() => normalizeFilters({ ...filters, channelIds: !filters.channelId && providerId ? data.channels.filter((c) => c.provider === providerId).map((c) => c.id) : undefined }), [filters, providerId, data.channels]);
  const preview = useMemo(() => (baseSide && curSide ? previewComparison(baseSide.info, curSide.info, baseSide.rows, curSide.rows, cleanFilters) : null), [baseSide, curSide, cleanFilters]);

  const promptText = useMemo(() => Object.fromEntries(allPrompts.map((p) => [p.id, p.text])), [allPrompts]);
  const channelLabels = useMemo(() => Object.fromEntries(data.channels.map((c) => [c.id, c.label])), [data.channels]);
  const withSamples = useMemo(() => new Set(data.prompts.map((p) => p.id)), [data.prompts]);

  // Prompts the scope selects. Those without samples on either side (created here, or never run) are shown as unmatched, never dropped.
  const noHistory = useMemo<LeftOutRow[]>(() => {
    return allPrompts
      .filter(
        (p) =>
          p.status === "active" &&
          !withSamples.has(p.id) &&
          (!filters.promptId || filters.promptId === p.id) &&
          (!filters.groupId || p.groupId === filters.groupId) &&
          (!filters.topic || p.topic === filters.topic),
      )
      .map((p) => ({
        id: `nohistory-${p.id}`,
        status: "Unmatched" as const,
        promptId: p.id,
        promptText: p.text,
        slot: "",
        channel: "All platforms",
        reason: "no_history",
        detail: isLocal(p.id) ? "Created in this browser after both sources ran. No samples on either side." : "No samples on either side.",
      }));
  }, [allPrompts, withSamples, filters.promptId, filters.groupId, filters.topic, isLocal]);

  const leftOut = useMemo(() => (preview ? [...leftOutRows(preview.matching.unmatched, preview.matching.excluded, { promptText, channelLabels }), ...noHistory] : noHistory), [preview, promptText, channelLabels, noHistory]);

  const definition: ComparisonDefinition = { type, baseline: baseRef, current: curRef, filters: cleanFilters, aggregation, ...(isFix && taskId ? { taskId } : {}) };
  const id = baseRef && curRef ? encodeDefinition(definition) : "";
  const exists = Boolean(id) && (state.rows.some((r) => r.id === id) || (filterCount(cleanFilters) === 0 && aggregation === "matched_slot_macro" && data.registry.some((r) => r.baseline === baseRef && r.current === curRef)));
  const existingId = exists ? (state.rows.find((r) => r.id === id)?.id ?? data.registry.find((r) => r.baseline === baseRef && r.current === curRef)?.id ?? id) : id;

  // Step 2 validation
  let rangeError: string | null = null;
  if (isPeriod) {
    if (!baseWindow.from || !baseWindow.to || !curWindow.from || !curWindow.to) rangeError = "Enter both dates for each window.";
    else if (baseWindow.from > baseWindow.to || curWindow.from > curWindow.to) rangeError = "A window starts after it ends.";
    else if (baseSide && baseSide.runCount === 0) rangeError = "No monitoring runs in the baseline window.";
    else if (curSide && curSide.runCount === 0) rangeError = "No monitoring runs in the current window.";
  } else if (isFix) {
    if (!task) rangeError = "Choose a completed fix.";
    else if (!around.before) rangeError = "No snapshot exists before this fix was completed.";
    else if (!around.after) rangeError = "No snapshot exists after this fix was completed. Run an audit or a monitoring run first.";
  } else if (!baseSnap || !curSnap) rangeError = "Choose both snapshots.";
  else if (baseSnap === curSnap) rangeError = "Pick two different snapshots.";
  const windowsOverlap = isPeriod && baseWindow.from !== "" && curWindow.from !== "" && baseWindow.from <= curWindow.to && curWindow.from <= baseWindow.to;
  const reversed = !rangeError && baseSide && curSide && baseSide.info.from > curSide.info.from;

  const failing = preview?.assessment.checks.find((c) => c.kind === "hard" && c.state === "fail");
  const verdict = preview?.assessment.verdict;
  const blocked = !preview || Boolean(failing);
  const blockedReason = !preview ? "Choose both sources." : failing ? failing.detail : undefined;

  const snapshotLabel = (snapshotId: string) => {
    const snap = data.snapshots.find((s) => s.snapshotId === snapshotId);
    return snap ? `${snap.title} · ${formatDate(snap.date)}` : snapshotId;
  };
  const baselineOptions = type === "initial_vs_latest" ? data.snapshots.filter((s) => s.kind === "audit") : data.snapshots;
  const currentOptions = type === "initial_vs_latest" ? data.snapshots.filter((s) => s.kind === "monitoring") : data.snapshots;

  const chooseType = (next: ComparisonType) => {
    setType(next);
    if (next === "period_vs_period") {
      setBaseWindow(windowOf(catalog.presets.period_vs_period.baseline));
      setCurWindow(windowOf(catalog.presets.period_vs_period.current));
    } else if (next !== "before_after_fixes") {
      setBaseSnap(catalog.presets[next].baseline);
      setCurSnap(catalog.presets[next].current);
    }
  };

  const setFilter = (key: keyof ComparisonFilters, value: string) =>
    setFilters((current) => {
      const next = { ...current, [key]: value || undefined } as ComparisonFilters;
      if (key === "groupId" || key === "topic") {
        const prompt = allPrompts.find((p) => p.id === next.promptId);
        if (prompt && ((next.groupId && prompt.groupId !== next.groupId) || (next.topic && prompt.topic !== next.topic))) next.promptId = undefined;
      }
      return next;
    });

  const scopedPrompts = allPrompts.filter(
    (p) => (withSamples.has(p.id) || p.status === "active") && (!filters.groupId || p.groupId === filters.groupId) && (!filters.topic || p.topic === filters.topic),
  );
  const topics = useMemo(() => [...new Set([...data.topics, ...allPrompts.map((p) => p.topic).filter(Boolean)])].sort(), [data.topics, allPrompts]);
  const providers = useMemo(() => [...new Map(data.channels.map((c) => [c.provider, c.providerLabel])).entries()], [data.channels]);
  const modelChannels = providerId ? data.channels.filter((c) => c.provider === providerId) : data.channels;

  const goNext = () => {
    const next = Math.min(step + 1, STEPS.length - 1);
    setStep(next);
    setReached((r) => Math.max(r, next));
  };

  const create = () => {
    if (!preview) return;
    if (exists) {
      router.push(`/stores/${storeId}/comparisons/${existingId}`);
      return;
    }
    setPhase("validating");
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    later(() => setPhase("running"), 450);
    later(() => {
      const created = state.create({
        definition,
        title: buildTitle(definition, data.snapshots),
        comparability: preview.assessment.verdict,
        status: statusForVerdict(preview.assessment.verdict),
        matched: preview.assessment.coverage,
        methodologyVersion: "1.0",
        createdBy,
      });
      toast.push(simulatedToast("comparison.created"));
      router.push(`/stores/${storeId}/comparisons/${created.id}`);
    }, 1000);
  };

  let primary: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };
  let reason: string | undefined;
  if (step === 1) {
    primary = { label: "Next", onClick: goNext, disabled: Boolean(rangeError) };
    reason = rangeError ?? undefined;
  } else if (step === 3) {
    primary = { label: exists ? "Open comparison" : "Create comparison", onClick: create, disabled: blocked && !exists, loading: phase !== "idle" };
    reason = blocked && !exists ? blockedReason : undefined;
  } else {
    primary = { label: "Next", onClick: goNext };
  }

  const summary = `${sideTitle(baseRef, data.snapshots)} → ${sideTitle(curRef, data.snapshots)}${filterCount(cleanFilters) ? ` · ${pluralize(filterCount(cleanFilters), "filter")}` : ""}`;

  return (
    <WizardFrame
      steps={STEPS}
      current={step}
      title={STEP_TITLE[step]}
      onBack={step > 0 && phase === "idle" ? () => setStep((s) => Math.max(0, s - 1)) : undefined}
      onStepClick={(index) => {
        if (phase === "idle" && index <= reached) setStep(index);
      }}
      primary={primary}
      blockedReason={reason}
    >
      {step === 0 ? (
        <RadioCards
          label="Comparison type"
          columns={2}
          value={type}
          onChange={chooseType}
          options={catalog.types.map((t) => ({ value: t.value, label: t.label, description: t.short }))}
        />
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-3">
          {isPeriod ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
              {(
                [
                  { key: "baseline", title: "Baseline window", value: baseWindow, set: setBaseWindow, side: baseSide },
                  { key: "current", title: "Current window", value: curWindow, set: setCurWindow, side: curSide },
                ] as const
              ).map((entry) => (
                <fieldset key={entry.key} className="flex min-w-0 flex-col gap-3">
                  <legend className="mb-2 text-body font-semibold text-fg">{entry.title}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="From">{({ id: fid, describedBy }) => <Input id={fid} aria-describedby={describedBy} type="date" value={entry.value.from} onChange={(e) => entry.set({ ...entry.value, from: e.target.value })} />}</Field>
                    <Field label="To">{({ id: fid, describedBy }) => <Input id={fid} aria-describedby={describedBy} type="date" value={entry.value.to} onChange={(e) => entry.set({ ...entry.value, to: e.target.value })} />}</Field>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.windows.map((w) => (
                      <Button key={w.id} size="sm" variant="secondary" onClick={() => entry.set({ from: w.from, to: w.to })}>{w.label}</Button>
                    ))}
                  </div>
                  <p className="tnum text-helper text-fg-muted">{entry.side ? `${pluralize(entry.side.runCount, "monitoring run")} · ${pluralize(entry.side.rows.length, "request")} · UTC dates` : "—"}</p>
                </fieldset>
              ))}
            </div>
          ) : isFix ? (
            <div className="flex flex-col gap-3">
              <Field label="Completed fix" hint="Baseline is the last snapshot before it was completed. Current is the first one after.">
                {({ id: fid, describedBy }) => (
                  <Select id={fid} aria-describedby={describedBy} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                    {data.tasks.length === 0 ? <option value="">No completed fixes</option> : null}
                    {data.tasks.map((t) => <option key={t.id} value={t.id}>{t.title} · {formatDate(t.completedAt)}</option>)}
                  </Select>
                )}
              </Field>
              {around.before && around.after ? (
                <p className="text-body-sm text-fg-muted">
                  <span className="text-fg-subtle">Baseline</span> {snapshotLabel(around.before.snapshotId)} <span aria-hidden="true">→</span><span className="sr-only">to</span> <span className="text-fg-subtle">Current</span> {snapshotLabel(around.after.snapshotId)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
              <Field label="Baseline" hint={type === "initial_vs_latest" ? "Audit snapshots" : undefined}>
                {({ id: fid, describedBy }) => (
                  <Select id={fid} aria-describedby={describedBy} value={baseSnap} onChange={(e) => setBaseSnap(e.target.value)}>
                    {baselineOptions.map((s) => <option key={s.snapshotId} value={s.snapshotId}>{snapshotLabel(s.snapshotId)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Current" hint={type === "initial_vs_latest" ? "Monitoring snapshots" : undefined}>
                {({ id: fid, describedBy }) => (
                  <Select id={fid} aria-describedby={describedBy} value={curSnap} onChange={(e) => setCurSnap(e.target.value)}>
                    {currentOptions.map((s) => <option key={s.snapshotId} value={s.snapshotId}>{snapshotLabel(s.snapshotId)}</option>)}
                  </Select>
                )}
              </Field>
            </div>
          )}
          {rangeError ? <Callout tone="danger" title={rangeError} /> : null}
          {windowsOverlap ? <Callout tone="warning" title="Windows overlap. A run in both windows cannot be compared with itself." /> : null}
          {reversed ? <Callout tone="warning" title="Current is older than baseline. The result reads backwards in time." /> : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
            <Field label="Prompt group">
              {({ id: fid }) => (
                <Select id={fid} value={filters.groupId ?? ""} onChange={(e) => setFilter("groupId", e.target.value)}>
                  <option value="">All groups</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Topic">
              {({ id: fid }) => (
                <Select id={fid} value={filters.topic ?? ""} onChange={(e) => setFilter("topic", e.target.value)}>
                  <option value="">All topics</option>
                  {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Prompt">
              {({ id: fid }) => (
                <Select id={fid} value={filters.promptId ?? ""} onChange={(e) => setFilter("promptId", e.target.value)}>
                  <option value="">All prompts</option>
                  {scopedPrompts.map((p) => <option key={p.id} value={p.id}>{p.text}{withSamples.has(p.id) ? "" : " (no samples yet)"}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Provider">
              {({ id: fid }) => (
                <Select
                  id={fid}
                  value={providerId}
                  onChange={(e) => {
                    setProviderId(e.target.value);
                    setFilters((f) => ({ ...f, channelId: undefined }));
                  }}
                >
                  <option value="">All providers</option>
                  {providers.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              )}
            </Field>
          </div>

          <details className="group rounded-control border border-line">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between rounded-control px-4 py-2.5 text-body font-medium text-fg focus-visible:outline-2 focus-visible:outline-ring">
              More filters and method
              <span className="text-helper font-normal text-fg-subtle">{filterCount(cleanFilters) > 0 ? `${pluralize(filterCount(cleanFilters), "filter")} on` : "Optional"}</span>
            </summary>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 border-t border-line p-4 md:grid-cols-2">
              <Field label="Model">
                {({ id: fid }) => (
                  <Select id={fid} value={filters.channelId ?? ""} onChange={(e) => setFilter("channelId", e.target.value)}>
                    <option value="">All models</option>
                    {modelChannels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Market">
                {({ id: fid }) => (
                  <Select id={fid} value={filters.market ?? ""} onChange={(e) => setFilter("market", e.target.value)}>
                    <option value="">All markets</option>
                    {data.markets.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Language">
                {({ id: fid }) => (
                  <Select id={fid} value={filters.language ?? ""} onChange={(e) => setFilter("language", e.target.value)}>
                    <option value="">All languages</option>
                    {data.languages.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Competitor" hint="Limits the competitor view only.">
                {({ id: fid, describedBy }) => (
                  <Select id={fid} aria-describedby={describedBy} value={filters.competitorId ?? ""} onChange={(e) => setFilter("competitorId", e.target.value)}>
                    <option value="">All tracked competitors</option>
                    {data.competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Citation source" hint="Measures citations of this domain instead of your own.">
                {({ id: fid, describedBy }) => (
                  <Select id={fid} aria-describedby={describedBy} value={filters.domain ?? ""} onChange={(e) => setFilter("domain", e.target.value)}>
                    <option value="">Own domain</option>
                    {data.domains.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                )}
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-label font-medium text-fg">Rates</span>
                <Segmented
                  label="Rates"
                  value={aggregation}
                  onChange={setAggregation}
                  options={[
                    { value: "matched_slot_macro", label: "Average of slots" },
                    { value: "pooled", label: "Pooled responses" },
                  ]}
                />
              </div>
              <div className="md:col-span-2">
                <Button variant="ghost" icon="x" onClick={() => { setFilters({}); setProviderId(""); }} disabled={filterCount(cleanFilters) === 0}>Reset filters</Button>
              </div>
            </div>
          </details>
        </div>
      ) : null}

      {step === 3 ? (
        preview ? (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-fg-muted">{summary}</p>
            <VerdictBanner
              verdict={preview.assessment.verdict}
              coverage={preview.assessment.coverage}
              unmatched={leftOut.filter((r) => r.status === "Unmatched").length}
              excluded={leftOut.filter((r) => r.status === "Excluded").length}
              checks={preview.assessment.checks}
              showVerdict
              showIssues={false}
            />
            {verdict === "not_comparable" ? (
              <Callout tone="danger" title="Cannot be created: this data is not comparable.">{failing?.detail}</Callout>
            ) : (
              <p className="text-helper text-fg-subtle">
                Comparable needs {Math.round(COVERAGE_COMPARABLE * 100)}% of slots matched, {Math.round(COVERAGE_WITH_WARNINGS * 100)}% for warnings, and at least {MIN_MATCHED_PAIRS} matched pairs for a trend.
              </p>
            )}
            {exists ? <Callout tone="info" title="This comparison already exists. Open it." /> : null}
            <CheckSummary checks={preview.assessment.checks} />
            <details open={leftOut.length > 0 && leftOut.length <= 5 ? true : undefined} className="rounded-control border border-line">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between rounded-control px-4 py-2.5 text-body font-medium text-fg focus-visible:outline-2 focus-visible:outline-ring">
                Left out
                <Badge tone={leftOut.length ? "warning" : "neutral"}>{leftOut.length}</Badge>
              </summary>
              <div className="border-t border-line p-4">
                <LeftOutTable rows={leftOut} />
              </div>
            </details>
            {phase !== "idle" ? (
              <div className="flex items-center gap-2.5 text-body-sm text-fg-muted" role="status">
                <Spinner className="text-accent-text" />
                {phase === "validating" ? "Validating the two sources" : `Matching ${preview.baselineRows} baseline and ${preview.currentRows} current requests`} (simulated)
              </div>
            ) : null}
          </div>
        ) : (
          <Callout tone="danger" title="Choose both sources first." />
        )
      ) : null}
    </WizardFrame>
  );
}
