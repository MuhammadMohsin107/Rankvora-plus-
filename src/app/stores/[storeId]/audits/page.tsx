import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { AuditHistoryTable } from "@/features/audit/audit-history-table";
import { LaneCards } from "@/features/audit/lane-cards";
import { SummarySwitch } from "@/features/audit/summary-switch";
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
  // Status, dates and snapshot id live in the history table; only the audit's name is needed here.
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-fg">{audit.title}</p>
      {summary ? <LaneCards summary={summary} base={base} basis={audit.type === "verification" ? "Verification scope" : undefined} /> : null}
    </div>
  );
}

async function AuditsPageContent(props: PageProps<"/stores/[storeId]/audits">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [audits, wizard] = await Promise.all([listAudits(storeId), getWizardData(storeId)]);
  if (audits.length === 0) {
    const hasPrompts = (wizard?.prompts.filter((p) => p.status === "active").length ?? 0) > 0;
    return (
      <>
        <PageHeader title="Audits" />
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
      <PageHeader title="Audits" actions={<ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>} />

      {running && runningDetail?.progress ? (
        <Card className="mb-6 border-accent/40">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text"><Icon name="loader" size={18} className="animate-spin" /></span>
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-fg">{running.title}</span>
                <Status kind="audit" value="in_progress" />
              </div>
              {/* Requests and pages are in the history row; the banner shows overall progress and failures only. */}
              <Progress className="mt-2" value={runningDetail.progress.overall.n} max={runningDetail.progress.overall.d} label={`${running.title} progress`} />
              <p className="tnum mt-1.5 text-xs text-fg-muted">
                {runningDetail.progress.overall.n} / {runningDetail.progress.overall.d} work units{running.failedJobs > 0 ? ` · ${running.failedJobs} failed requests` : ""}
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

export default function AuditsPage(props: PageProps<"/stores/[storeId]/audits">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuditsPageContent {...props} />
    </Suspense>
  );
}
