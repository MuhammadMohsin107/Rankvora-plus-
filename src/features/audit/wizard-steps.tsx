"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, KeyValue } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { Checkbox, Field, Input, RadioCards, Segmented, Select, Switch, Textarea } from "@/components/ui/form";
import { formatCurrency } from "@/lib/format";
import { SEARCH_MODE_LABEL } from "@/lib/labels";
import type { SearchMode } from "@/types/core";
import type { WizardData, WizardPrompt } from "@/types/audit";

import { CRITERIA_CATEGORIES, formatMinutes, websiteConnectionsHref } from "./labels";
import {
  KIND_OPTIONS,
  LANGUAGES,
  PAGE_TYPE_OPTIONS,
  applyFinding,
  includedPrompts,
  limitations,
  marketOptions,
  searchModeOptions,
  urlLines,
  type PromptMode,
  type Usage,
  type WizardState,
} from "./wizard-model";

type StepProps = { data: WizardData; state: WizardState; set: (patch: Partial<WizardState>) => void; prompts: WizardPrompt[] };

const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

function Skipped({ lane }: { lane: string }) {
  return <Callout tone="neutral">{lane} is not selected, so there is nothing to set here.</Callout>;
}

/** Advanced settings stay closed until asked for. */
function Advanced({ title = "Advanced", children }: { title?: string; children: ReactNode }) {
  return (
    <details className="group rounded-control border border-line">
      <summary className="cursor-pointer select-none px-3 py-2.5 text-label font-medium text-fg-muted marker:text-fg-subtle">{title}</summary>
      <div className="flex flex-col gap-3 border-t border-line p-3">{children}</div>
    </details>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h3 className="text-label font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 1. Type
// ---------------------------------------------------------------------------

export function StepType({ data, state, set, prompts }: StepProps) {
  return (
    <div className="flex flex-col gap-3">
      <RadioCards label="Audit type" columns={3} value={state.kind} onChange={(kind) => set({ kind, ...(kind === "verification" ? { samples: 1 } : {}) })} options={KIND_OPTIONS} />

      {state.kind === "verification" ? (
        <Field label="Finding to re-check" required hint="Re-checks the prompts and pages the finding affected.">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={state.findingId} onChange={(e) => set(applyFinding(state, data, prompts, e.target.value))}>
              <option value="">Choose a finding</option>
              {data.findings.map((f) => (
                <option key={f.id} value={f.id}>{f.id} · {f.title}</option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Lanes
// ---------------------------------------------------------------------------

export function StepLanes({ state, set }: StepProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-control border border-line p-3">
        <Checkbox label="AI visibility" description="Ask AI providers your prompts and read the answers" checked={state.ai} onChange={(e) => set({ ai: e.target.checked })} />
        <Checkbox label="Website readiness" description="Crawl the site and run technical and content checks" checked={state.web} onChange={(e) => set({ web: e.target.checked })} />
      </div>
      <p className="text-helper text-fg-muted">Reported separately. Never merged into one score.</p>
      {!state.ai && !state.web ? <p role="alert" className="text-helper text-danger-text">Select at least one lane.</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Prompts and groups
// ---------------------------------------------------------------------------

export function StepPrompts({ data, state, set, prompts }: StepProps) {
  if (!state.ai) return <Skipped lane="AI visibility" />;
  const active = prompts.filter((p) => p.status === "active");
  const others = prompts.filter((p) => p.status !== "active");
  const included = new Set(includedPrompts(prompts, state).map((p) => p.id));
  const answered = new Set(data.answeredPromptIds);
  const editable = state.promptMode === "ids";
  const groups = [...new Map(prompts.filter((p) => p.groupId).map((p) => [p.groupId as string, p.groupName])).entries()].map(([id, name]) => ({ id, name }));

  return (
    <div className="flex flex-col gap-3">
      <RadioCards<PromptMode>
        label="Prompt selection"
        columns={3}
        value={state.promptMode}
        onChange={(promptMode) => set({ promptMode })}
        options={[
          { value: "all", label: "All active", description: "Every active prompt" },
          { value: "groups", label: "By group", description: "Pick prompt groups" },
          { value: "ids", label: "Specific prompts", description: "Pick individually" },
        ]}
      />

      {state.promptMode === "groups" ? (
        <Block title="Groups">
          <div className="flex flex-wrap gap-x-5 gap-y-2.5">
            {groups.map((g) => {
              const count = active.filter((p) => p.groupId === g.id).length;
              return <Checkbox key={g.id} label={`${g.name} · ${count}`} checked={state.groupIds.includes(g.id)} disabled={count === 0} onChange={() => set({ groupIds: toggle(state.groupIds, g.id) })} />;
            })}
          </div>
        </Block>
      ) : null}

      <Block title={`${included.size} of ${active.length} active prompts included`}>
        <ul className="ui-scroll max-h-72 divide-y divide-line overflow-y-auto rounded-control border border-line">
          {active.map((p) => (
            <li key={p.id} className="px-3 py-2.5">
              <Checkbox
                label={p.text}
                description={`v${p.version} · ${p.groupName}${answered.has(p.id) ? "" : " · No demo answers"}`}
                checked={included.has(p.id)}
                disabled={!editable}
                onChange={() => set({ promptIds: toggle(state.promptIds, p.id) })}
              />
            </li>
          ))}
        </ul>
        {included.size === 0 ? <p role="alert" className="text-helper text-danger-text">{state.promptMode === "groups" ? "Select a group with active prompts." : "Select at least one prompt."}</p> : null}
      </Block>

      {others.length > 0 ? (
        <Advanced title={`Not included (${others.length} paused, draft or archived)`}>
          <ul className="divide-y divide-line">
            {others.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <p className="min-w-0 flex-1 text-label text-fg-muted">{p.text}</p>
                <Status kind="prompt" value={p.status} />
              </li>
            ))}
          </ul>
        </Advanced>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Providers and models
// ---------------------------------------------------------------------------

export function StepProviders({ data, state, set }: StepProps) {
  if (!state.ai) return <Skipped lane="AI visibility" />;
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line rounded-control border border-line">
        {data.channels.map((c) => {
          const on = state.channelIds.includes(c.id);
          return (
            <li key={c.id} className="grid grid-cols-[minmax(0,1fr)] items-center gap-3 px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_14rem]">
              <Checkbox label={`${c.providerLabel} · ${c.model}`} description={c.supportsCitations ? "Returns citations" : "No citations"} checked={on} onChange={() => set({ channelIds: toggle(state.channelIds, c.id) })} />
              <Select aria-label={`Search mode for ${c.providerLabel}`} disabled={!on} value={state.searchModes[c.id] ?? c.searchMode} onChange={(e) => set({ searchModes: { ...state.searchModes, [c.id]: e.target.value as SearchMode } })}>
                {searchModeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </li>
          );
        })}
      </ul>
      {state.channelIds.length === 0 ? <p role="alert" className="text-helper text-danger-text">Select at least one provider.</p> : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-medium text-fg">Samples per prompt</span>
        <Segmented label="Samples per prompt" value={String(state.samples)} onChange={(v) => set({ samples: Number(v) })} options={["1", "2", "3", "5"].map((v) => ({ value: v, label: v }))} className="self-start" />
      </div>
      <p className="text-helper text-fg-muted">Results are API answer samples, not consumer-app results.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Market and language
// ---------------------------------------------------------------------------

export function StepMarket({ data, state, set }: StepProps) {
  if (!state.ai) return <Skipped lane="AI visibility" />;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
      <Field label="Market" hint={`This website: ${data.store.marketName}`}>
        {({ id, describedBy }) => (
          <Select id={id} aria-describedby={describedBy} value={state.market} onChange={(e) => set({ market: e.target.value })}>
            {marketOptions(data).map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Language">
        {({ id, describedBy }) => (
          <Select id={id} aria-describedby={describedBy} value={state.language} onChange={(e) => set({ language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Website crawl scope
// ---------------------------------------------------------------------------

export function StepWebsite({ data, state, set }: StepProps) {
  if (!state.web) return <Skipped lane="Website readiness" />;
  const listCount = urlLines(state.urlList).length;
  const available = new Set<string>(data.pageTypes);
  return (
    <div className="flex flex-col gap-3">
      <Block title="Start points">
        <div className="flex flex-col gap-3 rounded-control border border-line p-3">
          <Checkbox label="Homepage" description={`https://${data.store.domain}/`} checked={state.startHomepage} onChange={(e) => set({ startHomepage: e.target.checked })} />
          <Checkbox label="Sitemap" description={`https://${data.store.domain}/sitemap.xml`} checked={state.startSitemap} onChange={(e) => set({ startSitemap: e.target.checked })} />
          <Checkbox label="URL list" description="One URL per line" checked={state.startUrlList} onChange={(e) => set({ startUrlList: e.target.checked })} />
          {state.startUrlList ? (
            <Field label="URLs" error={listCount === 0 ? "Add at least one URL." : undefined}>
              {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={4} placeholder={`https://${data.store.domain}/about`} value={state.urlList} onChange={(e) => set({ urlList: e.target.value })} />}
            </Field>
          ) : null}
          <Checkbox
            label="Website connector"
            description={data.integrations.cms ? "Page URLs from the connected website" : data.integrations.cmsNeedsAttention ? "The connector needs attention" : "Optional. Connect one in Website settings"}
            checked={state.startCms}
            disabled={!data.integrations.cms}
            onChange={(e) => set({ startCms: e.target.checked })}
          />
        </div>
        {!state.startHomepage && !state.startSitemap && !state.startUrlList && !state.startCms ? <p role="alert" className="text-helper text-danger-text">Choose at least one start point.</p> : null}
      </Block>

      <Block title="Page types">
        <div className="flex flex-wrap gap-x-5 gap-y-2.5">
          {PAGE_TYPE_OPTIONS.filter((t) => available.size === 0 || available.has(t.value)).map((t) => (
            <Checkbox key={t.value} label={t.label} checked={state.pageTypes.includes(t.value)} onChange={() => set({ pageTypes: toggle(state.pageTypes, t.value) })} />
          ))}
        </div>
        {state.pageTypes.length === 0 ? <p role="alert" className="text-helper text-danger-text">Select at least one page type.</p> : null}
      </Block>

      <Advanced title="Depth and exclusions">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          <Field label="Excluded paths" hint="One per line">
            {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={4} className="font-mono text-xs" value={state.excludedPaths} onChange={(e) => set({ excludedPaths: e.target.value })} />}
          </Field>
          <Field label="Maximum depth" hint="Clicks from a start point">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={String(state.maxDepth)} onChange={(e) => set({ maxDepth: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Advanced>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Criteria
// ---------------------------------------------------------------------------

function ToggleRow({ title, description, checked, onChange, disabled, extra }: { title: string; description: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-body-sm text-fg">{title}{extra}</p>
        <p className="text-helper text-fg-subtle">{description}</p>
      </div>
      <Switch label={title} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function StepCriteria({ data, state, set }: StepProps) {
  if (!state.web) return <Skipped lane="Website readiness" />;
  return (
    <div className="flex flex-col gap-3">
      <Block title="Categories">
        <div className="flex flex-wrap gap-x-5 gap-y-2.5">
          {CRITERIA_CATEGORIES.map((c) => (
            <Checkbox key={c.id} label={c.label} checked={state.categories.includes(c.id)} onChange={() => set({ categories: toggle(state.categories, c.id) })} />
          ))}
        </div>
        {state.categories.length === 0 ? <p role="alert" className="text-helper text-danger-text">Select at least one category.</p> : null}
      </Block>

      <Block title="Data sources">
        <div className="divide-y divide-line rounded-control border border-line">
          <ToggleRow
            title="Search Console"
            description="Indexing coverage"
            checked={state.searchConsole}
            disabled={!data.integrations.searchConsole}
            onChange={(searchConsole) => set({ searchConsole })}
            extra={data.integrations.searchConsole ? <Badge tone="success" icon="check-circle">Connected</Badge> : <Link href={websiteConnectionsHref(data.store.id)} className="text-helper font-medium text-accent-text hover:underline">Connect</Link>}
          />
          <ToggleRow title="PageSpeed Insights" description="Lab performance. Field data only where it exists." checked={state.pageSpeed} onChange={(pageSpeed) => set({ pageSpeed })} />
          <ToggleRow
            title="Website connector"
            description="Optional. Page facts from your CMS"
            checked={state.cms}
            disabled={!data.integrations.cms}
            onChange={(cms) => set({ cms })}
            extra={data.integrations.cms ? <Badge tone="success" icon="check-circle">Connected</Badge> : <Link href={websiteConnectionsHref(data.store.id)} className="text-helper font-medium text-accent-text hover:underline">{data.integrations.cmsNeedsAttention ? "Fix" : "Connect"}</Link>}
          />
        </div>
      </Block>

      <Advanced title="Criteria version">
        <Field label="Rules the checks run against">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={state.criteria} onChange={(e) => set({ criteria: e.target.value })}>
              <option value="2.1">2.1 (current)</option>
              <option value="2.0">2.0</option>
            </Select>
          )}
        </Field>
      </Advanced>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Limits
// ---------------------------------------------------------------------------

export function StepLimits({ state, set }: StepProps) {
  const positive = (n: number) => (n > 0 ? undefined : "Enter a number above 0.");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        {state.web ? (
          <Field label="Maximum URLs" error={positive(state.maxUrls)}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="number" min={1} inputMode="numeric" value={state.maxUrls || ""} onChange={(e) => set({ maxUrls: Number(e.target.value) })} />}
          </Field>
        ) : null}
        <Field label="Maximum requests" error={positive(state.maxRequests)}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="number" min={1} inputMode="numeric" value={state.maxRequests || ""} onChange={(e) => set({ maxRequests: Number(e.target.value) })} />}
        </Field>
        <Field label="Budget cap (USD)" error={positive(state.budgetUsd)}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="number" min={1} inputMode="decimal" value={state.budgetUsd || ""} onChange={(e) => set({ budgetUsd: Number(e.target.value) })} />}
        </Field>
      </div>
      <p className="text-helper text-fg-muted">The audit stops at a limit and is marked partially completed.</p>

      <Advanced>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:max-w-xs">
          <Field label="Concurrency">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={String(state.concurrency)} onChange={(e) => set({ concurrency: Number(e.target.value) })}>
                {[1, 2, 4, 8].map((n) => (
                  <option key={n} value={n}>{n} at a time</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Simulation outcome" hint="Demo control: reach every end state without waiting for one.">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={state.scenario} onChange={(e) => set({ scenario: e.target.value as WizardState["scenario"] })}>
              <option value="normal">Normal</option>
              <option value="provider_outage">Provider outage (fails)</option>
              <option value="crawl_blocked">Crawler blocked (blocked)</option>
            </Select>
          )}
        </Field>
      </Advanced>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9. Workload and cost
// ---------------------------------------------------------------------------

export function StepEstimate({ state, usage }: StepProps & { usage: Usage }) {
  const ratio = usage.costUsd / Math.max(state.budgetUsd, 0.01);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info" icon="info">Illustrative estimate</Badge>
        <p className="text-helper text-fg-muted">From typical per-request pricing. Nothing is charged in this demo.</p>
      </div>
      <KeyValue
        columns={3}
        items={[
          { label: "AI requests", value: <span className="tnum">{state.ai ? usage.jobs : "Not included"}</span> },
          { label: "Pages to crawl", value: <span className="tnum">{state.web ? `about ${usage.pages}` : "Not included"}</span> },
          { label: "Run time", value: <span className="tnum">about {formatMinutes(usage.durationSeconds)}</span> },
        ]}
      />
      {state.ai ? <p className="tnum text-helper text-fg-muted">{usage.prompts} prompts × {usage.channels} providers × {usage.samples} {usage.samples === 1 ? "sample" : "samples"}</p> : null}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-label text-fg-muted">
          <span>Cost against budget cap</span>
          <span className="tnum">about {formatCurrency(usage.costUsd)} of {formatCurrency(state.budgetUsd)}</span>
        </div>
        <Progress value={usage.costUsd} max={Math.max(state.budgetUsd, 0.01)} label="Estimated cost against budget cap" tone={usage.overBudget ? "danger" : ratio > 0.85 ? "warning" : "accent"} />
      </div>
      {usage.overBudget ? <Callout tone="warning">The estimate is above the budget cap. Reduce the scope or raise the cap.</Callout> : null}
      {usage.overRequests ? <Callout tone="warning">{usage.jobs} requests are above the limit of {state.maxRequests}.</Callout> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 10. Review
// ---------------------------------------------------------------------------

export function StepReview({ data, state, usage, prompts, onEdit }: StepProps & { usage: Usage; onEdit: (step: number) => void }) {
  const found = limitations(data, state, usage, prompts).filter((l) => l.id !== "requests" && l.id !== "budget");
  const kind = KIND_OPTIONS.find((k) => k.value === state.kind)?.label ?? state.kind;
  const channelNames = data.channels.filter((c) => state.channelIds.includes(c.id)).map((c) => `${c.providerLabel} · ${SEARCH_MODE_LABEL[state.searchModes[c.id] ?? c.searchMode]}`);
  const starts = [state.startHomepage && "Homepage", state.startSitemap && "Sitemap", state.startUrlList && `URL list (${urlLines(state.urlList).length})`, state.startCms && "Connector"].filter(Boolean) as string[];

  const row = (title: string, step: number, children: ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-helper font-semibold uppercase tracking-wide text-fg-subtle">{title}</p>
        <div className="text-body-sm text-fg">{children}</div>
      </div>
      <Button variant="ghost" size="sm" icon="pencil" onClick={() => onEdit(step)}>Edit</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="divide-y divide-line">
        {row("Type and lanes", 0, `${kind} · ${[state.ai && "AI visibility", state.web && "Website readiness"].filter(Boolean).join(" + ")}`)}
        {state.ai ? row("Prompts and providers", 2, <span className="tnum">{usage.prompts} prompts · {channelNames.join(", ")} · {state.samples} {state.samples === 1 ? "sample" : "samples"}</span>) : null}
        {state.ai ? row("Market and language", 4, `${state.market} · ${state.language.toUpperCase()}`) : null}
        {state.web ? row("Website scope", 5, <span className="tnum">{starts.join(", ")} · {state.pageTypes.length} page types · up to {state.maxUrls} URLs</span>) : null}
        {row("Estimate", 7, <span className="tnum">{state.ai ? `${usage.jobs} requests` : ""}{state.ai && state.web ? " · " : ""}{state.web ? `about ${usage.pages} pages` : ""} · about {formatCurrency(usage.costUsd)}</span>)}
      </div>
      {found.length > 0 ? (
        <div className="flex flex-col gap-2" aria-label="Limitations">
          {found.map((l) => (
            <Callout key={l.id} tone={l.tone}>{l.text}</Callout>
          ))}
        </div>
      ) : (
        <p className="text-label text-fg-muted">No limitations beyond the usual API-answer-sample caveat.</p>
      )}
    </div>
  );
}
