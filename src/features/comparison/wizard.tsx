"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue, Metric } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { Field, Input, RadioCards, Segmented, Select } from "@/components/ui/form";
import { Mono } from "@/components/ui/misc";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { WizardFrame } from "@/components/ui/wizard";
import { CheckList, VerdictBanner } from "@/features/comparison/compatibility";
import { previewComparison, REASON_LABEL } from "@/features/comparison/engine";
import { parseWindow, resolveSide, windowReference } from "@/features/comparison/sides";
import { formatDate } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { AggregationPolicy, ComparisonFilters, ComparisonType, SlotCore, WizardCatalog, WizardData } from "@/types/comparison";

const STEPS = [
  { id: "type", label: "Type" },
  { id: "range", label: "Baseline & current" },
  { id: "filters", label: "Filters & policy" },
  { id: "preview", label: "Compatibility" },
  { id: "run", label: "Run" },
];

const STEP_TITLE = [
  { title: "Comparison type", subtitle: "Pick what you want to compare." },
  { title: "Baseline and current", subtitle: "Two sources from this store." },
  { title: "Filters and policy", subtitle: "Narrow the cohort and choose how rates are aggregated." },
  { title: "Compatibility preview", subtitle: "Computed live from the selection." },
  { title: "Run", subtitle: "Runs now and opens the result." },
];

type ExcludedRow = {
  id: string;
  kind: "Unmatched" | "Excluded";
  promptId: string;
  promptVersion: number;
  channelId: string;
  sample: number;
  reason: string;
  detail: string;
};

type WindowState = { from: string; to: string };

function windowOf(reference: string): WindowState {
  return parseWindow(reference) ?? { from: "", to: "" };
}

export function NewComparisonWizard({ storeId, data, catalog }: { storeId: string; data: WizardData; catalog: WizardCatalog }) {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [type, setType] = useState<ComparisonType>("snapshot_vs_snapshot");
  const [baseSnap, setBaseSnap] = useState(catalog.presets.snapshot_vs_snapshot.baseline);
  const [curSnap, setCurSnap] = useState(catalog.presets.snapshot_vs_snapshot.current);
  const [baseWindow, setBaseWindow] = useState<WindowState>(windowOf(catalog.presets.period_vs_period.baseline));
  const [curWindow, setCurWindow] = useState<WindowState>(windowOf(catalog.presets.period_vs_period.current));
  const [filters, setFilters] = useState<ComparisonFilters>({});
  const [aggregation, setAggregation] = useState<AggregationPolicy>("matched_slot_macro");
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");

  const isPeriod = type === "period_vs_period";
  const baseRef = isPeriod ? windowReference(baseWindow.from, baseWindow.to) : baseSnap;
  const curRef = isPeriod ? windowReference(curWindow.from, curWindow.to) : curSnap;

  const baseSide = useMemo(() => resolveSide<SlotCore>(baseRef, data.snapshots, data.cores, data.brand), [baseRef, data]);
  const curSide = useMemo(() => resolveSide<SlotCore>(curRef, data.snapshots, data.cores, data.brand), [curRef, data]);
  const preview = useMemo(
    () => (baseSide && curSide ? previewComparison(baseSide.info, curSide.info, baseSide.rows, curSide.rows, filters) : null),
    [baseSide, curSide, filters],
  );

  const promptText = useMemo(() => Object.fromEntries(data.prompts.map((p) => [p.id, p.text])), [data.prompts]);
  const channelLabel = useMemo(() => Object.fromEntries(data.channels.map((c) => [c.id, c.label])), [data.channels]);

  const snapshotLabel = (id: string) => {
    const snap = data.snapshots.find((s) => s.snapshotId === id);
    return snap ? `${snap.snapshotId} · ${snap.title} · ${formatDate(snap.date)}` : id;
  };
  const baselineOptions = type === "initial_vs_latest" ? data.snapshots.filter((s) => s.kind === "audit") : data.snapshots;
  const currentOptions = type === "initial_vs_latest" ? data.snapshots.filter((s) => s.kind === "monitoring") : data.snapshots;

  const chooseType = (next: ComparisonType) => {
    setType(next);
    setPhase("idle");
    const preset = catalog.presets[next];
    if (next === "period_vs_period") {
      setBaseWindow(windowOf(preset.baseline));
      setCurWindow(windowOf(preset.current));
    } else {
      setBaseSnap(preset.baseline);
      setCurSnap(preset.current);
    }
  };

  // Range validation and warnings
  const windowsOverlap = isPeriod && baseWindow.from !== "" && curWindow.from !== "" && baseWindow.from <= curWindow.to && curWindow.from <= baseWindow.to;
  let rangeError: string | null = null;
  if (isPeriod) {
    if (!baseWindow.from || !baseWindow.to || !curWindow.from || !curWindow.to) rangeError = "Enter both dates for each window.";
    else if (baseWindow.from > baseWindow.to || curWindow.from > curWindow.to) rangeError = "A window starts after it ends.";
    else if (baseSide && baseSide.runCount === 0) rangeError = "No monitoring runs in the baseline window.";
    else if (curSide && curSide.runCount === 0) rangeError = "No monitoring runs in the current window.";
  } else if (baseSnap === curSnap) {
    rangeError = "Pick two different snapshots.";
  }
  const reversed = !rangeError && baseSide && curSide && baseSide.info.from > curSide.info.from;

  const hardFail = preview ? preview.assessment.checks.some((c) => c.kind === "hard" && c.state === "fail") : true;
  const filterCount = Object.values(filters).filter(Boolean).length;

  // Which saved comparison opens when the run finishes.
  const target = useMemo(() => {
    const exact = data.registry.find((r) => r.baseline === baseRef && r.current === curRef);
    const id = exact?.id ?? catalog.defaultTargets[type];
    const landing = catalog.types.find((t) => t.value === type)?.landing ?? "";
    return { id, href: `/stores/${storeId}/comparisons/${id}${landing ? `/${landing}` : ""}` };
  }, [data.registry, baseRef, curRef, catalog, type, storeId]);

  const excludedRows: ExcludedRow[] = useMemo(() => {
    if (!preview) return [];
    const make = (kind: ExcludedRow["kind"], list: { key: string; promptId: string; promptVersion: number; channelId: string; sample: number; reason: string; detail: string }[]) =>
      list.map((r) => ({ id: `${kind}-${r.key}-${r.reason}`, kind, promptId: r.promptId, promptVersion: r.promptVersion, channelId: r.channelId, sample: r.sample, reason: r.reason, detail: r.detail }));
    return [...make("Unmatched", preview.matching.unmatched), ...make("Excluded", preview.matching.excluded)];
  }, [preview]);

  const excludedColumns: Column<ExcludedRow>[] = [
    {
      id: "prompt",
      header: "Prompt",
      sort: (r) => r.promptId,
      cell: (r) => (
        <div className="min-w-0 max-w-xs">
          <p className="truncate text-[13px] text-fg" title={promptText[r.promptId]}>{promptText[r.promptId] ?? r.promptId}</p>
          <p className="tnum text-xs text-fg-subtle">{r.promptId} · v{r.promptVersion} · sample {r.sample}</p>
        </div>
      ),
    },
    { id: "channel", header: "Provider", hideBelow: "md", cell: (r) => <span className="text-xs text-fg-muted">{channelLabel[r.channelId] ?? r.channelId}</span> },
    { id: "kind", header: "Kind", hideBelow: "sm", cell: (r) => <Badge tone="neutral">{r.kind}</Badge> },
    { id: "reason", header: "Reason", sort: (r) => r.reason, cell: (r) => <span title={r.detail}><Badge tone="warning" icon="alert-triangle">{REASON_LABEL[r.reason]}</Badge></span> },
  ];
  const excludedFilters: TableFilter<ExcludedRow>[] = [
    { id: "reason", label: "Reason", options: [...new Set(excludedRows.map((r) => r.reason))].map((value) => ({ value, label: REASON_LABEL[value] })), value: (r) => r.reason },
  ];

  const run = () => {
    setPhase("running");
    window.setTimeout(() => {
      setPhase("done");
      toast.push({ title: "Comparison completed", description: `Saved as ${target.id}. Opening it shows the full result.`, tone: "success" });
    }, 900);
  };

  const back = () => {
    setPhase("idle");
    setStep((s) => Math.max(0, s - 1));
  };

  let primary: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };
  let blockedReason: string | undefined;
  if (step === 1) {
    primary = { label: "Next", onClick: () => setStep(2), disabled: Boolean(rangeError) };
    blockedReason = rangeError ?? undefined;
  } else if (step === 3) {
    primary = { label: "Continue", onClick: () => setStep(4), disabled: hardFail };
    blockedReason = "A hard check failed. Change the selection to run.";
  } else if (step === 4) {
    if (phase === "done") primary = { label: "Open comparison", onClick: () => router.push(target.href) };
    else primary = { label: "Run comparison", onClick: run, loading: phase === "running" };
  } else {
    primary = { label: "Next", onClick: () => setStep(step + 1) };
  }

  const setFilter = (key: keyof ComparisonFilters, value: string) =>
    setFilters((current) => {
      const next = { ...current, [key]: value || undefined };
      if (key === "groupId" && next.promptId) {
        const prompt = data.prompts.find((p) => p.id === next.promptId);
        if (value && prompt?.groupId !== value) next.promptId = undefined;
      }
      return next;
    });

  const verdict = preview?.assessment.verdict;

  const aside = (
    <Card>
      <CardHeader title="Selection" as="h3" />
      <CardBody className="flex flex-col gap-3">
        <KeyValue
          columns={1}
          items={[
            { label: "Type", value: catalog.types.find((t) => t.value === type)?.label },
            { label: "Baseline", value: baseSide ? <span className="flex flex-col gap-0.5"><span>{baseSide.info.label}</span><Mono>{baseRef}</Mono></span> : "—" },
            { label: "Current", value: curSide ? <span className="flex flex-col gap-0.5"><span>{curSide.info.label}</span><Mono>{curRef}</Mono></span> : "—" },
            { label: "Filters", value: filterCount ? `${filterCount} applied` : "None" },
            { label: "Aggregation", value: aggregation === "pooled" ? "Pooled" : "Matched-slot macro average" },
          ]}
        />
        {step >= 1 && verdict && !rangeError ? (
          <div className="flex flex-col gap-1 border-t border-line pt-3">
            <span className="text-xs text-fg-subtle">Compatibility</span>
            <Status kind="comparability" value={verdict} />
            <span className="tnum text-xs text-fg-muted">{preview!.matching.pairs.length} / {preview!.assessment.coverage.d} slots matched</span>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );

  return (
    <WizardFrame
      steps={STEPS}
      current={step}
      title={STEP_TITLE[step].title}
      subtitle={STEP_TITLE[step].subtitle}
      aside={aside}
      onBack={step > 0 ? back : undefined}
      onStepClick={(index) => {
        setPhase("idle");
        setStep(index);
      }}
      primary={primary}
      blockedReason={blockedReason}
    >
      {step === 0 ? (
        <div className="flex flex-col gap-3">
          <RadioCards
            label="Comparison type"
            columns={2}
            value={type}
            onChange={chooseType}
            options={catalog.types.map((t) => ({
              value: t.value,
              label: t.label,
              description: t.short,
              disabled: t.portfolio,
              badge: t.portfolio ? <Badge tone="neutral">On Portfolio page</Badge> : undefined,
            }))}
          />
          <div>
            <ButtonLink href="/" variant="ghost" size="sm" trailingIcon="arrow-right">Compare stores on the Portfolio page</ButtonLink>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Badge tone="neutral" icon="store">Same store only</Badge>
            <span className="text-xs text-fg-subtle">Snapshots from other stores are never listed.</span>
          </div>

          {isPeriod ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
              {(
                [
                  { key: "baseline", title: "Baseline window", value: baseWindow, set: setBaseWindow, side: baseSide },
                  { key: "current", title: "Current window", value: curWindow, set: setCurWindow, side: curSide },
                ] as const
              ).map((entry) => (
                <fieldset key={entry.key} className="flex min-w-0 flex-col gap-3">
                  <legend className="mb-2 text-sm font-semibold text-fg">{entry.title}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="From">{({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="date" value={entry.value.from} onChange={(e) => entry.set({ ...entry.value, from: e.target.value })} />}</Field>
                    <Field label="To">{({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="date" value={entry.value.to} onChange={(e) => entry.set({ ...entry.value, to: e.target.value })} />}</Field>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.windows.map((w) => (
                      <Button key={w.id} size="sm" variant="secondary" onClick={() => entry.set({ from: w.from, to: w.to })}>
                        {w.label}
                      </Button>
                    ))}
                  </div>
                  <p className="tnum text-xs text-fg-muted">{entry.side ? `${entry.side.runCount} monitoring runs · ${entry.side.rows.length} requests` : "—"}</p>
                </fieldset>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
              <Field label="Baseline snapshot" hint={type === "initial_vs_latest" ? "Audit snapshots" : undefined}>
                {({ id, describedBy }) => (
                  <Select id={id} aria-describedby={describedBy} value={baseSnap} onChange={(e) => setBaseSnap(e.target.value)}>
                    {baselineOptions.map((s) => (
                      <option key={s.snapshotId} value={s.snapshotId}>{snapshotLabel(s.snapshotId)}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Current snapshot" hint={type === "initial_vs_latest" ? "Monitoring snapshots" : undefined}>
                {({ id, describedBy }) => (
                  <Select id={id} aria-describedby={describedBy} value={curSnap} onChange={(e) => setCurSnap(e.target.value)}>
                    {currentOptions.map((s) => (
                      <option key={s.snapshotId} value={s.snapshotId}>{snapshotLabel(s.snapshotId)}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          )}

          {rangeError ? <Callout tone="danger" title={rangeError} /> : null}
          {windowsOverlap ? <Callout tone="warning" title="Windows overlap">Runs that fall in both windows cannot be compared with themselves. The compatibility check will block it.</Callout> : null}
          {reversed ? <Callout tone="warning" title="Current is older than baseline">The result reads as a change backwards in time.</Callout> : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            <Field label="Prompt group">
              {({ id }) => (
                <Select id={id} value={filters.groupId ?? ""} onChange={(e) => setFilter("groupId", e.target.value)}>
                  <option value="">All groups</option>
                  {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Prompt">
              {({ id }) => (
                <Select id={id} value={filters.promptId ?? ""} onChange={(e) => setFilter("promptId", e.target.value)}>
                  <option value="">All prompts</option>
                  {data.prompts.filter((p) => !filters.groupId || p.groupId === filters.groupId).map((p) => <option key={p.id} value={p.id}>{p.text}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Provider and model">
              {({ id }) => (
                <Select id={id} value={filters.channelId ?? ""} onChange={(e) => setFilter("channelId", e.target.value)}>
                  <option value="">All channels</option>
                  {data.channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Market">
              {({ id }) => (
                <Select id={id} value={filters.market ?? ""} onChange={(e) => setFilter("market", e.target.value)}>
                  <option value="">All markets</option>
                  {data.markets.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Language">
              {({ id }) => (
                <Select id={id} value={filters.language ?? ""} onChange={(e) => setFilter("language", e.target.value)}>
                  <option value="">All languages</option>
                  {data.languages.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Competitor focus" hint="Limits the competitor view only.">
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} value={filters.competitorId ?? ""} onChange={(e) => setFilter("competitorId", e.target.value)}>
                  <option value="">All tracked competitors</option>
                  {data.competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Citation domain" hint="Measures citations of this domain instead of the owned domain.">
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} value={filters.domain ?? ""} onChange={(e) => setFilter("domain", e.target.value)}>
                  <option value="">Owned domain</option>
                  {data.domains.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              )}
            </Field>
            <div className="flex items-end">
              <Button variant="ghost" icon="x" onClick={() => setFilters({})} disabled={filterCount === 0}>Reset filters</Button>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 border-t border-line pt-5 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-fg">Matching policy</span>
              <div><Badge tone="accent" icon="check-circle">Strict exact</Badge></div>
              <p className="text-xs text-fg-subtle">{catalog.matching}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span id="aggregation-label" className="text-[13px] font-medium text-fg">Aggregation</span>
              <Segmented
                label="Aggregation"
                value={aggregation}
                onChange={setAggregation}
                options={[
                  { value: "matched_slot_macro", label: "Matched-slot macro" },
                  { value: "pooled", label: "Pooled" },
                ]}
              />
              <p className="text-xs text-fg-subtle">{catalog.aggregation[aggregation]}</p>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        preview ? (
          <div className="flex flex-col gap-5">
            <VerdictBanner
              verdict={preview.assessment.verdict}
              coverage={preview.assessment.coverage}
              unmatched={preview.matching.unmatched.length}
              excluded={preview.matching.excluded.length}
              checks={preview.assessment.checks}
            />
            {hardFail ? <Callout tone="danger" title="Cannot run">Change the baseline or current selection until every hard check passes.</Callout> : <Callout tone="success" title="Can run">All hard checks pass.{preview.assessment.verdict === "insufficient_data" ? " The result will be saved as insufficient data." : ""}</Callout>}
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-fg">Hard checks</h3>
                <CheckList checks={preview.assessment.checks.filter((c) => c.kind === "hard")} />
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-fg">Soft warnings</h3>
                <CheckList checks={preview.assessment.checks.filter((c) => c.kind === "soft")} />
              </section>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-card border border-line p-4 sm:grid-cols-3">
              <Metric label="Matched coverage" numerator={preview.assessment.coverage.n} denominator={preview.assessment.coverage.d} unit="slots" sampleStatus={preview.matching.pairs.length >= 20 ? "ok" : "directional"} />
              <Metric label="Mention rate · baseline" numerator={preview.mention.baseline.n} denominator={preview.mention.baseline.d} basis="matched cohort" />
              <Metric label="Mention rate · current" numerator={preview.mention.current.n} denominator={preview.mention.current.d} basis="matched cohort" />
            </div>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-fg">Excluded and unmatched slots <span className="tnum font-normal text-fg-subtle">({excludedRows.length})</span></h3>
              <DataTable
                label="Excluded and unmatched slots"
                data={excludedRows}
                columns={excludedColumns}
                rowKey={(r) => r.id}
                filters={excludedFilters}
                pageSize={5}
                dense
                empty={<p className="p-2 text-center text-[13px] text-fg-muted">Every slot matched.</p>}
              />
            </section>
          </div>
        ) : (
          <Callout tone="danger" title="Selection not found" />
        )
      ) : null}

      {step === 4 ? (
        <div className="flex flex-col gap-4">
          {phase === "idle" ? (
            <>
              <KeyValue
                columns={2}
                items={[
                  { label: "Type", value: catalog.types.find((t) => t.value === type)?.label },
                  { label: "Baseline", value: <Mono>{baseRef}</Mono> },
                  { label: "Current", value: <Mono>{curRef}</Mono> },
                  { label: "Verdict", value: verdict ? <Status kind="comparability" value={verdict} /> : "—" },
                ]}
              />
              <p className="text-[13px] text-fg-muted">Runs synchronously and opens {target.id}.</p>
            </>
          ) : null}
          {phase === "running" ? (
            <div className="flex items-center gap-2.5 text-[13px] text-fg-muted" role="status">
              <Spinner className="text-accent-text" />
              Matching {preview?.baselineRows ?? 0} baseline and {preview?.currentRows ?? 0} current requests…
            </div>
          ) : null}
          {phase === "done" && preview ? (
            <div className="flex flex-col gap-4">
              <Callout tone="success" title="Comparison completed">
                Saved as <Mono>{target.id}</Mono>. Results are immutable; recalculating creates a new revision.
              </Callout>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-card border border-line p-4 sm:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-muted">Comparability</span>
                  <Status kind="comparability" value={preview.assessment.verdict} />
                </div>
                <Metric label="Matched coverage" numerator={preview.assessment.coverage.n} denominator={preview.assessment.coverage.d} unit="slots" />
                <Metric label="Mention rate · baseline" numerator={preview.mention.baseline.n} denominator={preview.mention.baseline.d} basis="matched cohort" />
                <Metric label="Mention rate · current" numerator={preview.mention.current.n} denominator={preview.mention.current.d} basis="matched cohort" />
              </div>
              {preview.assessment.verdict === "insufficient_data" ? <Callout tone="warning" title="Low sample">Counts only. No trend is concluded below 20 matched pairs.</Callout> : null}
            </div>
          ) : null}
          <p className="sr-only" aria-live="polite">{phase === "done" ? `Comparison completed. ${STATUS.comparability[verdict ?? "insufficient_data"].label}.` : ""}</p>
        </div>
      ) : null}
    </WizardFrame>
  );
}
