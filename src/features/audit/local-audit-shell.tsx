"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import type { AuditBasis, AuditRow } from "@/types/audit";

import { AiVisibilityView } from "./ai-visibility-view";
import { AuditHeader } from "./audit-header";
import { deriveAudit } from "./derive";
import type { AuditReportData } from "./export";
import { FindingsView } from "./findings-view";
import { LANE_LABEL } from "./labels";
import { OverviewView } from "./overview-view";
import { ReportView } from "./report-view";
import { RunProgressView } from "./run-progress";
import { isTerminal } from "./simulation";
import { useAudits, useHydrated, useNow } from "./use-audits";
import { WebsiteView } from "./website-view";

type Props = {
  storeId: string;
  auditId: string;
  basis: AuditBasis | null;
  /** Extra demonstration audit known to the server (frozen run). Audits created in this browser are read from the demo state. */
  seed?: AuditRow | null;
  channels: { id: string; label: string }[];
  /** Latest completed audit with a website lane, for the "not part of this audit" state. */
  otherWithWebsite?: { id: string; title: string } | null;
};

function Missing({ storeId, text }: { storeId: string; text: string }) {
  return <EmptyState icon="audit" title="Audit not found" headingAs="h1" description={text} action={<ButtonLink href={`/stores/${storeId}/audits`} variant="primary">Back to audits</ButtonLink>} />;
}

/**
 * Client-rendered audit pages for audits that the server does not prerender: audits created in this browser and the
 * extra demonstration audits. Results come from the basis audit's data, limited to the audit's scope and progress.
 */
export function LocalAuditShell({ storeId, auditId, basis, seed, channels, otherWithWebsite }: Props) {
  const hydrated = useHydrated();
  const now = useNow();
  const pathname = usePathname();
  const seeds = useMemo(() => (seed ? [seed] : []), [seed]);
  const { rows } = useAudits(storeId, seeds);
  const row = rows.find((r) => r.id === auditId) ?? null;

  const derived = useMemo(() => (row && basis && now > 0 ? deriveAudit(basis, row, now) : null), [row, basis, now]);

  if (!hydrated || now === 0) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!row) return <Missing storeId={storeId} text="It may have been created in another browser, or the demo data was reset." />;
  if (!basis || !derived) return <Missing storeId={storeId} text="This website has no completed audit to build simulated results from." />;

  const segment = (pathname.split(`/audits/${auditId}`)[1] ?? "").replace(/^\//, "").split("/")[0];
  const { detail } = derived;
  const status = derived.row.status;
  const finished = isTerminal(status);
  const tasks = basis.tasks;
  const report: AuditReportData = {
    audit: detail,
    ai: derived.ai,
    web: derived.web,
    findings: derived.findings,
    tasks,
    websiteName: basis.domain,
    simulated: true,
    generatedAt: row.endedAt ?? new Date(now).toISOString(),
  };

  let content;
  if (segment === "ai-visibility") content = <AiVisibilityView audit={detail} lane={derived.ai} findings={derived.findings} />;
  else if (segment === "website") content = <WebsiteView audit={detail} lane={derived.web} storeId={storeId} otherWithWebsite={otherWithWebsite ? { ...detail, id: otherWithWebsite.id, title: otherWithWebsite.title } : null} />;
  else if (segment === "findings") content = <FindingsView audit={detail} findings={derived.findings} storeId={storeId} tasks={tasks} />;
  else if (segment === "report") content = <ReportView data={report} storeId={storeId} />;
  else if (status === "draft") {
    content = (
      <Card as="section">
        <CardHeader title="Saved setup" subtitle="Start it from the header when ready" />
        <CardBody>
          <KeyValue
            columns={2}
            items={[
              { label: "Lanes", value: row.lanes.map((l) => LANE_LABEL[l]).join(" + ") },
              { label: "Prompts", value: <span className="tnum">{row.config?.promptIds.length ?? 0}</span> },
              { label: "Providers", value: <span className="tnum">{row.config?.channelIds.length ?? 0}</span> },
              { label: "Planned", value: <span className="tnum">{row.plannedJobs} requests · about {row.pages?.d ?? 0} pages</span> },
            ]}
          />
        </CardBody>
      </Card>
    );
  } else if (!finished) content = <RunProgressView derived={derived} paused={Boolean(row.paused)} />;
  else content = <OverviewView audit={detail} summary={derived.summary} storeId={storeId} />;

  return (
    <>
      <AuditHeader storeId={storeId} auditId={auditId} seed={seed ?? null} config={detail.config} channels={channels} findingsCount={finished ? derived.findings.length : null} />
      {content}
    </>
  );
}
