"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader, SplitLayout } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Card, CardBody, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { EmptyState, SkeletonCard } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/form";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Timeline } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { simulatedToast } from "@/demo-state";
import { formatDate, formatShortDate } from "@/lib/format";
import type { PromptStatus } from "@/types/core";
import type { PromptDetailData, StoredPrompt } from "@/types/prompts";

import { ConfigDialog, WordingDialog } from "./detail-dialogs";
import { EvidenceSection } from "./evidence-section";
import { combineActivity, combineVersions } from "./prompt-ops";
import { ResultsSection } from "./results-section";
import { TrackingConfig } from "./tracking-config";
import { useHydrated, usePromptActions, usePromptContext, useSavedTemplates } from "./use-prompts";
import { VersionHistory } from "./version-history";

type Dialogs = "wording" | "config" | "pause" | "archive" | null;

const ACTIVITY_ICON = { created: "plus", version: "pencil", status: "circle-dot", config: "settings" } as const;
const NO_ROWS: StoredPrompt[] = [];

export function PromptDetail({ data, promptId }: { data: PromptDetailData; promptId: string }) {
  const toast = useToast();
  const hydrated = useHydrated();
  const { storeId } = data;
  const { context, known } = usePromptContext(data.context);
  const { store, channels, groups, products, existing } = context;
  const templates = useSavedTemplates();

  const staticRows = useMemo<StoredPrompt[]>(() => (data.prompt ? [data.prompt] : NO_ROWS), [data.prompt]);
  const { rows, setStatus, editWording, saveConfig } = usePromptActions<StoredPrompt>(storeId, staticRows, { brand: store.brandName, actor: context.actor });
  const prompt = rows.find((r) => r.id === promptId && r.storeId === storeId);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const base = `/stores/${storeId}/prompts`;

  const versions = useMemo(() => combineVersions(data.versions, prompt?.localVersions), [data.versions, prompt?.localVersions]);
  const activity = useMemo(() => combineActivity(data.activity, prompt?.localActivity), [data.activity, prompt?.localActivity]);

  if (!prompt || !known) {
    return (
      <>
        <PageHeader title="Prompt" />
        {hydrated ? (
          <EmptyState
            icon="prompts"
            title="Prompt not found"
            action={
              <ButtonLink href={base} variant="secondary">
                Prompt Library
              </ButtonLink>
            }
          />
        ) : (
          <SkeletonCard lines={5} />
        )}
      </>
    );
  }

  const archived = prompt.status === "archived";
  const currentRuns = versions[0]?.runs ?? 0;
  const { results, evidence } = data;
  const observation = evidence.lastObservation;
  const untracked = channels.length === 0;
  const frequency = evidence.schedules.find((s) => s.status === "active")?.frequency ?? null;

  const changeStatus = (status: PromptStatus) => {
    const { changed } = setStatus([prompt.id], status);
    if (changed.length === 0) return;
    const done = { active: "activated", paused: "paused", archived: "archived", draft: "restored as draft" }[status];
    toast.push({
      ...simulatedToast(`Prompt ${done}`),
      description: status === "active" ? (untracked ? "It runs once an AI provider is selected." : "It runs in the next audit and monitoring run.") : status === "archived" ? "Results and versions stay." : undefined,
    });
  };

  const commitWording = (text: string, note: string | null) => {
    const version = editWording(prompt.id, text, note);
    toast.push({ ...simulatedToast(`Version v${version} created`), description: `Earlier runs keep v${prompt.version}.` });
  };

  const save = (draft: Parameters<typeof saveConfig>[1]) => {
    const changed = saveConfig(prompt.id, draft);
    toast.push({ ...simulatedToast("Tracking saved"), description: changed.join(", ") || undefined });
  };

  const menu: MenuItem[] = [
    { label: "Save as template", icon: "file-text", onSelect: () => {
      templates.add({ title: prompt.text.length > 40 ? `${prompt.text.slice(0, 39)}…` : prompt.text, text: prompt.text, intent: prompt.intent, topic: prompt.topic });
      toast.push({ ...simulatedToast("Template saved"), description: "Find it under Copy from template." });
    } },
    { type: "separator" },
    archived
      ? { label: "Restore as draft", icon: "undo", onSelect: () => changeStatus("draft") }
      : { label: "Archive", icon: "minus-circle", tone: "danger", onSelect: () => setDialog("archive") },
  ];

  const rate = (key: "mention" | "recommendation") => ({
    numerator: results.pooled[key].n,
    denominator: results.pooled[key].d,
    unit: "successful responses",
    naReason: results.pooled.requests === 0 ? (untracked ? "No provider selected" : "Not run yet") : results.pooled.mention.d === 0 ? "All requests failed" : undefined,
  });

  return (
    <>
      <HeaderAction>
        <Button variant="primary" icon="pencil" onClick={() => setDialog("wording")}>
          Edit wording
        </Button>
      </HeaderAction>
      <PageHeader
        title={prompt.text}
        meta={
          <>
            <Status kind="prompt" value={prompt.status} />
            <Badge tone="neutral">v{prompt.version}</Badge>
            {prompt.origin === "local-demo" ? <Badge tone="info" icon="layers" title="Created in this browser">Simulated</Badge> : null}
          </>
        }
        actions={
          <>
            <div className="flex h-btn items-center gap-2 rounded-control border border-line bg-surface px-3">
              <span className="text-body-sm text-fg-muted">Active</span>
              <Switch label="Active" checked={prompt.status === "active"} disabled={archived} onChange={(next) => (next ? changeStatus("active") : setDialog("pause"))} />
            </div>
            <Menu trigger={<IconButton icon="more" label="More actions" variant="secondary" />} items={menu} />
          </>
        }
      />

      <MetricGrid className="mb-4">
        <MetricCell>
          <Metric label="Mention rate" {...rate("mention")} />
        </MetricCell>
        <MetricCell>
          <Metric label="Recommendation rate" {...rate("recommendation")} />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Last observation"
            value={observation ? formatShortDate(observation.at) : "N/A"}
            basis={observation ? `${observation.channelLabel} · ${observation.kind === "audit" ? "audit" : "run"} ${observation.runId}` : untracked ? "No provider selected" : "Not run yet"}
          />
        </MetricCell>
        <MetricCell>
          <Metric label="Frequency" value={frequency ? frequency.split(" · ")[0] : "N/A"} basis={frequency ? frequency.split(" · ").slice(1).join(" · ") : "Not on a schedule"} />
        </MetricCell>
      </MetricGrid>

      <SplitLayout
        main={
          <Tabs
            label="Prompt details"
            tabs={[
              { id: "results", label: "Results", content: <ResultsSection results={results} channels={data.context.channels} versions={versions} status={prompt.status} storeId={storeId} /> },
              { id: "evidence", label: "Competitors & citations", content: <EvidenceSection evidence={evidence} /> },
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
        aside={
          <>
            <TrackingConfig prompt={prompt} brand={store.brandName} groups={groups} products={products} channels={channels} schedules={evidence.schedules} storeId={storeId} onEdit={() => setDialog("config")} />
            <p className="px-1 text-helper text-fg-muted">
              <Link href={base} className="text-accent-text hover:underline">Back to Prompt Library</Link>
            </p>
          </>
        }
      />

      <WordingDialog open={dialog === "wording"} onClose={() => setDialog(null)} prompt={prompt} storeId={storeId} existing={existing.filter((e) => e.id !== prompt.id)} currentRuns={currentRuns} onCommit={commitWording} />
      <ConfigDialog open={dialog === "config"} onClose={() => setDialog(null)} prompt={prompt} groups={groups} products={products} onSave={save} />

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
        It stops running. Past results stay. You can activate it again.
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
        It stops running. Past results and versions stay. You can restore it as a draft.
      </ConfirmDialog>
    </>
  );
}
