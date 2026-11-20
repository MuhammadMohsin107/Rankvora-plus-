"use client";

import Link from "next/link";
import { useState } from "react";

import { Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/overlay";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { AssigneeOption, TaskDetailData } from "@/types/fixes";

import { dueInfo, MODE_HINT, MODE_LABEL, Person } from "./fixes-shared";
import type { TaskView } from "./task-view";

type Props = {
  storeId: string;
  detail: TaskDetailData;
  view: TaskView;
  assignees: AssigneeOption[];
  onAssign: (name: string) => void;
};

export function TaskOverviewTab({ storeId, detail, view, assignees, onAssign }: Props) {
  const { task } = detail;
  const { status, assignee } = view;
  const [assigning, setAssigning] = useState(false);
  const [choice, setChoice] = useState(assignee ?? assignees[0]?.name ?? "");
  const due = dueInfo(task.dueAt, status);
  const base = `/stores/${storeId}/fixes`;
  const met = detail.dependencies.filter((d) => d.met).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader title="Details" />
        <CardBody>
          <KeyValue
            columns={2}
            items={[
              {
                label: "Assignee",
                value: (
                  <span className="flex flex-wrap items-center gap-2">
                    <Person name={assignee} />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setChoice(assignee ?? assignees[0]?.name ?? "");
                        setAssigning(true);
                      }}
                    >
                      {assignee ? "Change" : "Assign"}
                    </Button>
                  </span>
                ),
              },
              { label: "Due", value: <span className={cn("tnum", due.overdue && "font-medium text-danger-text")}>{task.dueAt ? formatDate(task.dueAt) : "No due date"}{due.overdue ? " · overdue" : ""}</span> },
              { label: "Execution mode", value: <span title={MODE_HINT[task.mode]}>{MODE_LABEL[task.mode]}</span> },
              { label: "Risk", value: <Status kind="risk" value={task.risk} /> },
              { label: "Finding", value: <Link href={`${base}/findings/${task.findingId}`} className="text-accent-text hover:underline">{task.findingId} · {task.findingTitle}</Link> },
              {
                label: "Recommendation",
                value: detail.recommendationId ? (
                  <Link href={`${base}/findings/${task.findingId}#recommendations`} className="text-accent-text hover:underline">{detail.recommendationId}</Link>
                ) : (
                  "None"
                ),
              },
            ]}
          />
          <p className="tnum mt-4 border-t border-line pt-3 text-helper text-fg-subtle">
            Created {formatDate(detail.createdAt)} by {detail.createdBy}
          </p>
        </CardBody>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        {status === "rejected" && view.rejection ? (
          <Callout tone="neutral" title="Rejected">
            <p>{view.rejection.reason}</p>
            <p className="tnum mt-1 text-helper text-fg-subtle">{view.rejection.by} · {formatDate(view.rejection.at)}</p>
          </Callout>
        ) : null}
        {status === "cancelled" ? (
          <Callout tone="neutral" title="Cancelled">
            <p>{view.cancellation?.reason ?? task.cancelReason ?? "Stopped before completion."}</p>
            {view.cancellation ? <p className="tnum mt-1 text-helper text-fg-subtle">{view.cancellation.by} · {formatDate(view.cancellation.at)}</p> : null}
          </Callout>
        ) : null}
        {status === "superseded" ? (
          <Callout tone="neutral" title="Superseded">
            <p>{view.supersession?.reason ?? "Replaced by a newer task."}</p>
            {(view.supersession?.successorId ?? task.supersededBy) ? (
              <p className="mt-1">
                Replaced by{" "}
                <Link href={`${base}/tasks/${view.supersession?.successorId ?? task.supersededBy}`} className="text-accent-text hover:underline">
                  {view.supersession?.successorId ?? task.supersededBy}
                </Link>
              </p>
            ) : null}
          </Callout>
        ) : null}
        {task.blockers.length > 0 ? (
          <Callout tone="warning" title="Blockers">
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {task.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        <Card>
          <CardHeader title="Done when" info="Met only when the verification checks pass. Applied or published is not enough." />
          <CardBody className="flex flex-col gap-4 pt-2">
            <ul className="flex flex-col gap-2">
              {detail.successCriteria.map((c) => (
                <li key={c} className="flex items-start gap-2 text-body-sm text-fg-muted">
                  <Icon name="shield-check" size={15} className="mt-0.5 shrink-0 text-fg-subtle" />
                  {c}
                </li>
              ))}
            </ul>
            {detail.dependencies.length > 0 ? (
              <div className="border-t border-line pt-3">
                <h3 className="mb-2 text-helper font-medium text-fg-subtle">Dependencies · {met} of {detail.dependencies.length} met</h3>
                <ul className="flex flex-col gap-2">
                  {detail.dependencies.map((d) => (
                    <li key={d.label} className="flex items-start gap-2 text-body-sm">
                      <Icon name={d.met ? "check-circle" : "clock"} size={15} className={cn("mt-0.5 shrink-0", d.met ? "text-success-icon" : "text-warning-icon")} />
                      <span className="text-fg">{d.label}</span>
                      <span className="sr-only">{d.met ? "(met)" : "(not met)"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={assigning}
        onClose={() => setAssigning(false)}
        title="Assign task"
        size="sm"
        footer={
          <>
            <Button onClick={() => setAssigning(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                onAssign(choice);
                setAssigning(false);
              }}
            >
              Assign
            </Button>
          </>
        }
      >
        <Field label="Assignee" hint="Viewers cannot be assigned.">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={choice} onChange={(event) => setChoice(event.target.value)}>
              {assignees.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name} · {a.role}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Dialog>
    </div>
  );
}
