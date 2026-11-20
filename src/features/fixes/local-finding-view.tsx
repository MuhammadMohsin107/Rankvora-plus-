"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Menu } from "@/components/ui/menu";
import { useDemoCollection } from "@/demo-state";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import type { AssigneeOption, FindingRow, TaskSummary } from "@/types/fixes";

import { canCreateTask } from "./fixes-logic";
import { CATEGORY_LABEL } from "./fixes-shared";
import { useFindingActions } from "./use-finding-actions";
import { useFixData, type FindingState } from "./use-fix-data";

const NONE: FindingState[] = [];
const idOf = (row: FindingState) => row.id;
const subscribe = () => () => {};

type Loose = FindingState & { expected?: string; actual?: string; affectedUrls?: string[]; auditId?: string };
type Props = { storeId: string; findingId: string; tasks: TaskSummary[]; assignees: AssigneeOption[]; actorName: string };

/** Finding detail for an id that is not in the static data: a finding created in this browser (for example by a simulated audit). */
export function LocalFindingView({ storeId, findingId, tasks, assignees, actorName }: Props) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const fix = useFixData(storeId, tasks, NONE, actorName);
  const actions = useFindingActions(fix, assignees);
  const raw = useDemoCollection<FindingState>("findings", NONE, idOf).rows.find((r) => r.id === findingId) as Loose | undefined;
  const row: FindingRow | undefined = fix.findings.find((f) => f.id === findingId);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!row || !raw) {
    return (
      <>
        <PageHeader title="Finding not found" />
        <EmptyState icon="flag" title="This finding is not in this browser" action={<ButtonLink href={`/stores/${storeId}/fixes`} variant="primary">Open findings</ButtonLink>} />
      </>
    );
  }

  const full: FindingRow = {
    ...row,
    context: { expected: raw.expected ?? "", actual: raw.actual ?? "", affectedUrls: raw.affectedUrls ?? [], verificationCriteria: [], recommendation: null },
  };
  const linked = full.tasks;

  return (
    <>
      <PageHeader
        title={row.title}
        subtitle={CATEGORY_LABEL[row.category]}
        meta={
          <>
            <Status kind="finding" value={row.status} />
            <Status kind="severity" value={row.severity} />
          </>
        }
        actions={<Menu trigger={<IconButton icon="more" label="Finding actions" variant="secondary" />} items={actions.menuItems(full)} />}
      />
      <HeaderAction>
        {canCreateTask(row.status) && linked.length === 0 ? (
          <Button variant="primary" icon="plus" onClick={() => actions.openCreate(full, null)}>
            Create task
          </Button>
        ) : null}
      </HeaderAction>
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardBody className="flex flex-col gap-4">
            {raw.expected || raw.actual ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                <div className="rounded-control border border-line bg-surface-2 p-3">
                  <h3 className="text-helper font-medium text-success-text">Expected</h3>
                  <p className="mt-1 text-body-sm text-fg">{raw.expected ?? "Not recorded."}</p>
                </div>
                <div className="rounded-control border border-line bg-surface-2 p-3">
                  <h3 className="text-helper font-medium text-warning-text">Observed</h3>
                  <p className="mt-1 text-body-sm text-fg">{raw.actual ?? "Not recorded."}</p>
                </div>
              </div>
            ) : null}
            {linked.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Linked tasks">
                {linked.map((t) => (
                  <li key={t.id}>
                    <Link href={`/stores/${storeId}/fixes/tasks/${t.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-label hover:bg-surface-2">
                      <span className="tnum font-medium text-accent-text">{t.id}</span>
                      <Status kind="task" value={t.status} compact />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <EvidenceTrace ids={{ storeId, findingId, sourceId: raw.auditId }} label="Evidence trace for this finding" />
          </CardBody>
        </Card>
      </div>
      {actions.dialogs}
    </>
  );
}
