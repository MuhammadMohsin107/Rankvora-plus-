"use client";

import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyValue } from "@/components/ui/card";
import { Drawer } from "@/components/ui/overlay";
import type { AuditConfig, AuditLane } from "@/types/audit";

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
export function ConfigDrawerButton({ config, channels, lanes }: { config: AuditConfig; channels: { id: string; label: string }[]; lanes: AuditLane[] }) {
  const [open, setOpen] = useState(false);
  const hasWebsite = lanes.includes("website_readiness");
  const onOff = (v: boolean) => (
    <Badge tone={v ? "success" : "neutral"} icon={v ? "check-circle" : "minus-circle"}>
      {v ? "On" : "Off"}
    </Badge>
  );
  return (
    <>
      <Button icon="settings" onClick={() => setOpen(true)}>Configuration</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Configuration" description="Frozen when the audit started" size="md">
        <div className="flex flex-col gap-4">
          <Group title="AI visibility">
            <KeyValue
              columns={1}
              items={[
                { label: "Prompts", value: `${PROMPT_SCOPE[config.promptScope]} · ${config.promptIds.length}` },
                { label: "Prompt versions", value: <span className="tnum">{(config.prompts?.map((p) => `${p.id} v${p.version}`) ?? config.promptIds).join(", ")}</span> },
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
                { label: "Samples per prompt and provider", value: <span className="tnum">{config.samples}</span> },
                { label: "Market · language", value: `${config.market} · ${config.language.toUpperCase()}` },
              ]}
            />
          </Group>
          <Group title="Website readiness">
            {hasWebsite ? (
              <KeyValue
                columns={1}
                items={[
                  { label: "Start points", value: config.startPoints.join(", ") },
                  { label: "Page types", value: config.pageTypes.join(", ") },
                  { label: "Excluded paths", value: <span className="font-mono text-xs">{config.excludedPaths.join("  ")}</span> },
                  { label: "Max URLs · depth", value: <span className="tnum">{config.maxUrls} · {config.maxDepth}</span> },
                ]}
              />
            ) : (
              <p className="text-[13px] text-fg-muted">Not part of this audit. The site was not crawled.</p>
            )}
          </Group>
          <Group title="Criteria and integrations">
            <KeyValue
              columns={2}
              items={[
                { label: "Criteria version", value: <span className="tnum">{config.criteriaVersion}</span> },
                { label: "Analysis version", value: <span className="tnum">{config.analysisVersion}</span> },
                ...(hasWebsite
                  ? [
                      { label: "Search Console", value: onOff(config.integrations.searchConsole) },
                      { label: "PageSpeed (lab)", value: onOff(config.integrations.pageSpeed) },
                      { label: "Website connector", value: onOff(config.integrations.cms) },
                    ]
                  : []),
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
