"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { Checkbox, Field, Input, RadioCards, Segmented, Select, Switch, Textarea } from "@/components/ui/form";
import { formatCurrency } from "@/lib/format";
import { SEARCH_MODE_LABEL } from "@/lib/labels";
import type { SearchMode } from "@/types/core";
import type { WizardData } from "@/types/audit";

import {
  KIND_OPTIONS,
  LANGUAGES,
  MARKETS,
  PAGE_TYPE_OPTIONS,
  includedPrompts,
  limitations,
  predictUsage,
  searchModeOptions,
  urlLines,
  type PromptMode,
  type Usage,
  type WizardState,
} from "./wizard-model";

type StepProps = { data: WizardData; state: WizardState; set: (patch: Partial<WizardState>) => void };

const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

function Skipped({ lane }: { lane: string }) {
  return <Callout tone="neutral">{lane} is not selected, so there is nothing to configure here.</Callout>;
}

function Block({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div>
        <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
        {hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 1. Type and lanes
// ---------------------------------------------------------------------------

export function StepType({ state, set }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <Block title="Audit type">
        <RadioCards label="Audit type" columns={2} value={state.kind} onChange={(kind) => set({ kind })} options={KIND_OPTIONS} />
      </Block>
      <Block title="Lanes" hint="Reported separately. They are never merged into one score.">
        <div className="flex flex-col gap-3 rounded-control border border-line p-3">
          <Checkbox label="AI visibility" description="Ask AI providers your prompts and read the answers" checked={state.ai} onChange={(e) => set({ ai: e.target.checked })} />
          <Checkbox label="Website readiness" description="Crawl the site and run technical and content checks" checked={state.web} onChange={(e) => set({ web: e.target.checked })} />
        </div>
        {!state.ai && !state.web ? <p role="alert" className="text-xs text-danger">Select at least one lane.</p> : null}
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Prompts
// ---------------------------------------------------------------------------

export function StepPrompts({ data, state, set }: StepProps) {
  if (!state.ai) return <Skipped lane="AI visibility" />;
  const active = data.prompts.filter((p) => p.status === "active");
  const others = data.prompts.filter((p) => p.status !== "active");
  const included = new Set(includedPrompts(data, state).map((p) => p.id));
  const editable = state.promptMode === "ids";
  const reason = { draft: "Draft prompts are not run in audits", paused: "Paused prompts are not run", archived: "Archived prompts are kept for history only" } as const;

  return (
    <div className="flex flex-col gap-5">
      <RadioCards<PromptMode>
        label="Prompt selection"
        columns={3}
        value={state.promptMode}
        onChange={(promptMode) => set({ promptMode })}
        options={[
          { value: "all", label: "All active", description: `${active.length} prompts` },
          { value: "groups", label: "By group", description: "Pick prompt groups" },
          { value: "ids", label: "Specific prompts", description: "Pick individually" },
        ]}
      />

      {state.promptMode === "groups" ? (
        <Block title="Groups">
          <div className="flex flex-wrap gap-x-5 gap-y-2.5">
            {data.groups.map((g) => {
              const count = active.filter((p) => p.groupId === g.id).length;
              return <Checkbox key={g.id} label={`${g.name} · ${count}`} checked={state.groupIds.includes(g.id)} disabled={count === 0} onChange={() => set({ groupIds: toggle(state.groupIds, g.id) })} />;
            })}
          </div>
        </Block>
      ) : null}

      <Block title={`Active prompts · ${included.size} of ${active.length} included`} hint="The exact version of each prompt is fixed when the audit starts.">
        <ul className="ui-scroll max-h-80 divide-y divide-line overflow-y-auto rounded-control border border-line">
          {active.map((p) => (
            <li key={p.id} className="px-3 py-2.5">
              <Checkbox
                label={p.text}
                description={`${p.id} · v${p.version} · ${p.groupName} · ${p.intentLabel}${p.isCore ? " · Core" : ""}`}
                checked={included.has(p.id)}
                disabled={!editable}
                onChange={() => set({ promptIds: toggle(state.promptIds, p.id) })}
              />
            </li>
          ))}
        </ul>
        {state.promptMode === "ids" && included.size === 0 ? <p role="alert" className="text-xs text-danger">Select at least one prompt.</p> : null}
        {state.promptMode === "groups" && included.size === 0 ? <p role="alert" className="text-xs text-danger">Select at least one group with active prompts.</p> : null}
      </Block>

      {others.length > 0 ? (
        <details className="rounded-control border border-line">
          <summary className="cursor-pointer px-3 py-2.5 text-[13px] font-medium text-fg-muted">Not included · {others.length} paused, draft or archived</summary>
          <ul className="divide-y divide-line border-t border-line">
            {others.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-[13px] text-fg-muted">{p.text}</p>
                  <p className="text-xs text-fg-subtle">{p.id} · v{p.version} · {reason[p.status as "draft" | "paused" | "archived"]}</p>
                </div>
                <Status kind="prompt" value={p.status} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. AI channels
// ---------------------------------------------------------------------------

export function StepChannels({ data, state, set }: StepProps) {
  if (!state.ai) return <Skipped lane="AI visibility" />;
  return (
    <div className="flex flex-col gap-6">
      <Block title="Channels" hint="Each is a provider API, model and search mode. Results are API answer samples.">
        <ul className="divide-y divide-line rounded-control border border-line">
          {data.channels.map((c) => {
            const on = state.channelIds.includes(c.id);
            return (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)] items-center gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_14rem]">
                <Checkbox label={`${c.providerLabel} · ${c.apiLabel}`} description={`Model ${c.model}${c.supportsCitations ? " · returns citations" : " · no citations"}`} checked={on} onChange={() => set({ channelIds: toggle(state.channelIds, c.id) })} />
                <Field label="Search mode" className="md:items-stretch">
                  {({ id, describedBy }) => (
                    <Select id={id} aria-label={`Search mode for ${c.providerLabel}`} aria-describedby={describedBy} disabled={!on} value={state.searchModes[c.id] ?? c.searchMode} onChange={(e) => set({ searchModes: { ...state.searchModes, [c.id]: e.target.value as SearchMode } })}>
                      {searchModeOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              </li>
            );
          })}
        </ul>
        {state.channelIds.length === 0 ? <p role="alert" className="text-xs text-danger">Select at least one channel.</p> : null}
      </Block>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
        <Field label="Market">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={state.market} onChange={(e) => set({ market: e.target.value })}>
              {MARKETS.map((m) => (
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
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-fg">Samples per prompt</span>
          <Segmented label="Samples per prompt" value={String(state.samples)} onChange={(v) => set({ samples: Number(v) })} options={["1", "2", "3", "5"].map((v) => ({ value: v, label: v }))} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Website scope
// ---------------------------------------------------------------------------

export function StepWebsite({ data, state, set }: StepProps) {
  if (!state.web) return <Skipped lane="Website readiness" />;
  const listCount = urlLines(state.urlList).length;
  return (
    <div className="flex flex-col gap-6">
      <Block title="Start points">
        <div className="flex flex-col gap-3 rounded-control border border-line p-3">
          <Checkbox label="Homepage" description={`https://${data.store.domain}/`} checked={state.startHomepage} onChange={(e) => set({ startHomepage: e.target.checked })} />
          <Checkbox label="Sitemap" description={`https://${data.store.domain}/sitemap.xml`} checked={state.startSitemap} onChange={(e) => set({ startSitemap: e.target.checked })} />
          <Checkbox label="URL list" description="One URL per line" checked={state.startUrlList} onChange={(e) => set({ startUrlList: e.target.checked })} />
          {state.startUrlList ? (
            <Field label="URLs" error={listCount === 0 ? "Add at least one URL." : undefined}>
              {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={4} placeholder={`https://${data.store.domain}/products/glide-2`} value={state.urlList} onChange={(e) => set({ urlList: e.target.value })} />}
            </Field>
          ) : null}
          <Checkbox
            label="CMS import"
            description={data.integrations.cms ? "Product and page URLs from the connected store" : "Connect the CMS in store settings to enable"}
            checked={state.startCms}
            disabled={!data.integrations.cms}
            onChange={(e) => set({ startCms: e.target.checked })}
          />
        </div>
        {!state.startHomepage && !state.startSitemap && !state.startUrlList && !state.startCms ? <p role="alert" className="text-xs text-danger">Choose at least one start point.</p> : null}
      </Block>

      <Block title="Page types" hint="Only these types are assessed.">
        <div className="flex flex-wrap gap-x-5 gap-y-2.5">
          {PAGE_TYPE_OPTIONS.map((t) => (
            <Checkbox key={t.value} label={t.label} checked={state.pageTypes.includes(t.value)} onChange={() => set({ pageTypes: toggle(state.pageTypes, t.value) })} />
          ))}
        </div>
        {state.pageTypes.length === 0 ? <p role="alert" className="text-xs text-danger">Select at least one page type.</p> : null}
      </Block>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label="Excluded paths" hint="One per line. Matching pages are out of scope.">
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={4} className="font-mono text-xs" value={state.excludedPaths} onChange={(e) => set({ excludedPaths: e.target.value })} />}
        </Field>
        <Field label="Maximum depth" hint="Clicks from a start point.">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={String(state.maxDepth)} onChange={(e) => set({ maxDepth: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Criteria, integrations, limits
// ---------------------------------------------------------------------------

function ToggleRow({ title, description, checked, onChange, disabled, extra }: { title: string; description: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg">{title}{extra}</p>
        <p className="text-xs text-fg-subtle">{description}</p>
      </div>
      <Switch label={title} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function StepCriteria({ data, state, set }: StepProps) {
  const positive = (n: number) => (n > 0 ? undefined : "Enter a number above 0.");
  return (
    <div className="flex flex-col gap-6">
      <Field label="Criteria version" hint="Rules the website checks are evaluated against.">
        {({ id, describedBy }) => (
          <Select id={id} aria-describedby={describedBy} value={state.criteria} onChange={(e) => set({ criteria: e.target.value })}>
            <option value="2.1">2.1 (current)</option>
            <option value="2.0">2.0</option>
          </Select>
        )}
      </Field>

      <Block title="Integrations">
        <div className="divide-y divide-line rounded-control border border-line">
          <ToggleRow
            title="Search Console"
            description="Indexing coverage and queries"
            checked={state.searchConsole}
            disabled={!data.integrations.searchConsole}
            onChange={(searchConsole) => set({ searchConsole })}
            extra={
              data.integrations.searchConsole ? (
                <Badge tone="success" icon="check-circle">Connected</Badge>
              ) : (
                <Link href={`/stores/${data.store.id}/settings`} className="text-xs font-medium text-accent-text hover:underline">Connect</Link>
              )
            }
          />
          <ToggleRow title="PageSpeed Insights" description="Lab performance data. Field data is reported only where it exists." checked={state.pageSpeed} onChange={(pageSpeed) => set({ pageSpeed })} />
          <ToggleRow
            title="CMS connector"
            description="Product facts straight from the store"
            checked={state.cms}
            disabled={!data.integrations.cms}
            onChange={(cms) => set({ cms })}
            extra={
              data.integrations.cms ? (
                <Badge tone="success" icon="check-circle">Connected</Badge>
              ) : (
                <Link href={`/stores/${data.store.id}/settings`} className="text-xs font-medium text-accent-text hover:underline">Connect</Link>
              )
            }
          />
        </div>
      </Block>

      <Block title="Limits" hint="The audit stops at a limit and is marked partially completed.">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <Field label="Maximum URLs" error={positive(state.maxUrls)}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="number" min={1} inputMode="numeric" value={state.maxUrls || ""} onChange={(e) => set({ maxUrls: Number(e.target.value) })} />}
          </Field>
          <Field label="Maximum provider requests" error={positive(state.maxRequests)}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="number" min={1} inputMode="numeric" value={state.maxRequests || ""} onChange={(e) => set({ maxRequests: Number(e.target.value) })} />}
          </Field>
          <Field label="Concurrency">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={String(state.concurrency)} onChange={(e) => set({ concurrency: Number(e.target.value) })}>
                {[1, 2, 4, 8].map((n) => (
                  <option key={n} value={n}>{n} at a time</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Budget cap (USD)" error={positive(state.budgetUsd)}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="number" min={1} inputMode="decimal" value={state.budgetUsd || ""} onChange={(e) => set({ budgetUsd: Number(e.target.value) })} />}
          </Field>
        </div>
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Review
// ---------------------------------------------------------------------------

export function StepReview({ data, state, usage, onEdit }: StepProps & { usage: Usage; onEdit: (step: number) => void }) {
  const found = limitations(data, state, usage);
  const kind = KIND_OPTIONS.find((k) => k.value === state.kind)?.label ?? state.kind;
  const channelNames = data.channels.filter((c) => state.channelIds.includes(c.id)).map((c) => `${c.providerLabel} · ${SEARCH_MODE_LABEL[state.searchModes[c.id] ?? c.searchMode]}`);
  const starts = [state.startHomepage && "Homepage", state.startSitemap && "Sitemap", state.startUrlList && `URL list (${urlLines(state.urlList).length})`, state.startCms && "CMS import"].filter(Boolean) as string[];

  const row = (title: string, step: number, children: ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{title}</p>
        {children}
      </div>
      <Button variant="ghost" size="sm" icon="pencil" onClick={() => onEdit(step)}>Edit</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="divide-y divide-line">
        {row("Type and lanes", 0, <p className="text-[13px] text-fg">{kind} · {[state.ai && "AI visibility", state.web && "Website readiness"].filter(Boolean).join(" + ")}</p>)}
        {state.ai
          ? row(
              "Prompts",
              1,
              <p className="text-[13px] text-fg">
                <span className="tnum">{usage.prompts}</span> active prompts ({state.promptMode === "all" ? "all active" : state.promptMode === "groups" ? "by group" : "specific"}), versions fixed at start
              </p>,
            )
          : null}
        {state.ai
          ? row(
              "AI channels",
              2,
              <p className="text-[13px] text-fg">
                {channelNames.join(", ")} · {state.market} · {state.language.toUpperCase()} · <span className="tnum">{state.samples}</span> {state.samples === 1 ? "sample" : "samples"}
              </p>,
            )
          : null}
        {state.web
          ? row(
              "Website scope",
              3,
              <p className="text-[13px] text-fg">
                {starts.join(", ")} · {state.pageTypes.length} page types · depth {state.maxDepth} · {urlLines(state.excludedPaths).length} excluded paths
              </p>,
            )
          : null}
        {row(
          "Criteria and limits",
          4,
          <p className="text-[13px] text-fg">
            Criteria {state.criteria} · {[state.searchConsole && "Search Console", state.pageSpeed && "PageSpeed", state.cms && "CMS"].filter(Boolean).join(", ") || "no integrations"} · up to <span className="tnum">{state.maxUrls}</span> URLs, <span className="tnum">{state.maxRequests}</span> requests, ${state.budgetUsd}
          </p>,
        )}
      </div>

      <Card as="section">
        <CardHeader title="Limitations" subtitle={found.length ? `${found.length} to be aware of` : undefined} />
        <CardBody className="flex flex-col gap-2">
          {found.length === 0 ? <p className="text-[13px] text-fg-muted">None beyond the usual API-answer-sample caveat.</p> : found.map((l) => <Callout key={l.id} tone={l.tone}>{l.text}</Callout>)}
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live usage (aside)
// ---------------------------------------------------------------------------

export function UsageAside({ data, state }: { data: WizardData; state: WizardState }) {
  const usage = predictUsage(data, state);
  return (
    <Card as="section">
      <CardHeader title="Predicted usage" info="Jobs = prompts × channels × samples. Cost is an approximation from typical per-request pricing." actions={<Badge tone="neutral">Approximate</Badge>} />
      <CardBody className="flex flex-col gap-4">
        <div>
          <p className="tnum text-[26px] font-semibold leading-none tracking-tight text-fg">{state.ai ? usage.jobs : "—"}</p>
          <p className="tnum mt-1.5 text-xs text-fg-subtle">{state.ai ? `${usage.prompts} prompts × ${usage.channels} channels × ${usage.samples} samples = jobs` : "AI lane off"}</p>
        </div>
        <KeyValue
          columns={2}
          items={[
            { label: "Pages to crawl", value: <span className="tnum">{state.web ? `≈ ${usage.pages}` : "—"}</span> },
            { label: "Approx. cost", value: <span className="tnum">≈ {formatCurrency(usage.costUsd)}</span> },
          ]}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-xs text-fg-subtle">
            <span>Against budget cap</span>
            <span className="tnum">{formatCurrency(usage.costUsd)} / {formatCurrency(state.budgetUsd)}</span>
          </div>
          <Progress value={usage.costUsd} max={Math.max(state.budgetUsd, 0.01)} label="Approximate cost against budget cap" tone={usage.overBudget ? "danger" : usage.costUsd / Math.max(state.budgetUsd, 0.01) > 0.85 ? "warning" : "accent"} />
        </div>
        {usage.overBudget ? <Callout tone="warning">Over the budget cap. Reduce scope or raise the cap.</Callout> : null}
        {usage.overRequests ? <Callout tone="warning">Jobs exceed the request limit of {state.maxRequests}.</Callout> : null}
      </CardBody>
    </Card>
  );
}
