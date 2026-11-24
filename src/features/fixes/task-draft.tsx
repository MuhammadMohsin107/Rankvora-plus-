"use client";

import { Badge } from "@/components/ui/badge";
import { SimulatedBadge } from "@/components/ui/demo";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Menu } from "@/components/ui/menu";
import { DiffView, Mono } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import type { BatchItem, DraftFact, TaskDraft, TaskStatus, UnsupportedClaim } from "@/types/fixes";

import { CodeDiff } from "./code-diff";

export const LOCKED_STATUSES: ReadonlySet<TaskStatus> = new Set(["applied", "published", "verification_pending", "verified_success", "partially_verified", "failed", "rolled_back", "rejected", "cancelled", "superseded"]);

export const BATCH_BADGE: Record<BatchItem["result"], { label: string; tone: "info" | "warning" | "neutral" | "success" | "danger"; icon: Parameters<typeof Badge>[0]["icon"] }> = {
  ready: { label: "Ready", tone: "info", icon: "check-circle" },
  conflict: { label: "Changed since draft", tone: "warning", icon: "alert-triangle" },
  excluded: { label: "Excluded", tone: "neutral", icon: "minus-circle" },
  applied: { label: "Applied", tone: "success", icon: "check" },
  failed: { label: "Failed", tone: "danger", icon: "x-circle" },
};

/** Preview text with unsupported claims marked (underline + warning fill, not colour alone). */
function ClaimText({ text, claims }: { text: string; claims: UnsupportedClaim[] }) {
  const spans = claims
    .map((claim) => ({ start: text.indexOf(claim.text), len: claim.text.length }))
    .filter((span) => span.start >= 0)
    .sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, index) => {
    if (span.start < cursor) return;
    if (span.start > cursor) out.push(<span key={`t${index}`}>{text.slice(cursor, span.start)}</span>);
    out.push(
      <mark key={`m${index}`} title="Unsupported claim" className="rounded-sm bg-warning-soft px-0.5 font-medium text-warning-text underline decoration-wavy decoration-1 underline-offset-2">
        {text.slice(span.start, span.start + span.len)}
      </mark>,
    );
    cursor = span.start + span.len;
  });
  if (cursor < text.length) out.push(<span key="tail">{text.slice(cursor)}</span>);
  return <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg">{out.length ? out : " "}</p>;
}

function SourceFacts({ facts }: { facts: DraftFact[] }) {
  return (
    <Card>
      <CardHeader title="Source facts used" info="The draft may only state facts listed here. Anything else is flagged as unsupported." />
      <CardBody className="pt-2">
        <ul className="divide-y divide-line">
          {facts.map((fact) => (
            <li key={fact.label} className="grid grid-cols-[minmax(0,1fr)] gap-0.5 py-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
              <span className="text-xs font-medium text-fg-subtle">{fact.label}</span>
              <span className="text-[13px] text-fg">{fact.value}</span>
              <span className="text-xs text-fg-muted">{fact.source}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

type Props = {
  draft: TaskDraft;
  status: TaskStatus;
  text: string;
  onText: (value: string) => void;
  claims: UnsupportedClaim[];
  generating: boolean;
  version: number;
  onGenerate: () => void;
  onReset: () => void;
  onSave: () => void;
  dirty: boolean;
  needsReapproval: boolean;
  batch: Record<string, BatchItem["result"]>;
  onBatch: (id: string, result: BatchItem["result"], message: string) => void;
};

/** AI-assisted drafting: generate / regenerate (simulated), source facts, unsupported claims, editor, preview and diff. */
export function TaskDraftTab({ draft, status, text, onText, claims, generating, version, onGenerate, onReset, onSave, dirty, needsReapproval, batch, onBatch }: Props) {
  const toast = useToast();
  const locked = LOCKED_STATUSES.has(status);

  if (draft.kind === "guidance") {
    return (
      <div className="flex flex-col gap-3">
        <Card>
          <CardHeader
            title="Steps"
            subtitle={`Owner: ${draft.owner}`}
            info="Guidance only. Rankvora AI makes no change to the site."
            actions={
              <Button
                size="sm"
                icon="copy"
                onClick={() => {
                  void navigator.clipboard?.writeText(draft.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.detail}`).join("\n"));
                  toast.push({ title: "Steps copied", tone: "info" });
                }}
              >
                Copy steps
              </Button>
            }
          />
          <CardBody>
            <ol className="flex flex-col gap-3">
              {draft.steps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-fg">{step.title}</p>
                    <p className="text-[13px] text-fg-muted">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        <SourceFacts facts={draft.sourceFacts} />
      </div>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <SimulatedBadge />
        <Badge tone="neutral">Draft v{version}</Badge>
        <Badge tone="neutral" icon="clock">{formatDateTime(draft.generatedAt)} UTC</Badge>
        {dirty ? <Badge tone="warning" icon="pencil">Edited, unsaved</Badge> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" icon="sparkles" loading={generating} disabled={locked} onClick={onGenerate}>
          {version > 1 || dirty ? "Regenerate" : "Generate"}
        </Button>
        <Button size="sm" icon="undo" disabled={locked || !dirty} onClick={onReset}>
          Reset
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon="check"
          disabled={locked || !dirty}
          onClick={onSave}
        >
          Save draft
        </Button>
      </div>
    </div>
  );

  if (draft.kind === "batch") {
    return (
      <div className="flex flex-col gap-3">
        <Card>
          <CardHeader title="Batch" subtitle={draft.resource} info="Each resource gets its own result. Excluded rows are never written." />
          <CardBody className="flex flex-col gap-3 pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <SimulatedBadge />
              <Badge tone="neutral" icon="clock">{formatDateTime(draft.generatedAt)} UTC</Badge>
            </div>
            <ul className="divide-y divide-line rounded-control border border-line">
              {draft.items.map((item) => {
                const result = batch[item.id] ?? item.result;
                const view = BATCH_BADGE[result];
                return (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <a href={item.pageUrl} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-target max-w-full items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
                        <span className="truncate">{item.pageUrl.replace("https://", "")}</span>
                        <Icon name="external" size={12} className="shrink-0" />
                      </a>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        Link “{item.linkText}”: <Mono>{item.from}</Mono> <Icon name="arrow-right" size={12} className="inline" /> <Mono>{item.to}</Mono>
                      </p>
                      {(result === "conflict" || result === "excluded") && item.reason && !batch[item.id] ? <p className="mt-1 text-xs text-fg-subtle">{item.reason}</p> : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={view.tone} icon={view.icon}>{view.label}</Badge>
                      <Menu
                        trigger={<IconButton icon="more" label={`Actions for ${item.pageUrl.replace("https://", "")}`} size="sm" />}
                        items={[
                          {
                            label: "Re-fetch and redraft",
                            icon: "refresh",
                            disabled: locked || result !== "conflict",
                            disabledReason: "Only changed resources need a redraft.",
                            onSelect: () => onBatch(item.id, "ready", "Redrafted from the current remote copy"),
                          },
                          {
                            label: "Exclude from batch",
                            icon: "minus-circle",
                            disabled: locked || result === "excluded",
                            disabledReason: "Already excluded or locked.",
                            onSelect: () => onBatch(item.id, "excluded", "Excluded from the batch"),
                          },
                          {
                            label: "Include in batch",
                            icon: "plus",
                            disabled: locked || result !== "excluded",
                            disabledReason: "Only excluded rows can be included.",
                            onSelect: () => onBatch(item.id, "ready", "Included in the batch"),
                          },
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
        <SourceFacts facts={draft.sourceFacts} />
      </div>
    );
  }

  const isPatch = draft.kind === "patch";
  const mono = isPatch ? "font-mono text-xs" : "";

  const live = claims.filter((claim) => text.includes(claim.text));

  return (
    <div className="flex flex-col gap-3">
      {header}

      {needsReapproval ? (
        <Callout tone="warning" title="This edit changes the approved diff">
          The approved hash no longer matches. Request approval again before anything is written.
        </Callout>
      ) : null}
      {locked ? <Callout tone="neutral" title="Draft locked">This task is past drafting. Applied content is not edited here.</Callout> : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={isPatch ? "Patch" : "Draft text"} subtitle={draft.resource} />
          <CardBody>
            <Field label={isPatch ? "Proposed value" : draft.kind === "text" ? draft.field : "Draft"}>
              {({ id, describedBy }) => (
                <Textarea id={id} aria-describedby={describedBy} rows={isPatch ? 14 : 9} readOnly={locked} value={text} onChange={(event) => onText(event.target.value)} className={mono} spellCheck={!isPatch} />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={isPatch ? "Unsupported claims" : "Live preview"} info="Edit or remove an unsupported claim before approval." />
          <CardBody className="flex flex-col gap-3">
            {isPatch ? null : (
              <div className="rounded-control border border-line bg-surface-2/40 p-3">
                <ClaimText text={text} claims={live} />
              </div>
            )}
            {live.length === 0 ? (
              <p className="flex items-center gap-1.5 text-[13px] text-fg-muted">
                <Icon name="check-circle" size={15} className="text-success-icon" />
                No unsupported claims flagged.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {live.map((claim) => (
                  <li key={claim.text}>
                    <Callout tone="warning" title={`“${claim.text}”`}>
                      {claim.reason}
                    </Callout>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Before and after" info="Exact change, compared with the current remote copy." />
        <CardBody>
          {isPatch ? (
            <CodeDiff before={draft.before} after={text} label={draft.language} />
          ) : (
            <DiffView before={draft.before} after={text} beforeLabel="Current" afterLabel="Proposed" />
          )}
        </CardBody>
      </Card>

      <SourceFacts facts={draft.sourceFacts} />
    </div>
  );
}
