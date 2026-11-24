"use client";

import Link from "next/link";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { Confidence } from "@/types/shared-records";
import type { CauseClassification, Effort, Recommendation, RecommendationStatus, TaskStatus } from "@/types/fixes";

import { MODE_LABEL } from "./fixes-shared";

export type RecLocal = {
  status: RecommendationStatus;
  action: string;
  decisionNote?: string;
  decidedBy?: string;
  edited: boolean;
  /** Task created from this recommendation (seeded or local). An open task is preferred over a finished one. */
  taskId: string | null;
  /** Status of that task. */
  taskStatus: TaskStatus | null;
  /** The linked task is finished but the finding is open again, so a new task is the way to fix it. */
  canRetask: boolean;
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
      <h4 className="text-helper font-medium text-fg-subtle">{label}</h4>
      <div className="mt-0.5 text-body-sm text-fg">{children}</div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="min-w-0">
      <h4 className="text-helper font-medium text-fg-subtle">
        {title} <span className="tnum">{items.length}</span>
      </h4>
      {items.length === 0 ? (
        <p className="mt-0.5 text-body-sm text-fg-subtle">None.</p>
      ) : (
        <ul className="mt-0.5 flex list-disc flex-col gap-1 pl-4 text-body-sm text-fg-muted">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  storeId: string;
  rec: Recommendation;
  local: RecLocal;
  confidence: Confidence;
  evidenceLabels: Record<string, string>;
  canApprove: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  onReopen: () => void;
  onCreateTask: () => void;
  /** Opens the Evidence tab at this item. Without it the chip is a plain in-page link. */
  onOpenEvidence?: (evidenceId: string) => void;
};

/**
 * One recommendation. Default view: title, proposed action, why, expected result.
 * Cause, confidence, evidence, dependencies, limitations and the verification plan sit under "Details".
 */
export function RecommendationCard({ storeId, rec, local, confidence, evidenceLabels, canApprove, onApprove, onEdit, onReject, onReopen, onCreateTask, onOpenEvidence }: Props) {
  const statusBadge =
    local.status === "approved" ? (
      <Badge tone="success" icon="check-circle">Approved</Badge>
    ) : local.status === "rejected" ? (
      <Badge tone="neutral" icon="x-circle">Rejected</Badge>
    ) : (
      <Badge tone="info" icon="sparkles">Proposed</Badge>
    );

  return (
    <Card as="article" className="flex flex-col gap-3 p-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 text-body font-semibold text-fg">{rec.title}</h3>
          {statusBadge}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Status kind="risk" value={rec.risk} />
          <Badge tone="neutral" icon="clock">{EFFORT_LABEL[rec.effort]}</Badge>
          <Badge tone="neutral" icon="layers">{MODE_LABEL[rec.suggestedMode]}</Badge>
        </div>
      </header>

      <div className="rounded-control border border-accent/25 bg-accent-soft/50 px-3 py-2.5">
        <h4 className="text-helper font-medium text-accent-text">Proposed action</h4>
        <p className="mt-0.5 text-body-sm font-medium text-fg">{local.action}</p>
        {local.edited ? <p className="mt-1 text-helper text-fg-muted">Edited by you.</p> : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <Block label="Why it matters">{rec.why}</Block>
        <Block label="Expected result">{rec.expectedOutcome}</Block>
      </div>

      <details className="group rounded-control border border-line bg-surface-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-label font-medium text-fg-muted hover:text-fg">
          Details
          <Icon name="chevron-down" size={14} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-3 pb-3 sm:grid-cols-2">
          <Block label="Root cause">
            <span className="flex flex-wrap items-center gap-1.5" title={CAUSE_HINT[rec.cause.classification]}>
              <Status kind="cause" value={rec.cause.classification} />
              <Status kind="confidence" value={confidence} />
            </span>
            <span className="mt-1 block text-fg-muted">{rec.cause.basis}</span>
          </Block>
          <Block label="Evidence">
            <ul className="flex flex-wrap gap-1.5">
              {rec.evidenceIds.map((id) => (
                <li key={id}>
                  <a href={`#ev-${id}`} onClick={onOpenEvidence ? (event) => { event.preventDefault(); onOpenEvidence(id); } : undefined} className="inline-flex max-w-full items-center gap-1 rounded-full border border-line-strong bg-surface px-2 py-0.5 text-helper text-accent-text hover:bg-surface-2">
                    <Icon name="link" size={12} className="shrink-0" />
                    <span className="truncate">{evidenceLabels[id] ?? id}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Block>
          <List title="Dependencies" items={rec.dependencies} />
          <List title="Limitations" items={rec.limitations} />
          <div className="sm:col-span-2">
            <List title="Verification plan" items={rec.verificationPlan} />
          </div>
        </div>
      </details>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {local.status === "proposed" ? (
          <>
            <Button size="sm" icon="check" onClick={onApprove} disabled={!canApprove} title={canApprove ? undefined : "Only an owner or admin can approve."}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" icon="pencil" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="danger-ghost" icon="x" onClick={onReject}>
              Reject
            </Button>
          </>
        ) : null}

        {local.status === "approved" ? (
          <>
            {local.taskId ? (
              <>
                <Link href={`/stores/${storeId}/fixes/tasks/${local.taskId}`} className="inline-flex items-center gap-1.5 text-label font-medium text-accent-text hover:underline">
                  <Icon name="fixes" size={14} />
                  Open {local.taskId}
                </Link>
                {local.taskStatus ? <Status kind="task" value={local.taskStatus} compact /> : null}
                {local.canRetask ? (
                  <Button size="sm" icon="plus" onClick={onCreateTask} title="The last task is finished, but the finding is open again. Create a new task to fix it.">
                    Create new task
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <Button size="sm" icon="plus" onClick={onCreateTask}>
                  Create task
                </Button>
                <Button size="sm" variant="ghost" icon="pencil" onClick={onEdit}>
                  Edit
                </Button>
              </>
            )}
            {local.decidedBy || local.decisionNote ? (
              <span className="text-helper text-fg-subtle">{[local.decidedBy ? `by ${local.decidedBy}` : null, local.decisionNote].filter(Boolean).join(" · ")}</span>
            ) : null}
          </>
        ) : null}

        {local.status === "rejected" ? (
          <>
            <Button size="sm" icon="refresh" onClick={onReopen}>
              Reopen
            </Button>
            {local.decisionNote ? <span className="text-helper text-fg-subtle">{local.decisionNote}</span> : null}
          </>
        ) : null}
      </footer>
    </Card>
  );
}
