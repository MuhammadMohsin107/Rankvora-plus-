"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Callout, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { DEMO_NOW, formatRelative, pluralize } from "@/lib/format";
import { INTENT_LABEL, SCOPE_LABEL, SOURCE_LABEL } from "@/lib/labels";
import { STATUS } from "@/lib/status";
import type { PromptGroup, PromptStatus } from "@/types/core";
import type { LibraryPrompt, StoreContext } from "@/types/prompts";

import { GroupsDrawer } from "./groups-drawer";
import { LastResults } from "./parts";

const STATUS_ORDER: Record<PromptStatus, number> = { active: 0, draft: 1, paused: 2, archived: 3 };
const SCOPE_SHORT = { audit: "Audit", monitoring: "Monitoring", both: "Both" } as const;
const NO_GROUP = "none";

type Pending = { kind: "archive" | "move"; ids: string[]; done?: () => void };

export function PromptLibrary({ store, initialPrompts, initialGroups }: { store: StoreContext; initialPrompts: LibraryPrompt[]; initialGroups: PromptGroup[] }) {
  const toast = useToast();
  const [prompts, setPrompts] = useState(initialPrompts);
  const [groups, setGroups] = useState(initialGroups);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [moveTo, setMoveTo] = useState(NO_GROUP);
  const groupSeq = useRef(0);

  const base = `/stores/${store.id}/prompts`;
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? null;

  const counts = useMemo(() => {
    const byGroup: Record<string, number> = {};
    for (const p of prompts) if (p.groupId) byGroup[p.groupId] = (byGroup[p.groupId] ?? 0) + 1;
    return byGroup;
  }, [prompts]);
  const ungrouped = prompts.filter((p) => !p.groupId).length;

  const summary = useMemo(() => {
    const byStatus = { active: 0, draft: 0, paused: 0, archived: 0 };
    for (const p of prompts) byStatus[p.status] += 1;
    const active = prompts.filter((p) => p.status === "active");
    const brand = active.filter((p) => p.mentionsBrand).length;
    return { ...byStatus, brand, neutral: active.length - brand, core: active.filter((p) => p.isCore).length };
  }, [prompts]);

  const patch = (ids: string[], change: Partial<LibraryPrompt>) => setPrompts((current) => current.map((p) => (ids.includes(p.id) ? { ...p, ...change, updatedAt: DEMO_NOW } : p)));

  const setStatus = (rows: LibraryPrompt[], status: PromptStatus, done?: () => void) => {
    const eligible = rows.filter((p) => p.status !== status && (p.status !== "archived" || status === "draft"));
    const skipped = rows.length - eligible.length;
    if (eligible.length === 0) {
      toast.push({ title: "Nothing to change", description: `Selected prompts are already ${STATUS.prompt[status].label.toLowerCase()} or archived.`, tone: "info" });
      return;
    }
    patch(eligible.map((p) => p.id), { status });
    const verb = { active: "activated", paused: "paused", draft: "restored as draft", archived: "archived" }[status];
    toast.push({
      title: eligible.length === 1 ? `Prompt ${verb}` : `${pluralize(eligible.length, "prompt")} ${verb}`,
      description: skipped ? `${skipped} skipped (no change needed).` : eligible.length === 1 ? eligible[0].text : undefined,
    });
    done?.();
  };

  const openMove = (ids: string[], done?: () => void) => {
    setMoveTo(NO_GROUP);
    setPending({ kind: "move", ids, done });
  };

  const confirmMove = () => {
    if (!pending) return;
    const target = moveTo === NO_GROUP ? null : moveTo;
    patch(pending.ids, { groupId: target });
    toast.push({ title: `${pluralize(pending.ids.length, "prompt")} moved`, description: target ? groupName(target) ?? undefined : "Now ungrouped" });
    pending.done?.();
    setPending(null);
  };

  const confirmArchive = () => {
    if (!pending) return;
    const rows = prompts.filter((p) => pending.ids.includes(p.id));
    setStatus(rows, "archived", pending.done);
    setPending(null);
  };

  const pendingRows = prompts.filter((p) => pending?.ids.includes(p.id));

  const columns: Column<LibraryPrompt>[] = [
    {
      id: "text",
      header: "Prompt",
      sort: (r) => r.text.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0 max-w-[28rem]">
          <Link href={`${base}/${r.id}`} className="line-clamp-2 rounded font-medium text-fg hover:text-accent-text hover:underline">
            {r.text}
          </Link>
          <p className="mt-0.5 truncate text-xs text-fg-subtle">
            {r.topic}
            {r.mentionsBrand ? " · Names brand" : ""}
          </p>
        </div>
      ),
    },
    { id: "intent", header: "Intent", hideBelow: "md", sort: (r) => INTENT_LABEL[r.intent], cell: (r) => <span className="whitespace-nowrap text-fg-muted">{INTENT_LABEL[r.intent]}</span> },
    {
      id: "group",
      header: "Group",
      hideBelow: "2xl",
      sort: (r) => groupName(r.groupId)?.toLowerCase() ?? null,
      cell: (r) => groupName(r.groupId) ?? <span className="text-fg-subtle">Ungrouped</span>,
    },
    { id: "scope", header: "Scope", hideBelow: "2xl", sort: (r) => r.scope, cell: (r) => <Badge tone="neutral" title={SCOPE_LABEL[r.scope]}>{SCOPE_SHORT[r.scope]}</Badge> },
    { id: "status", header: "Status", sort: (r) => STATUS_ORDER[r.status], cell: (r) => <Status kind="prompt" value={r.status} /> },
    { id: "version", header: "Version", hideBelow: "2xl", sort: (r) => r.version, cell: (r) => <span className="tnum text-fg-muted">v{r.version}</span> },
    { id: "source", header: "Source", hideBelow: "2xl", sort: (r) => SOURCE_LABEL[r.source], cell: (r) => <span className="whitespace-nowrap text-fg-muted">{SOURCE_LABEL[r.source]}</span> },
    {
      id: "core",
      header: "Core",
      hideBelow: "lg",
      sort: (r) => (r.isCore ? 0 : 1),
      cell: (r) =>
        r.isCore ? (
          <Badge tone="accent" icon="flag">Core</Badge>
        ) : (
          <span className="text-fg-subtle"><span aria-hidden="true">—</span><span className="sr-only">Not core</span></span>
        ),
    },
    { id: "last", header: "Latest result", hideBelow: "lg", cell: (r) => <LastResults results={r.lastResults} /> },
    {
      id: "updated",
      header: "Updated",
      hideBelow: "2xl",
      sort: (r) => Date.parse(r.updatedAt),
      cell: (r) => <span className="tnum whitespace-nowrap text-fg-muted">{formatRelative(r.updatedAt)}</span>,
    },
    {
      id: "actions",
      header: "Row actions",
      srOnlyHeader: true,
      width: "w-10",
      align: "right",
      cell: (r) => {
        const items: MenuItem[] = [
          { label: "Open", icon: "arrow-up-right", href: `${base}/${r.id}` },
          r.status === "active"
            ? { label: "Pause", icon: "pause", onSelect: () => setStatus([r], "paused") }
            : r.status === "archived"
              ? { label: "Restore as draft", icon: "undo", onSelect: () => setStatus([r], "draft") }
              : { label: "Activate", icon: "play", onSelect: () => setStatus([r], "active") },
          { label: "Move to group", icon: "layers", onSelect: () => openMove([r.id]) },
          { type: "separator" },
          { label: "Archive", icon: "minus-circle", tone: "danger", disabled: r.status === "archived", disabledReason: "Already archived", onSelect: () => setPending({ kind: "archive", ids: [r.id] }) },
        ];
        return <Menu trigger={<IconButton icon="more" label="Row actions" size="sm" />} items={items} />;
      },
    },
  ];

  const filters: TableFilter<LibraryPrompt>[] = [
    { id: "status", label: "Status", options: (Object.keys(STATUS.prompt) as PromptStatus[]).map((v) => ({ value: v, label: STATUS.prompt[v].label })), value: (r) => r.status },
    { id: "intent", label: "Intent", options: Object.entries(INTENT_LABEL).map(([value, label]) => ({ value, label })), value: (r) => r.intent },
    { id: "group", label: "Group", options: [...groups.map((g) => ({ value: g.id, label: g.name })), { value: NO_GROUP, label: "Ungrouped" }], value: (r) => r.groupId ?? NO_GROUP },
    { id: "scope", label: "Scope", options: Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label })), value: (r) => r.scope },
    { id: "source", label: "Source", options: Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label })), value: (r) => r.source },
    { id: "core", label: "Core", options: [{ value: "yes", label: "Core" }, { value: "no", label: "Not core" }], value: (r) => (r.isCore ? "yes" : "no") },
  ];

  const activeTotal = summary.active;

  return (
    <div className="flex flex-col gap-5">
      <MetricGrid>
        <MetricCell>
          <Metric label="Active prompts" value={String(summary.active)} basis={`${summary.draft} draft · ${summary.paused} paused · ${summary.archived} archived`} info="Only active prompts run in audits and monitoring." />
        </MetricCell>
        <MetricCell>
          <Metric label="Neutral" value={String(summary.neutral)} basis={`of ${activeTotal} active`} info="Neutral prompts do not name the brand. They test whether AI answers bring it up." />
        </MetricCell>
        <MetricCell>
          <Metric label="Brand-specific" value={String(summary.brand)} basis={`of ${activeTotal} active`} info="These prompts name the brand, so they usually score higher on mentions." />
        </MetricCell>
        <MetricCell>
          <Metric label="Core set" value={String(summary.core)} basis={`of ${activeTotal} active`} info="Core prompts are the stable set used to compare results over time." />
        </MetricCell>
      </MetricGrid>

      {activeTotal > 0 && summary.neutral === 0 ? (
        <Callout
          tone="warning"
          title="Every active prompt names the brand"
          actions={<ButtonLink href={`${base}/new`} size="sm" variant="secondary" icon="plus">Add neutral prompt</ButtonLink>}
        >
          Mention rates will look high. Neutral prompts show real discovery.
        </Callout>
      ) : null}

      <DataTable
        label="Prompt library"
        data={prompts}
        columns={columns}
        rowKey={(r) => r.id}
        searchable={{ placeholder: "Search prompts", text: (r) => `${r.text} ${r.topic} ${INTENT_LABEL[r.intent]} ${groupName(r.groupId) ?? ""}` }}
        filters={filters}
        defaultSort={{ column: "status", dir: "asc" }}
        selectable
        pageSize={25}
        toolbarExtra={
          <Button icon="layers" onClick={() => setGroupsOpen(true)}>
            Manage groups
          </Button>
        }
        bulkActions={(selected, clear) => (
          <>
            <Button size="sm" variant="secondary" icon="play" onClick={() => setStatus(selected, "active", clear)}>Activate</Button>
            <Button size="sm" variant="secondary" icon="pause" onClick={() => setStatus(selected, "paused", clear)}>Pause</Button>
            <Button size="sm" variant="secondary" icon="layers" onClick={() => openMove(selected.map((r) => r.id), clear)}>Move to group</Button>
            <Button size="sm" variant="danger-ghost" icon="minus-circle" onClick={() => setPending({ kind: "archive", ids: selected.map((r) => r.id), done: clear })}>Archive</Button>
          </>
        )}
      />

      <GroupsDrawer
        open={groupsOpen}
        onClose={() => setGroupsOpen(false)}
        groups={groups}
        counts={counts}
        ungrouped={ungrouped}
        onCreate={(name) => {
          groupSeq.current += 1;
          setGroups((current) => [...current, { id: `g-new-${groupSeq.current}`, storeId: store.id, name }]);
        }}
        onRename={(id, name) => setGroups((current) => current.map((g) => (g.id === id ? { ...g, name } : g)))}
        onDelete={(id) => {
          setGroups((current) => current.filter((g) => g.id !== id));
          setPrompts((current) => current.map((p) => (p.groupId === id ? { ...p, groupId: null } : p)));
        }}
      />

      <ConfirmDialog
        open={pending?.kind === "archive"}
        onClose={() => setPending(null)}
        onConfirm={confirmArchive}
        title={pendingRows.length === 1 ? "Archive this prompt?" : `Archive ${pendingRows.length} prompts?`}
        confirmLabel="Archive"
      >
        {pendingRows.length === 1 ? <span className="[overflow-wrap:anywhere]">“{pendingRows[0].text}”. </span> : null}
        Archived prompts stop running in audits and monitoring. Past results and versions stay available.
      </ConfirmDialog>

      <Dialog
        open={pending?.kind === "move"}
        onClose={() => setPending(null)}
        title={`Move ${pluralize(pendingRows.length, "prompt")}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="primary" onClick={confirmMove}>Move</Button>
          </>
        }
      >
        <Field label="Group">
          {({ id }) => (
            <Select id={id} value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
              <option value={NO_GROUP}>Ungrouped</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          )}
        </Field>
      </Dialog>
    </div>
  );
}
