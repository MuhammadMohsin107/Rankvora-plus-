"use client";

import { useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, KeyValue } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { HighlightedText, Mono } from "@/components/ui/misc";
import { Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { CITATION_SOURCE_LABEL, SEARCH_MODE_LABEL } from "@/lib/labels";
import type { ResponseSample } from "@/types/shared-records";

const sourceTone = { owned: "success", competitor: "warning", third_party: "neutral" } as const;

/** Original AI answer with full provenance. Read-only: raw responses are immutable. */
export function ResponseInspector({ response }: { response: ResponseSample }) {
  const toast = useToast();
  const failed = response.status === "failed";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral" icon="plug">{response.providerLabel} API</Badge>
        <Badge tone="neutral">{response.model}</Badge>
        <Badge tone="neutral" icon="globe">{SEARCH_MODE_LABEL[response.searchMode]}{response.searchMode !== "model_only" ? (response.searchExecuted ? " · search ran" : " · search not used") : ""}</Badge>
        <Badge tone="neutral">{response.market} · {response.language.toUpperCase()}</Badge>
        <Badge tone="neutral">Sample {response.sample}</Badge>
        <Badge tone="neutral">Prompt v{response.promptVersion}</Badge>
      </div>
      <p className="-mt-3 text-xs text-fg-subtle">API answer sample — may differ from what the consumer app shows.</p>

      <section aria-label="Prompt">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Exact prompt sent</h3>
        <p className="rounded-control border border-line bg-surface-2/60 px-3 py-2.5 text-[13px] text-fg">{response.promptText}</p>
      </section>

      {failed ? (
        <Callout tone="danger" title="Request failed">
          {response.failure?.message}. Attempts: {response.failure?.attempts}. This is a technical failure and is not counted as the brand being absent.
        </Callout>
      ) : (
        <section aria-label="Original answer">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Original answer</h3>
            <span className="flex items-center gap-3 text-xs text-fg-subtle">
              <span className="flex items-center gap-1"><span aria-hidden="true" className="size-2 rounded-sm bg-accent-soft ring-1 ring-accent/40" />Brand</span>
              <span className="flex items-center gap-1"><span aria-hidden="true" className="size-2 rounded-sm bg-warning-soft ring-1 ring-warning/40" />Competitor</span>
            </span>
          </div>
          <div className="rounded-control border border-line bg-surface p-3">
            <HighlightedText text={response.answerText} spans={response.brandSpans} />
          </div>
        </section>
      )}

      {!failed ? (
        <section aria-label="Analysis">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Analysis · version {response.analysisVersion}</h3>
          <KeyValue
            columns={2}
            items={[
              { label: "Brand mentioned", value: response.brandMentioned === "yes" ? <Badge tone="success" icon="check-circle">Yes</Badge> : response.brandMentioned === "no" ? <Badge tone="neutral" icon="minus-circle">No</Badge> : <Badge tone="warning" icon="help">Uncertain</Badge> },
              { label: "Recommendation", value: <Status kind="recommendation" value={response.recommendation} /> },
              { label: "Sentiment", value: <Status kind="sentiment" value={response.sentiment} /> },
              { label: "Position", value: response.position ? <span className="tnum">#{response.position} in an ordered list</span> : <span className="text-fg-muted">No ordered list</span> },
              { label: "Confidence", value: <span className="tnum">{Math.round(response.confidence * 100)}%</span> },
              { label: "Competitors named", value: response.competitors.filter((c) => c.mentioned).map((c) => c.name).join(", ") || "None" },
            ]}
          />
          {response.evidenceQuote ? (
            <blockquote className="mt-3 border-l-2 border-accent pl-3 text-[13px] italic text-fg-muted">“{response.evidenceQuote}”</blockquote>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Citations">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Citations returned</h3>
        {response.citationSupport === "not_supported" ? (
          <p className="text-[13px] text-fg-muted">Not supported by this provider (N/A).</p>
        ) : response.citations.length === 0 ? (
          <p className="text-[13px] text-fg-muted">No citation returned in this response.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {response.citations.map((c) => (
              <li key={c.url} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <a href={c.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
                    <span className="truncate">{c.title}</span>
                    <Icon name="external" size={12} className="shrink-0" />
                  </a>
                  <p className="truncate text-xs text-fg-subtle">{c.domain}</p>
                </div>
                <Badge tone={sourceTone[c.source]}>{CITATION_SOURCE_LABEL[c.source]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Trace">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Trace</h3>
        <KeyValue
          columns={2}
          items={[
            { label: "Run", value: <Mono>{response.runId}</Mono> },
            { label: "Provider request", value: <Mono>{response.providerRequestId}</Mono> },
            { label: "Tokens (in / out)", value: <span className="tnum">{response.usage.inputTokens} / {response.usage.outputTokens}</span> },
            { label: "Search calls", value: <span className="tnum">{response.usage.searchCalls}</span> },
            { label: "Requested (UTC)", value: <span className="tnum">{formatDateTime(response.requestedAt)}</span> },
            { label: "Completed (UTC)", value: <span className="tnum">{response.completedAt ? formatDateTime(response.completedAt) : "—"}</span> },
            { label: "Raw payload", value: <Mono>{response.rawPayloadRef}</Mono> },
          ]}
        />
      </section>

      {!failed ? (
        <div className="flex justify-end border-t border-line pt-3">
          <Button icon="flag" onClick={() => toast.push({ title: "Review requested", description: "Your correction will be stored next to the machine result.", tone: "info" })}>
            Request review
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Text button that opens the inspector in a drawer. Use in tables and lists. */
export function ResponseButton({ response, children }: { response: ResponseSample; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="cursor-pointer rounded text-left text-[13px] font-medium text-accent-text hover:underline">
        {children ?? "View response"}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="AI response" description={`${response.providerLabel} · sample ${response.sample}`} size="lg">
        <ResponseInspector response={response} />
      </Drawer>
    </>
  );
}
