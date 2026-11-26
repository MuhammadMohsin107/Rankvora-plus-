import { Suspense } from "react";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Section } from "@/components/ui/card";
import { AuditHistoryTable } from "@/features/audit/audit-history-table";
import { RunningAudits, StartAuditAction } from "@/features/audit/audit-home";
import { LaneCards } from "@/features/audit/lane-cards";
import { AuditSetupBlocked } from "@/features/audit/setup-blocked";
import { getStore, storeIds } from "@/services/core";
import { listFindings } from "@/services/records";
import { getLaneSummary, getWizardData, listAuditRows } from "@/services/audit";

export const metadata: Metadata = { title: "Audits" };

export async function generateStaticParams() {
  return storeIds();
}

const CLOSED = new Set(["verified_resolved", "false_positive", "accepted_risk"]);

async function AuditsPageContent(props: PageProps<"/stores/[storeId]/audits">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [audits, wizard] = await Promise.all([listAuditRows(storeId), getWizardData(storeId)]);
  if (audits.length === 0) {
    // No AI channel: nothing can run, so the one action is to connect a platform.
    if (!wizard || wizard.channels.length === 0) {
      return (
        <>
          <PageHeader title="Audits" />
          <AuditSetupBlocked storeId={store.id} storeName={store.name} />
        </>
      );
    }
    return (
      <>
        <PageHeader title="Audits" />
        <StartAuditAction storeId={storeId} />
        <EmptyState icon="audit" title="No audits yet" action={<ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>} />
      </>
    );
  }

  const latest = audits.find((a) => !a.provisional && a.snapshotId && (a.type === "full" || a.type === "initial")) ?? audits.find((a) => !a.provisional && a.snapshotId);
  const summary = latest ? await getLaneSummary(storeId, latest.id) : null;
  const open = (await listFindings(storeId)).filter((f) => !CLOSED.has(f.status)).length;

  return (
    <>
      <PageHeader title="Audits" />
      <StartAuditAction storeId={storeId} />
      <RunningAudits storeId={storeId} seeded={audits} />

      {latest && summary ? (
        <Section
          title="Latest results"
          className="mb-4"
          actions={
            <Link href={`/stores/${storeId}/fixes`} className="text-label font-medium text-accent-text hover:underline">
              {open} open {open === 1 ? "finding" : "findings"}
            </Link>
          }
        >
          <p className="text-body-sm text-fg-muted">
            <Link href={`/stores/${storeId}/audits/${latest.id}`} className="font-medium text-fg hover:underline">{latest.title}</Link>
          </p>
          <LaneCards summary={summary} base={`/stores/${storeId}/audits/${latest.id}`} />
        </Section>
      ) : null}

      <Section title="History">
        <AuditHistoryTable seeded={audits} storeId={storeId} />
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
