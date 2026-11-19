import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SplitLayout } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue, Metric } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ReportActions } from "@/features/audit/report-actions";
import { STATUS } from "@/lib/status";
import { auditParams, getAiLane, getAudit, getAuditFindings, getWebsiteLane, listAuditTasks } from "@/services/audit";

export const metadata: Metadata = { title: "Audit report" };

export async function generateStaticParams() {
  return auditParams();
}

const SECTIONS = [
  { id: "summary", title: "Run summary" },
  { id: "coverage", title: "Coverage" },
  { id: "ai-visibility", title: "AI visibility" },
  { id: "evidence", title: "Evidence" },
  { id: "website", title: "Website readiness" },
  { id: "findings", title: "Findings register" },
  { id: "limitations", title: "Limitations" },
  { id: "baseline", title: "Baseline snapshot" },
  { id: "handoff", title: "Fix handoff" },
] as const;

function ReportSection({ index, id, title, subtitle, info, children, action }: { index: number; id: string; title: string; subtitle?: string; info?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card as="section">
      <div id={id} className="scroll-mt-28" />
      <CardHeader title={`${index}. ${title}`} subtitle={subtitle} info={info} actions={action} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

const limitationColor = { warning: "text-warning", info: "text-info", neutral: "text-fg-subtle" } as const;
const limitationIcon = { warning: "alert-triangle", info: "info", neutral: "minus-circle" } as const;

async function AuditReportPageContent(props: PageProps<"/stores/[storeId]/audits/[auditId]/report">) {
  const { storeId, auditId } = await props.params;
  const [audit, ai, web, findings, tasks] = await Promise.all([
    getAudit(storeId, auditId),
    getAiLane(storeId, auditId),
    getWebsiteLane(storeId, auditId),
    getAuditFindings(storeId, auditId),
    listAuditTasks(storeId, auditId),
  ]);
  if (!audit || !ai || !web) notFound();

  if (audit.provisional || !audit.snapshotId) {
    return (
      <div className="flex flex-col gap-5">
        <Callout tone="info" title="Report is generating">
          {audit.reportVersion ?? "Criteria 2.1"} · available with an immutable snapshot when the audit completes.
        </Callout>
        <Card as="section">
          <CardHeader title="Contents" />
          <CardBody className="pt-2">
            <ol className="divide-y divide-line">
              {SECTIONS.map((s, i) => (
                <li key={s.id} className="py-2.5 text-[13px] text-fg first:pt-1 last:pb-0">
                  <span className="tnum mr-2 text-fg-subtle">{i + 1}.</span>{s.title}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
    );
  }

  const snapshotId = audit.snapshotId;
  const { coverage, config } = audit;
  const scope = `${config.promptIds.length} prompts × ${config.channelIds.length} channels × ${config.samples} ${config.samples === 1 ? "sample" : "samples"}`;
  const severityCounts = (["critical", "high", "medium", "low", "informational"] as const)
    .map((s) => ({ s, n: findings.filter((f) => f.severity === s).length }))
    .filter((x) => x.n > 0);
  const withoutTask = findings.filter((f) => f.taskIds.length === 0).length;
  const citationsTotal = ai.citationsBySource.owned + ai.citationsBySource.competitor + ai.citationsBySource.third_party;

  return (
    <SplitLayout
      main={
        <>
          {/* Title, status, type, times, creator and snapshot id are in the page header. */}
          <ReportSection index={1} id="summary" title="Run summary">
            <KeyValue
              columns={2}
              items={[
                { label: "AI scope", value: <span className="tnum">{scope}</span> },
                { label: "Website scope", value: `${config.startPoints.join(", ")} · up to ${config.maxUrls} URLs` },
                { label: "Criteria · analysis", value: <span className="tnum">{config.criteriaVersion} · {config.analysisVersion}</span> },
              ]}
            />
          </ReportSection>

          <ReportSection index={2} id="coverage" title="Coverage">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-5 sm:grid-cols-3">
              <Metric label="Prompts" numerator={coverage.prompts.n} denominator={coverage.prompts.d} unit="prompts answered" />
              <Metric label="Providers" numerator={coverage.providers.n} denominator={coverage.providers.d} unit="channels" />
              <Metric label="Responses" numerator={coverage.responses.n} denominator={coverage.responses.d} unit="requests" basis={audit.failedJobs ? `${audit.failedJobs} failed` : undefined} />
              <Metric label="Pages" numerator={coverage.pages.n} denominator={coverage.pages.d} unit="in-scope" basis={`${coverage.pagesDetail.excluded} excluded · ${coverage.pagesDetail.blocked} blocked · ${coverage.pagesDetail.unvisited} unvisited`} />
              <Metric label="Checks" numerator={coverage.checks.n} denominator={coverage.checks.d} unit="applicable" />
            </div>
          </ReportSection>

          <ReportSection index={3} id="ai-visibility" title="AI visibility" subtitle="API answer samples · failed requests excluded from every rate">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-5 sm:grid-cols-3">
              <Metric label="Mention rate" numerator={ai.mention.n} denominator={ai.mention.d} />
              <Metric label="Recommendation rate" numerator={ai.recommendation.n} denominator={ai.recommendation.d} />
              <Metric label="Owned citation rate" numerator={ai.ownedCitation.n} denominator={ai.ownedCitation.d} unit="citation-capable responses" />
            </div>
          </ReportSection>

          <ReportSection index={4} id="evidence" title="Evidence" info="A raw payload is kept for every successful response. Response counts are in Coverage.">
            <KeyValue
              columns={3}
              items={[
                { label: "Citations returned", value: <span className="tnum">{citationsTotal}</span> },
                { label: "Pages with crawl facts", value: <span className="tnum">{web.pagesTotalDetail} of {web.coverage.pages.n}</span> },
                { label: "Checks with evidence", value: <span className="tnum">{web.checks.length}</span> },
                { label: "Prompt versions", value: <span className="tnum">{ai.prompts.map((p) => `${p.id} v${p.version}`).join(", ")}</span> },
              ]}
            />
          </ReportSection>

          <ReportSection index={5} id="website" title="Website readiness" info="Technical and content-quality rates are never combined, and never combined with AI visibility.">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-5 sm:grid-cols-3">
              <Metric label="Technical pass rate" numerator={web.technical.n} denominator={web.technical.d} unit="checks" />
              <Metric label="Content-quality pass rate" numerator={web.content.n} denominator={web.content.d} unit="checks" />
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="text-xs font-medium text-fg-muted">AI crawler access</p>
                <ul className="flex flex-col gap-1">
                  {web.crawlers.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="truncate text-fg">{c.name}</span>
                      {c.allowed ? <Badge tone="success" icon="check-circle">Allowed</Badge> : <Badge tone="danger" icon="lock">Disallowed</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ReportSection>

          <ReportSection index={6} id="findings" title="Findings register">
            {findings.length === 0 ? (
              <p className="text-[13px] text-fg-muted">No findings in this snapshot.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {severityCounts.map(({ s, n }) => (
                  <Badge key={s} tone={STATUS.severity[s].tone} icon={STATUS.severity[s].icon}>{STATUS.severity[s].label} · {n}</Badge>
                ))}
              </div>
            )}
          </ReportSection>

          <ReportSection index={7} id="limitations" title="Limitations">
            <ul className="divide-y divide-line">
              {/* "API answer samples" is already stated beside the AI visibility rates. */}
              {audit.limitations.filter((item) => item.id !== "api").map((item) => (
                <li key={item.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                  <Icon name={limitationIcon[item.tone]} size={15} className={`mt-0.5 shrink-0 ${limitationColor[item.tone]}`} />
                  <p className="text-[13px] text-fg">{item.text}</p>
                </li>
              ))}
            </ul>
          </ReportSection>

          <ReportSection index={8} id="baseline" title="Baseline snapshot" info="Snapshots are immutable: prompt versions and channels are fixed in them." action={<ButtonLink href={`/stores/${storeId}/comparisons/new`} variant="ghost" size="sm" trailingIcon="arrow-right">Compare</ButtonLink>}>
            <KeyValue
              columns={1}
              items={[
                { label: "Previous comparable audit", value: audit.baseline ? <Link href={`/stores/${storeId}/audits/${audit.baseline.id}`} className="text-accent-text hover:underline">{audit.baseline.title}</Link> : <span className="text-fg-muted">None</span> },
              ]}
            />
          </ReportSection>

          <ReportSection index={9} id="handoff" title="Fix handoff">
            {tasks.length === 0 ? (
              <p className="text-[13px] text-fg-muted">No fix tasks are linked to findings in this snapshot.</p>
            ) : (
              <ul className="divide-y divide-line">
                {tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                    <Link href={`/stores/${storeId}/fixes/tasks/${t.id}`} className="min-w-0 flex-1 basis-64 truncate text-[13px] font-medium text-fg hover:underline">{t.title}</Link>
                    <Status kind="task" value={t.status as keyof typeof STATUS.task} />
                  </li>
                ))}
              </ul>
            )}
            <p className="tnum mt-3 text-xs text-fg-subtle">{withoutTask} of {findings.length} findings have no task yet.</p>
          </ReportSection>
        </>
      }
      aside={
        <>
          <Card as="section">
            <CardHeader
              title="Export"
              subtitle={[audit.reportId, audit.reportVersion].filter(Boolean).join(" · ") || undefined}
              actions={audit.reportStatus === "ready" ? <Badge tone="success" icon="check-circle">Ready</Badge> : audit.reportStatus ? <Badge>{audit.reportStatus}</Badge> : undefined}
            />
            <CardBody>
              <ReportActions snapshotId={snapshotId} />
            </CardBody>
          </Card>
          <Card as="section">
            <CardHeader title="Contents" />
            <CardBody className="pt-2">
              <ol className="flex flex-col">
                {SECTIONS.map((s, i) => (
                  <li key={s.id}>
                    <Link href={`#${s.id}`} className="flex items-center gap-2 rounded-control px-1.5 py-1 text-[13px] text-fg-muted hover:bg-surface-2 hover:text-fg">
                      <span className="tnum w-4 text-fg-subtle">{i + 1}</span>
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </>
      }
    />
  );
}

export default function AuditReportPage(props: PageProps<"/stores/[storeId]/audits/[auditId]/report">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuditReportPageContent {...props} />
    </Suspense>
  );
}
