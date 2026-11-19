"use client";

import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyValue } from "@/components/ui/card";
import { ConfirmDialog, Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { AuditConfig } from "@/types/audit";

const PROMPT_SCOPE = { all_active: "All active prompts", groups: "Selected groups", ids: "Specific prompts" } as const;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}

/** Immutable run configuration, shown in a drawer. */
export function ConfigDrawerButton({ config, channels, auditTitle }: { config: AuditConfig; channels: { id: string; label: string }[]; auditTitle: string }) {
  const [open, setOpen] = useState(false);
  const onOff = (v: boolean) => (
    <Badge tone={v ? "success" : "neutral"} icon={v ? "check-circle" : "minus-circle"}>
      {v ? "On" : "Off"}
    </Badge>
  );
  return (
    <>
      <Button icon="settings" onClick={() => setOpen(true)}>Configuration</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Configuration" description={`${auditTitle} · fixed when the audit started`} size="md">
        <div className="flex flex-col gap-6">
          <Group title="AI visibility">
            <KeyValue
              columns={1}
              items={[
                { label: "Prompts", value: `${PROMPT_SCOPE[config.promptScope]} · ${config.promptIds.length}` },
                { label: "Prompt ids", value: <span className="tnum">{config.promptIds.join(", ")}</span> },
                {
                  label: "Channels",
                  value: (
                    <ul className="flex flex-col gap-0.5">
                      {config.channelIds.map((id) => (
                        <li key={id}>{channels.find((c) => c.id === id)?.label ?? id}</li>
                      ))}
                    </ul>
                  ),
                },
                { label: "Samples per prompt and channel", value: <span className="tnum">{config.samples}</span> },
                { label: "Market · language", value: `${config.market} · ${config.language.toUpperCase()}` },
              ]}
            />
          </Group>
          <Group title="Website readiness">
            <KeyValue
              columns={1}
              items={[
                { label: "Start points", value: config.startPoints.join(", ") },
                { label: "Page types", value: config.pageTypes.join(", ") },
                { label: "Excluded paths", value: <span className="font-mono text-xs">{config.excludedPaths.join("  ")}</span> },
                { label: "Max URLs · depth", value: <span className="tnum">{config.maxUrls} · {config.maxDepth}</span> },
              ]}
            />
          </Group>
          <Group title="Criteria and integrations">
            <KeyValue
              columns={2}
              items={[
                { label: "Criteria version", value: <span className="tnum">{config.criteriaVersion}</span> },
                { label: "Analysis version", value: <span className="tnum">{config.analysisVersion}</span> },
                { label: "Search Console", value: onOff(config.integrations.searchConsole) },
                { label: "PageSpeed (lab)", value: onOff(config.integrations.pageSpeed) },
                { label: "CMS connector", value: onOff(config.integrations.cms) },
              ]}
            />
          </Group>
          <Group title="Limits">
            <KeyValue
              columns={3}
              items={[
                { label: "Max requests", value: <span className="tnum">{config.limits.maxRequests}</span> },
                { label: "Concurrency", value: <span className="tnum">{config.limits.concurrency}</span> },
                { label: "Budget cap", value: <span className="tnum">${config.limits.budgetUsd}</span> },
              ]}
            />
          </Group>
        </div>
      </Drawer>
    </>
  );
}

/** Cancel an in-progress audit. Completed work is kept and marked partial. */
export function CancelAuditButton({ completedJobs, assessedPages }: { completedJobs: number; assessedPages: number }) {
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button variant="danger-ghost" icon="x-circle" disabled={cancelling} onClick={() => setOpen(true)}>
        {cancelling ? "Cancelling…" : "Cancel audit"}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this audit?"
        confirmLabel="Cancel audit"
        cancelLabel="Keep running"
        onConfirm={() => {
          setOpen(false);
          setCancelling(true);
          toast.push({ title: "Cancel requested", description: "Demo action: no requests were stopped.", tone: "info" });
        }}
      >
        No further requests will be sent. The {completedJobs} completed responses and {assessedPages} crawled pages are kept, and the audit is marked partially completed. No snapshot is created.
      </ConfirmDialog>
    </>
  );
}
