"use client";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { CauseClassification, Effort, Recommendation, RecommendationStatus } from "@/types/fixes";

import { MODE_LABEL } from "./fixes-shared";

export type RecLocal = {
  status: RecommendationStatus;
  action: string;
  decisionNote?: string;
  decidedBy?: string;
  edited: boolean;
  taskCreated: boolean;
};

const EFFORT_LABEL: Record<Effort, string> = { small: "Small effort", medium: "Medium effort", large: "Large effort" };
const CAUSE_HINT: Record<CauseClassification, string> = {
  confirmed: "Directly observed and repeatable.",
  likely: "Supported by evidence, not proven.",
  hypothesis: "Untested idea. Treat as a hypothesis.",
};

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h4 className="text-xs font-medium text-fg-subtle">{label}</h4>
      <div className="mt-0.5 text-[13px] text-fg">{children}</div>
    </div>
  );
}

function Details({ title, items }: { title: string; items: string[] }) {
  return (
    <details className="group rounded-control border border-line bg-surface-2/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium text-fg-muted hover:text-fg">
        <span>
          {title} <span className="tnum text-fg-subtle">{items.length}</span>
        </span>
        <Icon name="chevron-down" size={14} className="transition-transform group-open:rotate-180" />
      </summary>
      {items.length === 0 ? (
        <p className="px-3 pb-2.5 text-[13px] text-fg-subtle">None.</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 px-3 pb-2.5 pl-7 text-[13px] text-fg-muted">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

type Props = {
  rec: Recommendation;
  local: RecLocal;
  evidenceLabels: Record<string, string>;
  canApprove: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  onReopen: () => void;
  onCreateTask: () => void;
};

/** One recommendation: problem, evidence, cause, action, and the approve / edit / reject controls. */
export function RecommendationCard({ rec, local, evidenceLabels, canApprove, onApprove, onEdit, onReject, onReopen, onCreateTask }: Props) {
  const linkedTask = rec.taskId;
  const statusBadge =
    local.status === "approved" ? (
      <Badge tone="success" icon="check-circle">Approved</Badge>
    ) : local.status === "rejected" ? (
      <Badge tone="neutral" icon="x-circle">Rejected</Badge>
    ) : (
      <Badge tone="info" icon="sparkles">Proposed</Badge>
    );

  return (
    <Card as="article" className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 text-sm font-semibold text-fg">{rec.title}</h3>
          {statusBadge}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span title={CAUSE_HINT[rec.cause.classification]}>
            <Status kind="cause" value={rec.cause.classification} />
          </span>
          <Status kind="risk" value={rec.risk} />
          <Badge tone="neutral" icon="clock">{EFFORT_LABEL[rec.effort]}</Badge>
          <Badge tone="neutral" icon="layers">{MODE_LABEL[rec.suggestedMode]}</Badge>
        </div>
      </header>

      <div className="rounded-control border border-accent/25 bg-accent-soft/50 px-3 py-2.5">
        <h4 className="text-xs font-medium text-accent-text">Proposed action</h4>
        <p className="mt-0.5 text-[13px] font-medium text-fg">{local.action}</p>
        {local.edited ? <p className="mt-1 text-xs text-fg-muted">Edited by you.</p> : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <Block label="Why it matters">{rec.why}</Block>
        <Block label="Expected outcome">{rec.expectedOutcome}</Block>
      </div>

      <Block label="Cause">
        <span className="text-fg-muted">{rec.cause.basis}</span>
      </Block>

      <Block label="Evidence">
        <ul className="flex flex-wrap gap-1.5">
          {rec.evidenceIds.map((id) => (
            <li key={id}>
              <a href={`#ev-${id}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-line-strong bg-surface px-2 py-0.5 text-xs text-accent-text hover:bg-surface-2">
                <Icon name="link" size={12} className="shrink-0" />
                <span className="truncate">{evidenceLabels[id] ?? id}</span>
              </a>
            </li>
          ))}
        </ul>
      </Block>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-3">
        <Details title="Dependencies" items={rec.dependencies} />
        <Details title="Limitations" items={rec.limitations} />
        <Details title="Verification plan" items={rec.verificationPlan} />
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {local.status === "proposed" ? (
          <>
            <Button variant="primary" size="sm" icon="check" onClick={onApprove} disabled={!canApprove} title={canApprove ? undefined : "Only an owner or admin can approve."}>
              Approve
            </Button>
            <Button size="sm" icon="pencil" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="danger-ghost" size="sm" icon="x" onClick={onReject}>
              Reject
            </Button>
          </>
        ) : null}

        {local.status === "approved" ? (
          <>
            {linkedTask ? null : local.taskCreated ? (
              <Badge tone="accent" icon="sparkles">Task suggested (demo)</Badge>
            ) : (
              <>
                <Button variant="primary" size="sm" icon="plus" onClick={onCreateTask}>
                  Create task
                </Button>
                <Button size="sm" icon="pencil" onClick={onEdit}>
                  Edit
                </Button>
              </>
            )}
            {local.decidedBy || local.decisionNote ? (
              <span className="text-xs text-fg-subtle">{[local.decidedBy ? `by ${local.decidedBy}` : null, local.decisionNote].filter(Boolean).join(" · ")}</span>
            ) : null}
          </>
        ) : null}

        {local.status === "rejected" ? (
          <>
            <Button size="sm" icon="refresh" onClick={onReopen}>
              Reopen
            </Button>
            {local.decisionNote ? <span className="text-xs text-fg-subtle">{local.decisionNote}</span> : null}
          </>
        ) : null}
      </footer>
    </Card>
  );
}
