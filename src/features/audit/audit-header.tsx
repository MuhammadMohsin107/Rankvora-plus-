"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { SimulatedBadge } from "@/components/ui/demo";
import { Mono } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/overlay";
import { LinkTabs } from "@/components/ui/tabs";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { AuditConfig, AuditRow } from "@/types/audit";

import { ConfigDrawerButton } from "./audit-actions";
import { AUDIT_TYPE_LABEL, TRIGGER_LABEL } from "./labels";
import { canPause } from "./rows";
import { isTerminal } from "./simulation";
import { useAudits } from "./use-audits";

type Props = {
  storeId: string;
  /** Seeded row (server data). Omitted for audits created in this browser. */
  seed?: AuditRow | null;
  auditId: string;
  config?: AuditConfig;
  channels: { id: string; label: string }[];
  findingsCount?: number | null;
};

/**
 * Title, live status, controls and tabs of one audit. Works for seeded audits and for audits created here:
 * status and controls come from the audits collection, so Pause, Resume and Cancel really change state.
 */
export function AuditHeader({ storeId, seed, auditId, config, channels, findingsCount }: Props) {
  const seeds = useMemo(() => (seed ? [seed] : []), [seed]);
  const { live, now, pause, resume, cancel, start, discard } = useAudits(storeId, seeds);
  const row = live.find((r) => r.id === auditId) ?? seed ?? null;
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  if (!row) return <PageHeader title="Audit" />;

  const base = `/stores/${storeId}/audits/${auditId}`;
  const status = row.status;
  const done = isTerminal(status);
  const draft = status === "draft";
  const running = !done && !draft;
  const paused = Boolean(row.paused);
  const typeLabel = AUDIT_TYPE_LABEL[row.type];
  const titleNamesType = row.title.toLowerCase().includes(typeLabel.toLowerCase());
  const kept = row.succeededJobs + row.failedJobs;
  const crawled = row.pages?.n ?? 0;
  const trigger = (config ?? row.config)?.trigger;
  const pausable = row.plan ? canPause(row, now || Date.parse(row.startedAt)) : status === "in_progress" && !paused;

  const subtitle = [
    `Started ${formatDateTime(row.startedAt)} UTC`,
    done && row.endedAt && status !== "draft" ? `Ended ${formatDateTime(row.endedAt)}` : null,
    `${formatDuration(row.durationSeconds)}${running ? " so far" : ""}`,
    row.createdBy,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title={row.title}
        subtitle={draft ? "Draft. Not started yet." : subtitle}
        meta={
          <>
            <Status kind="audit" value={status} />
            {paused && running ? <Badge tone="warning" icon="pause">Paused</Badge> : null}
            {titleNamesType ? null : <Badge>{typeLabel}</Badge>}
            {trigger ? <Badge tone="neutral" icon="bolt" title={trigger.reason}>{trigger.source === "schedule" ? "Scheduled" : TRIGGER_LABEL[trigger.source]}</Badge> : null}
            {row.simulated ? <SimulatedBadge /> : null}
            {row.snapshotId ? (
              <Badge tone="neutral" icon="lock" title="Immutable snapshot: it cannot change after completion">
                <Mono>{row.snapshotId}</Mono>
              </Badge>
            ) : null}
          </>
        }
        actions={
          <>
            {config ? <ConfigDrawerButton config={config} lanes={row.lanes} channels={channels} /> : null}
            {running ? (
              <>
                {paused ? <Button icon="play" onClick={() => resume(auditId)}>Resume</Button> : <Button icon="pause" disabled={!pausable} onClick={() => pause(auditId)}>Pause</Button>}
                <Button variant="danger-ghost" icon="x-circle" onClick={() => setConfirm(true)}>Cancel audit</Button>
              </>
            ) : null}
            {draft ? <Button variant="ghost" icon="trash" onClick={() => setDiscarding(true)}>Discard draft</Button> : null}
          </>
        }
        tabs={
          <LinkTabs
            label="Audit sections"
            items={[
              { href: base, label: "Overview", exact: true },
              { href: `${base}/ai-visibility`, label: "AI visibility" },
              { href: `${base}/website`, label: "Website readiness" },
              { href: `${base}/findings`, label: "Findings", count: findingsCount ?? undefined },
              { href: `${base}/report`, label: "Report" },
            ]}
          />
        }
      />
      {draft ? (
        <HeaderAction>
          <Button variant="primary" icon="play" onClick={() => start(auditId)}>Start audit</Button>
        </HeaderAction>
      ) : done ? (
        <HeaderAction>
          <ButtonLink href={`/stores/${storeId}/audits/new?from=${auditId}`} variant="primary" icon="refresh">Run again</ButtonLink>
        </HeaderAction>
      ) : null}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Cancel this audit?"
        confirmLabel="Cancel audit"
        cancelLabel="Keep running"
        onConfirm={() => {
          setConfirm(false);
          cancel(auditId);
        }}
      >
        {kept > 0 || crawled > 0
          ? `No further requests are sent. The ${kept} completed ${kept === 1 ? "response" : "responses"} and ${crawled} crawled ${crawled === 1 ? "page are" : "pages are"} kept as a partial result. The status becomes Cancelled and no snapshot is created.`
          : "Nothing has been sent or crawled yet, so there is nothing to keep. The status becomes Cancelled and no snapshot is created."}
      </ConfirmDialog>
      <ConfirmDialog open={discarding} onClose={() => setDiscarding(false)} title="Discard this draft?" confirmLabel="Discard draft" onConfirm={() => { setDiscarding(false); discard(auditId); router.push(`/stores/${storeId}/audits`); }}>
        The saved setup is removed. You can start a new audit at any time.
      </ConfirmDialog>
    </>
  );
}
