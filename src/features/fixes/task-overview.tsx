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
import type { AssigneeOption, TaskDetailData, TaskStatus } from "@/types/fixes";

import { dueInfo, MODE_HINT, MODE_LABEL, Person } from "./fixes-shared";

type Props = {
  storeId: string;
  detail: TaskDetailData;
  status: TaskStatus;
  assignee: string | null;
  assignees: AssigneeOption[];
  onAssign: (name: string) => void;
};

export function TaskOverviewTab({ storeId, detail, status, assignee, assignees, onAssign }: Props) {
  const { task } = detail;
  const [assigning, setAssigning] = useState(false);
  const [choice, setChoice] = useState(assignee ?? assignees[0]?.name ?? "");
  const due = dueInfo(task.dueAt, status);
  const base = `/stores/${storeId}/fixes`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
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
                { label: "Due", value: <span className={cn("tnum", due.overdue && "font-medium text-danger")}>{task.dueAt ? formatDate(task.dueAt) : "No due date"}{due.overdue ? " · overdue" : ""}</span> },
                { label: "Execution mode", value: <span title={MODE_HINT[task.mode]}>{MODE_LABEL[task.mode]}</span> },
                { label: "Risk", value: <Status kind="risk" value={task.risk} /> },
                { label: "Priority", value: <Status kind="priority" value={task.priority} /> },
                { label: "Status", value: <Status kind="task" value={status} /> },
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
            <p className="mt-4 border-t border-line pt-3 text-xs text-fg-subtle">
              Created {formatDate(detail.createdAt)} by {detail.createdBy}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Success criteria" info="Met only when the verification checks pass. Applied or published is not enough." />
          <CardBody className="pt-2">
            <ul className="flex flex-col gap-2">
              {detail.successCriteria.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[13px] text-fg-muted">
                  <Icon name="shield-check" size={15} className="mt-0.5 shrink-0 text-fg-subtle" />
                  {c}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
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
          <CardHeader title="Dependencies" subtitle={`${detail.dependencies.filter((d) => d.met).length} of ${detail.dependencies.length} met`} />
          <CardBody className="pt-2">
            <ul className="flex flex-col gap-2">
              {detail.dependencies.map((d) => (
                <li key={d.label} className="flex items-start gap-2 text-[13px]">
                  <Icon name={d.met ? "check-circle" : "clock"} size={15} className={cn("mt-0.5 shrink-0", d.met ? "text-success" : "text-warning")} />
                  <span className="text-fg">{d.label}</span>
                  <span className="sr-only">{d.met ? "(met)" : "(not met)"}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={assigning}
        onClose={() => setAssigning(false)}
        title="Assign task"
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
