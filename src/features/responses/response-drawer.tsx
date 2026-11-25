"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, KeyValue } from "@/components/ui/card";
import { SimulatedBadge } from "@/components/ui/demo";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { HighlightedText, Mono } from "@/components/ui/misc";
import { Drawer } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { demoNow, useDemoSettings, simulatedToast } from "@/demo-state";
import type { EvidenceIds } from "@/features/evidence/chain";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import { formatDateTime } from "@/lib/format";
import { CITATION_SOURCE_LABEL, SEARCH_MODE_LABEL } from "@/lib/labels";
import type { ResponseSample } from "@/types/shared-records";

import {
  API_SAMPLE_LABEL,
  NO_REVIEW,
  REVIEW_FIELDS,
  confidenceLevel,
  confidencePercent,
  groupCitations,
  latencySeconds,
  responseEvidenceIds,
  reviewSettingKey,
  sampleLabel,
  spanCounts,
  type ReviewField,
  type ReviewRequest,
} from "./response-model";

const sourceTone = { owned: "success", competitor: "warning", third_party: "neutral" } as const;
const levelTone = { high: "success", medium: "warning", low: "danger" } as const;

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-1.5 text-helper font-semibold uppercase tracking-wide text-fg-subtle">{children}</h3>;
}

function Legend() {
  return (
    <span className="flex items-center gap-3 text-helper text-fg-subtle">
      <span className="flex items-center gap-1"><span aria-hidden="true" className="size-2 rounded-sm bg-accent-soft ring-1 ring-accent/40" />Brand</span>
      <span className="flex items-center gap-1"><span aria-hidden="true" className="size-2 rounded-sm bg-warning-soft ring-1 ring-warning/40" />Competitor</span>
    </span>
  );
}

function AnswerTab({ response }: { response: ResponseSample }) {
  const failed = response.status === "failed";
  const counts = spanCounts(response);
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Prompt">
        <SectionTitle>Exact prompt sent · v{response.promptVersion}</SectionTitle>
        <p className="rounded-control border border-line bg-surface-2 px-3 py-2.5 text-body-sm text-fg">{response.promptText}</p>
      </section>

      {failed ? (
        <Callout tone="danger" title="Request failed">
          {response.failure?.message}. Attempts: {response.failure?.attempts}. Not counted as absent.
        </Callout>
      ) : (
        <section aria-label="Original answer">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-helper font-semibold uppercase tracking-wide text-fg-subtle">Original answer</h3>
            <Legend />
          </div>
          <div className="rounded-control border border-line bg-surface p-3">
            <HighlightedText text={response.answerText} spans={response.brandSpans} />
          </div>
          <p className="tnum mt-1.5 text-helper text-fg-muted">
            Highlighted: {counts.brand} brand {counts.brand === 1 ? "mention" : "mentions"}, {counts.competitor} competitor {counts.competitor === 1 ? "mention" : "mentions"}
          </p>
        </section>
      )}

      {!failed ? (
        <section aria-label="Recommendation context">
          <SectionTitle>Recommendation context</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Status kind="recommendation" value={response.recommendation} />
            {response.position ? <Badge tone="neutral">#{response.position} in an ordered list</Badge> : <Badge tone="neutral">No ordered list</Badge>}
          </div>
          {response.evidenceQuote ? (
            <blockquote className="mt-2 border-l-2 border-accent pl-3 text-body-sm italic text-fg-muted">“{response.evidenceQuote}”</blockquote>
          ) : (
            <p className="mt-2 text-body-sm text-fg-muted">No supporting sentence.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

const noSubscribe = () => () => {};
const citedParam = () => new URLSearchParams(window.location.search).get("citation");

function CitationList({ response }: { response: ResponseSample }) {
  // A link with ?citation=<url> (from the evidence chain) marks that citation in the list.
  const cited = useSyncExternalStore(noSubscribe, citedParam, () => null);
  if (response.citationSupport === "not_supported") return <p className="text-body-sm text-fg-muted">Not supported by this provider (N/A).</p>;
  if (response.citations.length === 0) return <p className="text-body-sm text-fg-muted">No citation returned.</p>;
  return (
    <div className="flex flex-col gap-3">
      {groupCitations(response.citations).map(({ source, items }) =>
        items.length === 0 ? null : (
          <div key={source}>
            <div className="mb-1 flex items-center gap-2">
              <Badge tone={sourceTone[source]}>{CITATION_SOURCE_LABEL[source]}</Badge>
              <span className="tnum text-helper text-fg-muted">{items.length}</span>
            </div>
            <ul className="divide-y divide-line rounded-control border border-line">
              {items.map((c) => (
                <li key={c.url} aria-current={c.url === cited ? "true" : undefined} className={c.url === cited ? "min-w-0 bg-accent-soft px-3 py-2" : "min-w-0 px-3 py-2"}>
                  <a href={c.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-target max-w-full items-center gap-1 text-body-sm font-medium text-accent-text hover:underline">
                    <span className="truncate">{c.title}</span>
                    <Icon name="external" size={12} className="shrink-0" />
                  </a>
                  <p className="truncate text-helper text-fg-subtle">{c.domain}</p>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}

function AnalysisTab({ response }: { response: ResponseSample }) {
  if (response.status === "failed") return <p className="text-body-sm text-fg-muted">Request failed. Excluded from rates.</p>;
  const level = confidenceLevel(response.confidence);
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Analysis">
        <SectionTitle>Analysis · version {response.analysisVersion}</SectionTitle>
        <KeyValue
          columns={2}
          items={[
            { label: "Brand mentioned", value: response.brandMentioned === "yes" ? <Badge tone="success" icon="check-circle">Yes</Badge> : response.brandMentioned === "no" ? <Badge tone="neutral" icon="minus-circle">No</Badge> : <Badge tone="warning" icon="help">Uncertain</Badge> },
            { label: "Recommendation", value: <Status kind="recommendation" value={response.recommendation} /> },
            { label: "Sentiment", value: <Status kind="sentiment" value={response.sentiment} /> },
            { label: "Confidence", value: <span className="tnum inline-flex items-center gap-1.5">{confidencePercent(response.confidence)}% <Badge tone={levelTone[level]}>{level}</Badge></span> },
            { label: "Competitors named", value: response.competitors.filter((c) => c.mentioned).map((c) => c.name).join(", ") || "None" },
          ]}
        />
      </section>
      <section aria-label="Citations">
        <SectionTitle>Citations returned</SectionTitle>
        <CitationList response={response} />
      </section>
    </div>
  );
}

function ReviewControl({ response }: { response: ResponseSample }) {
  const toast = useToast();
  const { value, save, clear } = useDemoSettings<ReviewRequest>(reviewSettingKey(response.id), NO_REVIEW);
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<ReviewField>("mention");
  const [reason, setReason] = useState("");

  if (value.requested) {
    const label = REVIEW_FIELDS.find((f) => f.value === value.field)?.label ?? value.field;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line bg-surface-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-body-sm font-medium text-fg">Review requested <SimulatedBadge /></p>
          <p className="truncate text-helper text-fg-muted">{label}{value.reason ? ` · ${value.reason}` : ""} · machine result unchanged</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { clear(); toast.push({ title: "Review request withdrawn", tone: "info" }); }}>Withdraw</Button>
      </div>
    );
  }
  if (!open) {
    return (
      <div>
        <Button icon="flag" onClick={() => setOpen(true)}>Request review</Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-control border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        save({ requested: true, field, reason: reason.trim(), at: demoNow() }, { kind: "settings.saved", label: "Response review requested", refs: { websiteId: response.storeId } });
        toast.push(simulatedToast("Review requested"));
        setOpen(false);
      }}
    >
      <Field label="What looks wrong?">{(p) => <Select id={p.id} aria-describedby={p.describedBy} value={field} onChange={(e) => setField(e.target.value as ReviewField)}>{REVIEW_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</Select>}</Field>
      <Field label="Reason (optional)">{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant="primary" type="submit">Request review</Button>
      </div>
    </form>
  );
}

function TraceTab({ response, evidence, onOpenSibling }: { response: ResponseSample; evidence: EvidenceIds; onOpenSibling?: (responseId: string) => void }) {
  const latency = latencySeconds(response);
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Evidence trace">
        <SectionTitle>Evidence trace</SectionTitle>
        <EvidenceTrace ids={evidence} onOpenResponse={onOpenSibling} />
      </section>
      <section aria-label="Metadata">
        <SectionTitle>Metadata</SectionTitle>
        <KeyValue
          columns={2}
          items={[
            { label: "Run", value: <Mono>{response.runId}</Mono> },
            { label: "Provider request", value: <Mono>{response.providerRequestId}</Mono> },
            { label: "Tokens (in / out)", value: <span className="tnum">{response.usage.inputTokens} / {response.usage.outputTokens}</span> },
            { label: "Search calls", value: <span className="tnum">{response.usage.searchCalls}</span> },
            { label: "Requested (UTC)", value: <span className="tnum">{formatDateTime(response.requestedAt)}</span> },
            { label: "Completed (UTC)", value: <span className="tnum">{response.completedAt ? formatDateTime(response.completedAt) : "Not completed"}</span> },
            { label: "Latency", value: <span className="tnum">{latency === null ? "N/A" : `${latency} s`}</span> },
            { label: "Raw payload", value: <Mono>{response.rawPayloadRef}</Mono> },
          ]}
        />
      </section>
      {response.status === "succeeded" ? <ReviewControl response={response} /> : null}
    </div>
  );
}

/**
 * The response detail content (no drawer chrome): provider, model, settings, market and language, sample and
 * confidence on top; tabs Answer, Analysis, Trace below. Read-only: raw responses are immutable.
 */
export function ResponseInspector({ response, samples, evidence }: { response: ResponseSample; samples?: ResponseSample[]; evidence?: Partial<EvidenceIds> }) {
  const [activeId, setActiveId] = useState(response.id);
  const siblings = samples && samples.length > 1 ? samples : undefined;
  const active = siblings?.find((s) => s.id === activeId) ?? response;
  const ids = responseEvidenceIds(active, evidence);
  const failed = active.status === "failed";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral" icon="plug">{active.providerLabel} API</Badge>
        <Badge tone="neutral">{active.model}</Badge>
        <Badge tone="neutral" icon="globe">{SEARCH_MODE_LABEL[active.searchMode]}{active.searchMode !== "model_only" ? (active.searchExecuted ? " · search ran" : " · search not used") : ""}</Badge>
        <Badge tone="neutral">{active.market} · {active.language.toUpperCase()}</Badge>
        <Badge tone="neutral">{sampleLabel(active, samples)}</Badge>
        {failed ? <Badge tone="danger" icon="x-circle">Failed</Badge> : <Badge tone={levelTone[confidenceLevel(active.confidence)]}>Confidence {confidencePercent(active.confidence)}%</Badge>}
      </div>
      <p className="-mt-1 flex items-center gap-1.5 text-helper text-fg-muted">
        <Icon name="info" size={12} className="shrink-0" />
        {API_SAMPLE_LABEL}.
      </p>
      {siblings ? (
        <div role="group" aria-label="Samples of this prompt" className="flex flex-wrap items-center gap-1.5">
          {siblings.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === active.id}
              onClick={() => setActiveId(s.id)}
              className={`tnum h-7 cursor-pointer rounded-full border px-2.5 text-label transition-colors duration-[var(--dur-fast)] pointer-coarse:h-9 ${s.id === active.id ? "border-accent bg-accent-soft text-accent-text" : "border-line bg-surface text-fg-muted hover:bg-surface-2"}`}
            >
              Sample {s.sample}{s.status === "failed" ? " (failed)" : ""}
            </button>
          ))}
        </div>
      ) : null}
      <Tabs
        key={active.id}
        label="Response details"
        tabs={[
          { id: "answer", label: "Answer", content: <div className="pt-4"><AnswerTab response={active} /></div> },
          { id: "analysis", label: "Analysis", content: <div className="pt-4"><AnalysisTab response={active} /></div> },
          { id: "trace", label: "Trace", content: <div className="pt-4"><TraceTab response={active} evidence={ids} onOpenSibling={siblings ? (id) => siblings.some((s) => s.id === id) && setActiveId(id) : undefined} /></div> },
        ]}
      />
    </div>
  );
}

export type ResponseDrawerProps = {
  /** The response to show. */
  response: ResponseSample;
  open: boolean;
  onClose: () => void;
  /** Samples of the same prompt, provider and run. Adds a "Sample 2 of 3" switcher and the sample count. */
  samples?: ResponseSample[];
  /** Extra evidence ids (findingId, taskId, comparisonId, ...) merged into the Trace tab's EvidenceTrace. */
  evidence?: Partial<EvidenceIds>;
};

/**
 * Shared detail drawer for one AI response. Use it from Audit, Monitoring, Prompts, Fixes and Comparison:
 * `<ResponseDrawer response={r} open={open} onClose={() => setOpen(false)} />`.
 */
export function ResponseDrawer({ response, open, onClose, samples, evidence }: ResponseDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} title="AI response" description={`${response.providerLabel} · ${response.market} · ${response.language.toUpperCase()}`} size="lg">
      <ResponseInspector response={response} samples={samples} evidence={evidence} />
    </Drawer>
  );
}

/** Text button that opens a ResponseDrawer. Use in tables and lists. */
export function ResponseButton({ response, samples, evidence, children }: { response: ResponseSample; samples?: ResponseSample[]; evidence?: Partial<EvidenceIds>; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rv-target cursor-pointer rounded text-left text-body-sm font-medium text-accent-text hover:underline pointer-coarse:min-h-11">
        {children ?? "View response"}
      </button>
      <ResponseDrawer response={response} open={open} onClose={() => setOpen(false)} samples={samples} evidence={evidence} />
    </>
  );
}
