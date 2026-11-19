"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { DiffView, Timeline } from "@/components/ui/misc";
import { formatDate, pluralize } from "@/lib/format";
import type { PromptVersion } from "@/types/prompts";

/** Newest first. Compare any two versions word by word. */
export function VersionHistory({ versions }: { versions: PromptVersion[] }) {
  const [choice, setChoice] = useState<{ from: number; to: number } | null>(null);
  const latest = versions[0];
  const from = choice?.from ?? versions[1]?.version ?? latest.version;
  const to = choice?.to ?? latest.version;
  const textOf = (v: number) => versions.find((x) => x.version === v)?.text ?? "";
  const options = versions.map((v) => (
    <option key={v.version} value={v.version}>
      v{v.version}
      {v.version === latest.version ? " (current)" : ""}
    </option>
  ));

  return (
    <div className="flex flex-col gap-5">
      <Card as="section">
        <CardHeader title="History" info="Editing the wording creates a new version. Earlier runs keep pointing to the version they used." />
        <CardBody>
          <Timeline
            items={versions.map((v) => ({
              id: `v${v.version}`,
              icon: v.version === 1 ? "plus" : "pencil",
              tone: v.version === latest.version ? "accent" : "neutral",
              title: (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="tnum">v{v.version}</span>
                  {v.version === latest.version ? <Badge tone="accent">Current</Badge> : null}
                  <span className="tnum text-xs font-normal text-fg-subtle" title="Monitoring runs and audits that used this version">
                    {v.runs === 0 ? "Not used yet" : `Used by ${pluralize(v.runs, "run")}`}
                  </span>
                </span>
              ),
              time: formatDate(v.changedAt),
              meta: (
                <>
                  <p className="text-fg-muted [overflow-wrap:anywhere]">{v.text}</p>
                  <p className="mt-0.5 text-fg-subtle">{v.changedBy}{v.note ? ` · ${v.note}` : ""}</p>
                </>
              ),
            }))}
          />
        </CardBody>
      </Card>

      {versions.length > 1 ? (
        <Card as="section">
          <CardHeader title="Compare versions" />
          <CardBody className="flex flex-col gap-4">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              <Field label="From">
                {({ id }) => (
                  <Select id={id} value={from} onChange={(event) => setChoice({ from: Number(event.target.value), to })}>
                    {options}
                  </Select>
                )}
              </Field>
              <Field label="To">
                {({ id }) => (
                  <Select id={id} value={to} onChange={(event) => setChoice({ from, to: Number(event.target.value) })}>
                    {options}
                  </Select>
                )}
              </Field>
            </div>
            <DiffView before={textOf(from)} after={textOf(to)} beforeLabel={`v${from}`} afterLabel={`v${to}`} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
