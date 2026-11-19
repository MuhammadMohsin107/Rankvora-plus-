import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Mono } from "@/components/ui/misc";
import { LinkTabs } from "@/components/ui/tabs";
import { CancelAuditButton, ConfigDrawerButton } from "@/features/audit/audit-actions";
import { AUDIT_TYPE_LABEL, formatMinutes } from "@/features/audit/labels";
import { formatDateTime } from "@/lib/format";
import { channelLabel } from "@/lib/labels";
import { auditParams, getAudit, getAuditFindings } from "@/services/audit";
import { listStoreChannels } from "@/services/core";

export async function generateStaticParams() {
  return auditParams();
}

export default async function AuditLayout({ children, params }: LayoutProps<"/stores/[storeId]/audits/[auditId]">) {
  const { storeId, auditId } = await params;
  const audit = await getAudit(storeId, auditId);
  if (!audit) notFound();

  const [channels, findings] = await Promise.all([listStoreChannels(storeId), getAuditFindings(storeId, auditId)]);
  const base = `/stores/${storeId}/audits/${auditId}`;

  const times = [
    `Started ${formatDateTime(audit.startedAt)} UTC`,
    audit.completedAt ? `Completed ${formatDateTime(audit.completedAt)} UTC` : null,
    `${formatMinutes(audit.durationSeconds)}${audit.provisional ? " so far" : ""}`,
    audit.createdBy,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={audit.title}
        breadcrumb={[{ label: "Audits", href: `/stores/${storeId}/audits` }, { label: audit.id }]}
        subtitle={times.join(" · ")}
        meta={
          <>
            <Status kind="audit" value={audit.status} />
            <Badge>{AUDIT_TYPE_LABEL[audit.type]}</Badge>
            {audit.snapshotId ? (
              <span className="inline-flex items-center gap-1.5" title="Immutable snapshot: it cannot change after completion">
                <Badge tone="neutral" icon="lock">Snapshot</Badge>
                <Mono>{audit.snapshotId}</Mono>
              </span>
            ) : (
              <Badge tone="neutral" icon="clock" title="A snapshot is created when the audit completes">No snapshot yet</Badge>
            )}
          </>
        }
        actions={
          <>
            <ConfigDrawerButton auditTitle={audit.title} config={audit.config} channels={channels.map((c) => ({ id: c.id, label: channelLabel(c) }))} />
            {audit.provisional ? (
              <CancelAuditButton completedJobs={audit.succeededJobs + audit.failedJobs} assessedPages={audit.pages?.n ?? 0} />
            ) : (
              <ButtonLink href={`/stores/${storeId}/audits/new`} icon="refresh">Run again</ButtonLink>
            )}
          </>
        }
        tabs={
          <LinkTabs
            label="Audit sections"
            items={[
              { href: base, label: "Overview", exact: true },
              { href: `${base}/ai-visibility`, label: "AI visibility" },
              { href: `${base}/website`, label: "Website readiness" },
              { href: `${base}/findings`, label: "Findings", count: audit.provisional ? undefined : findings.length },
              { href: `${base}/report`, label: "Report" },
            ]}
          />
        }
      />
      {children}
    </>
  );
}
