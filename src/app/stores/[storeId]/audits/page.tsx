import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Mono } from "@/components/ui/misc";
import { AuditHistoryTable } from "@/features/audit/audit-history-table";
import { LaneCards } from "@/features/audit/lane-cards";
import { formatMinutes } from "@/features/audit/labels";
import { SummarySwitch } from "@/features/audit/summary-switch";
import { formatDateTime } from "@/lib/format";
import { getStore, storeIds } from "@/services/core";
import { getAudit, getLaneSummary, getWizardData, listAudits } from "@/services/audit";
import type { AuditSummary } from "@/types/audit";

export const metadata: Metadata = { title: "Audits" };

export async function generateStaticParams() {
  return storeIds();
}

async function SummaryBlock({ audit, storeId }: { audit: AuditSummary; storeId: string }) {
  const summary = await getLaneSummary(storeId, audit.id);
  const base = `/stores/${storeId}/audits/${audit.id}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link href={base} className="text-sm font-semibold text-fg hover:underline">{audit.title}</Link>
        <Status kind="audit" value={audit.status} />
        <span className="tnum text-xs text-fg-subtle">{formatDateTime(audit.completedAt ?? audit.startedAt)} · {formatMinutes(audit.durationSeconds)}</span>
        {audit.snapshotId ? <Mono>{audit.snapshotId}</Mono> : null}
      </div>
      {summary ? <LaneCards summary={summary} base={base} basis={audit.type === "verification" ? "verification scope" : undefined} /> : null}
    </div>
  );
}

export default async function AuditsPage(props: PageProps<"/stores/[storeId]/audits">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [audits, wizard] = await Promise.all([listAudits(storeId), getWizardData(storeId)]);
  const startAction = (
    <ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>
  );

  if (audits.length === 0) {
    const hasPrompts = (wizard?.prompts.filter((p) => p.status === "active").length ?? 0) > 0;
    return (
      <>
        <PageHeader title="Audits" subtitle={store.name} actions={startAction} />
        <EmptyState
          icon="audit"
          title="No audits yet"
          description={hasPrompts ? "Run an audit to measure AI visibility and website readiness." : "Add at least one active prompt, then run the first audit."}
          action={
            hasPrompts ? (
              <ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>
            ) : (
              <ButtonLink href={`/stores/${storeId}/prompts/new`} variant="primary" icon="plus">Create a prompt</ButtonLink>
            )
          }
        />
      </>
    );
  }

  const running = audits.find((a) => a.provisional);
  const runningDetail = running ? await getAudit(storeId, running.id) : null;
  const completed = audits.filter((a) => !a.provisional);
  const latest = completed[0];
  const latestFull = completed.find((a) => a.type === "initial" || a.type === "full");

  const options = [
    ...(latest ? [{ value: latest.id, label: "Latest completed", content: <SummaryBlock audit={latest} storeId={storeId} /> }] : []),
    ...(latestFull && latestFull.id !== latest?.id ? [{ value: latestFull.id, label: "Latest full audit", content: <SummaryBlock audit={latestFull} storeId={storeId} /> }] : []),
  ];

  return (
    <>
      <PageHeader title="Audits" subtitle={`${store.name} · ${audits.length} audits`} actions={startAction} />

      {running && runningDetail?.progress ? (
        <Card className="mb-6 border-accent/40">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text"><Icon name="loader" size={18} className="animate-spin" /></span>
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/stores/${storeId}/audits/${running.id}`} className="text-sm font-semibold text-fg hover:underline">{running.title}</Link>
                <Status kind="audit" value="in_progress" />
              </div>
              <Progress className="mt-2" value={runningDetail.progress.overall.n} max={runningDetail.progress.overall.d} label={`${running.title} progress`} />
              <p className="tnum mt-1.5 text-xs text-fg-muted">
                {running.succeededJobs + running.failedJobs} / {running.plannedJobs} requests · {running.pages?.n} / {running.pages?.d} pages · {running.failedJobs} failed
              </p>
            </div>
            <ButtonLink href={`/stores/${storeId}/audits/${running.id}`} trailingIcon="arrow-right">View progress</ButtonLink>
          </div>
        </Card>
      ) : null}

      {options.length > 0 ? (
        <Section title="Latest results" className="mb-6">
          <SummarySwitch label="Summary" options={options} />
        </Section>
      ) : null}

      <Section title="History">
        <AuditHistoryTable audits={audits} storeId={storeId} />
      </Section>
    </>
  );
}
