"use client";

import { useRef, useState } from "react";

import { PageHeader, SplitLayout } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Switch } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { Timeline } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { DEMO_NOW, formatDate } from "@/lib/format";
import type { PromptStatus } from "@/types/core";
import type { PromptActivityItem, PromptDetailData } from "@/types/prompts";

import { ConfigDialog, WordingDialog, type ConfigDraft } from "./detail-dialogs";
import { ResultsSection } from "./results-section";
import { namesBrand } from "./text";
import { TrackingConfig } from "./tracking-config";
import { VersionHistory } from "./version-history";

type Dialogs = "wording" | "config" | "pause" | "archive" | null;

const ACTIVITY_ICON = { created: "plus", version: "pencil", status: "circle-dot", config: "settings" } as const;

export function PromptDetail({ data }: { data: PromptDetailData }) {
  const { store, channels, groups, products, existing, actor } = data;
  const toast = useToast();
  const [prompt, setPrompt] = useState(data.prompt);
  const [versions, setVersions] = useState(data.versions);
  const [activity, setActivity] = useState(data.activity);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const seq = useRef(0);
  const base = `/stores/${store.id}/prompts`;

  const log = (title: string, kind: PromptActivityItem["kind"], detail?: string) => {
    seq.current += 1;
    setActivity((current) => [{ id: `local-${seq.current}`, at: DEMO_NOW, actor, title, detail, kind }, ...current]);
  };

  const changeStatus = (status: PromptStatus) => {
    setPrompt((current) => ({ ...current, status, updatedAt: DEMO_NOW }));
    const done = { active: "activated", paused: "paused", archived: "archived", draft: "restored as draft" }[status];
    log(done.charAt(0).toUpperCase() + done.slice(1), "status");
    toast.push({ title: `Prompt ${done}`, description: status === "active" ? (channels.length === 0 ? "It runs once an AI channel is selected for this store." : "It runs in the next audit and monitoring run.") : status === "archived" ? "Results and versions stay available." : undefined });
  };

  const commitWording = (text: string) => {
    const next = prompt.version + 1;
    setPrompt((current) => ({ ...current, text, version: next, mentionsBrand: namesBrand(text, store.brandName), updatedAt: DEMO_NOW }));
    setVersions((current) => [{ version: next, text, changedBy: actor, changedAt: DEMO_NOW, note: null, runs: 0 }, ...current]);
    log(`Wording changed · v${next}`, "version");
    toast.push({ title: `Version v${next} created`, description: `Earlier runs still point to v${prompt.version}.` });
  };

  const saveConfig = (draft: ConfigDraft) => {
    const changed: string[] = [];
    if (draft.intent !== prompt.intent) changed.push("intent");
    if (draft.topic !== prompt.topic) changed.push("topic");
    if (draft.scope !== prompt.scope) changed.push("scope");
    if (draft.market !== prompt.market || draft.language !== prompt.language) changed.push("market / language");
    if (draft.groupId !== (prompt.groupId ?? "")) changed.push("group");
    if (draft.isCore !== prompt.isCore) changed.push("core flag");
    if (JSON.stringify(draft.productIds) !== JSON.stringify(prompt.productIds)) changed.push("linked products");
    setPrompt((current) => ({ ...current, ...draft, groupId: draft.groupId || null, updatedAt: DEMO_NOW }));
    log("Tracking changed", "config", changed.join(", "));
    toast.push({ title: "Tracking updated", description: changed.join(", ") });
  };

  const archived = prompt.status === "archived";
  const currentRuns = versions[0]?.runs ?? 0;

  return (
    <>
      <PageHeader
        title={prompt.text}
        breadcrumb={[{ label: "Prompts", href: base }, { label: prompt.id }]}
        meta={
          <>
            <Status kind="prompt" value={prompt.status} />
            <Badge tone="neutral">v{prompt.version}</Badge>
          </>
        }
        actions={
          <>
            <div className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3">
              <span className="text-[13px] text-fg-muted">Active</span>
              <Switch
                label="Active"
                checked={prompt.status === "active"}
                disabled={archived}
                onChange={(next) => (next ? changeStatus("active") : setDialog("pause"))}
              />
            </div>
            <Button icon="pencil" onClick={() => setDialog("wording")}>Edit wording</Button>
            <Menu
              trigger={<IconButton icon="more" label="More actions" variant="secondary" />}
              items={[
                archived ? { label: "Restore as draft", icon: "undo", onSelect: () => changeStatus("draft") } : { label: "Archive", icon: "minus-circle", tone: "danger", onSelect: () => setDialog("archive") },
              ]}
            />
          </>
        }
      />

      <SplitLayout
        main={
          <Tabs
            label="Prompt details"
            tabs={[
              {
                id: "results",
                label: "Results",
                content: <ResultsSection results={data.results} channels={channels} versions={versions} status={prompt.status} storeId={store.id} />,
              },
              { id: "versions", label: "Versions", count: versions.length, content: <VersionHistory key={versions.length} versions={versions} /> },
              {
                id: "activity",
                label: "Activity",
                count: activity.length,
                content: (
                  <Card as="section">
                    <CardBody>
                      <Timeline
                        items={activity.map((item) => ({
                          id: item.id,
                          title: item.title,
                          time: formatDate(item.at),
                          icon: ACTIVITY_ICON[item.kind],
                          tone: item.kind === "version" ? "accent" : "neutral",
                          meta: `${item.actor}${item.detail ? ` · ${item.detail}` : ""}`,
                        }))}
                      />
                    </CardBody>
                  </Card>
                ),
              },
            ]}
          />
        }
        aside={<TrackingConfig prompt={prompt} groups={groups} products={products} channels={channels} onEdit={() => setDialog("config")} />}
      />

      <WordingDialog open={dialog === "wording"} onClose={() => setDialog(null)} prompt={prompt} storeId={store.id} existing={existing} currentRuns={currentRuns} onCommit={commitWording} />
      <ConfigDialog open={dialog === "config"} onClose={() => setDialog(null)} prompt={prompt} groups={groups} products={products} onSave={saveConfig} />

      <ConfirmDialog
        open={dialog === "pause"}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          changeStatus("paused");
          setDialog(null);
        }}
        title="Pause this prompt?"
        confirmLabel="Pause prompt"
        tone="primary"
      >
        It stops running in audits and monitoring. Past results stay. You can activate it again at any time.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "archive"}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          changeStatus("archived");
          setDialog(null);
        }}
        title="Archive this prompt?"
        confirmLabel="Archive"
      >
        It stops running in audits and monitoring. Past results and versions stay available, and you can restore it as a draft.
      </ConfirmDialog>
    </>
  );
}
