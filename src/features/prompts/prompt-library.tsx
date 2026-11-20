"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Callout, Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar } from "@/components/ui/filter-bar";
import { Checkbox, Field, Segmented, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { Popover } from "@/components/ui/popover";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { SkeletonTable } from "@/components/ui/feedback";
import { simulatedToast } from "@/demo-state";
import { cn } from "@/lib/cn";
import { formatDate, formatRelative, pluralize } from "@/lib/format";
import { INTENT_LABEL, SCOPE_LABEL, SOURCE_LABEL } from "@/lib/labels";
import { STATUS } from "@/lib/status";
import type { PromptScope, PromptSource, PromptStatus } from "@/types/core";
import type { LastResult, LibraryData, StoredPrompt } from "@/types/prompts";

import { GroupsDrawer } from "./groups-drawer";
import { LastResults, PromptKind } from "./parts";
import { planState, summarize, topicCounts } from "./prompt-ops";
import { useHydrated, usePromptActions, usePromptContext, usePromptGroups, useSavedTemplates } from "./use-prompts";

type LibRow = StoredPrompt & { lastResults?: LastResult[] };

const STATUS_ORDER: Record<PromptStatus, number> = { active: 0, draft: 1, paused: 2, archived: 3 };
const SCOPE_SHORT: Record<PromptScope, string> = { audit: "Audit", monitoring: "Monitoring", both: "Audit + Monitoring" };
const NO_GROUP = "none";
const CARD_PAGE = 24;
const STATUS_CELLS: PromptStatus[] = ["active", "draft", "paused"];

type Filters = { status: string; group: string; intent: string; scope: string; core: string; topic: string; source: string };
const NO_FILTERS: Filters = { status: "", group: "", intent: "", scope: "", core: "", topic: "", source: "" };

type Pending = { kind: "archive" | "move" | "copy"; ids: string[]; done?: () => void };

const asParam = (value: string | null, allowed: string[]): string => (value && allowed.includes(value) ? value : "");

export function PromptLibrary({ data }: { data: LibraryData }) {
  const toast = useToast();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const { storeId } = data;
  const { context, known } = usePromptContext(data.context);
  const store = context.store;
  const { rows, setStatus, moveToGroup, clearGroup, copyTo } = usePromptActions<LibRow>(storeId, data.prompts, { brand: store.brandName, actor: context.actor });
  const prompts = useMemo(() => rows.filter((p) => p.storeId === storeId), [rows, storeId]);
  const groupApi = usePromptGroups(storeId, data.context.groups);
  const groups = groupApi.groups;
  const templates = useSavedTemplates();

  const [filters, setFilters] = useState<Filters>(() => ({
    ...NO_FILTERS,
    status: asParam(params.get("status"), Object.keys(STATUS.prompt)),
    intent: asParam(params.get("intent"), Object.keys(INTENT_LABEL)),
    group: params.get("group") ?? "",
  }));
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "cards">(params.get("view") === "cards" ? "cards" : "table");
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [moveTo, setMoveTo] = useState(NO_GROUP);
  const [copyToId, setCopyToId] = useState("");
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [cardLimit, setCardLimit] = useState(CARD_PAGE);

  const base = `/stores/${storeId}/prompts`;
  const untracked = store.channelCount === 0;
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? null;
  const set = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setCardLimit(CARD_PAGE);
  };

  const summary = useMemo(() => summarize(prompts), [prompts]);
  const topics = useMemo(() => topicCounts(prompts), [prompts]);
  const plan = planState(summary.active);
  const groupCounts = useMemo(() => {
    const byGroup: Record<string, number> = {};
    for (const p of prompts) byGroup[p.groupId ?? NO_GROUP] = (byGroup[p.groupId ?? NO_GROUP] ?? 0) + 1;
    return byGroup;
  }, [prompts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (filters.status && p.status !== filters.status) return false;
      if (filters.group && (p.groupId ?? NO_GROUP) !== filters.group) return false;
      if (filters.intent && p.intent !== filters.intent) return false;
      if (filters.scope && p.scope !== filters.scope) return false;
      if (filters.core && (p.isCore ? "yes" : "no") !== filters.core) return false;
      if (filters.topic && p.topic !== filters.topic) return false;
      if (filters.source && p.source !== filters.source) return false;
      if (needle && !`${p.text} ${p.topic} ${INTENT_LABEL[p.intent]} ${groupName(p.groupId) ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    // groupName reads `groups`, which is a dependency through `groups`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts, filters, query, groups]);

  const filtering = Boolean(query.trim()) || Object.values(filters).some(Boolean);
  const advancedCount = (["intent", "scope", "core", "topic", "source"] as const).filter((k) => filters[k]).length + (filters.status === "archived" ? 1 : 0);
  const clearAll = () => {
    setQuery("");
    setFilters(NO_FILTERS);
  };

  const otherWebsites = context.otherWebsites;

  // -------------------------------------------------------------- actions
  const toastSimulated = (label: string, description?: string) => toast.push({ ...simulatedToast(label), description });

  const changeStatus = (ids: string[], status: PromptStatus, done?: () => void) => {
    const eligibleCount = ids.filter((id) => {
      const p = prompts.find((x) => x.id === id);
      return p && p.status !== status && (p.status !== "archived" || status === "draft");
    }).length;
    if (eligibleCount === 0) {
      toast.push({ title: "Nothing to change", description: `Selected prompts are already ${STATUS.prompt[status].label.toLowerCase()}, or archived.`, tone: "info" });
      return;
    }
    if (status === "active" && summary.active + eligibleCount > plan.limit) {
      toast.push({ title: "Plan limit reached", description: `Up to ${plan.limit} active prompts per website. Pause or archive some first.`, tone: "warning" });
      return;
    }
    const { changed, skipped } = setStatus(ids, status);
    const verb = { active: "activated", paused: "paused", draft: "restored as draft", archived: "archived" }[status];
    const first = prompts.find((p) => p.id === changed[0]);
    toastSimulated(changed.length === 1 ? `Prompt ${verb}` : `${pluralize(changed.length, "prompt")} ${verb}`, skipped ? `${skipped} skipped, no change needed.` : changed.length === 1 ? first?.text : undefined);
    done?.();
  };

  const confirmMove = () => {
    if (!pending) return;
    const target = moveTo === NO_GROUP ? null : moveTo;
    moveToGroup(pending.ids, target, target ? groupName(target) : null);
    toastSimulated(`${pluralize(pending.ids.length, "prompt")} moved`, target ? (groupName(target) ?? undefined) : "Now ungrouped");
    pending.done?.();
    setPending(null);
  };

  const confirmCopy = () => {
    if (!pending || !copyToId) return;
    const target = otherWebsites.find((w) => w.id === copyToId);
    if (!target) return;
    const { copied, skipped } = copyTo(pending.ids, target.id, target.texts, { market: "", language: "" });
    toastSimulated(copied === 0 ? "Nothing copied" : `${pluralize(copied, "prompt")} copied as drafts`, skipped ? `${skipped} already in ${target.name}.` : target.name);
    if (copied > 0) pending.done?.();
    setPending(null);
  };

  const saveAsTemplate = (row: LibRow) => {
    templates.add({ title: row.text.length > 40 ? `${row.text.slice(0, 39)}…` : row.text, text: row.text, intent: row.intent, topic: row.topic });
    toastSimulated("Template saved", "Find it under Copy from template.");
  };

  const openMove = (ids: string[], done?: () => void) => {
    setMoveTo(NO_GROUP);
    setPending({ kind: "move", ids, done });
  };
  const openCopy = (ids: string[], done?: () => void) => {
    setCopyToId(otherWebsites[0]?.id ?? "");
    setPending({ kind: "copy", ids, done });
  };

  const pendingRows = prompts.filter((p) => pending?.ids.includes(p.id));

  const rowMenu = (r: LibRow): MenuItem[] => [
    r.status === "active"
      ? { label: "Pause", icon: "pause", onSelect: () => changeStatus([r.id], "paused") }
      : r.status === "archived"
        ? { label: "Restore as draft", icon: "undo", onSelect: () => changeStatus([r.id], "draft") }
        : { label: "Activate", icon: "play", onSelect: () => changeStatus([r.id], "active") },
    { label: "Move to group", icon: "layers", onSelect: () => openMove([r.id]) },
    ...(otherWebsites.length > 0 ? ([{ label: "Copy to website", icon: "copy", onSelect: () => openCopy([r.id]) }] as MenuItem[]) : []),
    { label: "Save as template", icon: "file-text", onSelect: () => saveAsTemplate(r) },
    { type: "separator" },
    { label: "Archive", icon: "minus-circle", tone: "danger", disabled: r.status === "archived", disabledReason: "Already archived", onSelect: () => setPending({ kind: "archive", ids: [r.id] }) },
  ];

  const bulk = (selected: LibRow[], clear: () => void): ReactNode => (
    <>
      <Button size="sm" variant="secondary" icon="play" onClick={() => changeStatus(selected.map((r) => r.id), "active", clear)}>Activate</Button>
      <Button size="sm" variant="secondary" icon="pause" onClick={() => changeStatus(selected.map((r) => r.id), "paused", clear)}>Pause</Button>
      <Button size="sm" variant="secondary" icon="layers" onClick={() => openMove(selected.map((r) => r.id), clear)}>Move to group</Button>
      {otherWebsites.length > 0 ? (
        <Button size="sm" variant="secondary" icon="copy" onClick={() => openCopy(selected.map((r) => r.id), clear)}>Copy to website</Button>
      ) : null}
      <Button size="sm" variant="danger-ghost" icon="minus-circle" onClick={() => setPending({ kind: "archive", ids: selected.map((r) => r.id), done: clear })}>Archive</Button>
    </>
  );

  // -------------------------------------------------------------- states
  if (!known) {
    if (!hydrated) {
      return (
        <>
          <PageHeader title="Prompt Library" />
          <SkeletonTable rows={6} columns={5} />
        </>
      );
    }
    return (
      <>
        <PageHeader title="Prompt Library" />
        <EmptyState
          icon="globe"
          title="Website not found"
          description="This website is not in this browser's demo data."
          action={
            <ButtonLink href="/stores" variant="primary">
              Websites & Brands
            </ButtonLink>
          }
        />
      </>
    );
  }

  const newPromptHref = `${base}/new`;
  if (prompts.length === 0) {
    return (
      <>
        <PageHeader title="Prompt Library" />
        <EmptyState
          icon="prompts"
          title="No prompts yet"
          description="Prompts are the questions people ask AI."
          action={
            <ButtonLink href={newPromptHref} variant="primary" icon="plus">
              New prompt
            </ButtonLink>
          }
        />
      </>
    );
  }

  const inLatestRun = data.inLatestRun;
  const coverage = `${summary.active} of ${prompts.length} active${inLatestRun > 0 ? ` · ${inLatestRun} in latest run` : ""}`;

  const columns: Column<LibRow>[] = [
    {
      id: "text",
      header: "Prompt",
      sort: (r) => r.text.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0 max-w-md">
          <Link href={`${base}/${r.id}`} className="line-clamp-2 rounded font-medium text-fg hover:text-accent-text hover:underline">
            {r.text}
          </Link>
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-helper text-fg-muted">
            {r.isCore ? <Badge tone="accent" icon="flag">Core</Badge> : null}
            <span className="truncate">{[r.topic || null, groupName(r.groupId), r.mentionsBrand ? "Names brand" : "Neutral", SCOPE_SHORT[r.scope]].filter(Boolean).join(" · ")}</span>
          </p>
        </div>
      ),
    },
    { id: "status", header: "Status", sort: (r) => STATUS_ORDER[r.status], cell: (r) => <Status kind="prompt" value={r.status} /> },
    { id: "intent", header: "Intent", hideBelow: "md", sort: (r) => INTENT_LABEL[r.intent], cell: (r) => <span className="whitespace-nowrap text-fg-muted">{INTENT_LABEL[r.intent]}</span> },
    { id: "last", header: "Latest result", hideBelow: "lg", cell: (r) => <LastResults results={r.lastResults ?? []} reason={untracked ? "No provider" : "Not run yet"} /> },
    {
      id: "updated",
      header: "Updated",
      hideBelow: "xl",
      sort: (r) => Date.parse(r.updatedAt),
      cell: (r) => (
        <span className="tnum whitespace-nowrap text-fg-muted">
          v{r.version} · {r.origin === "local-demo" ? formatDate(r.updatedAt) : formatRelative(r.updatedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Row actions",
      srOnlyHeader: true,
      width: "w-10",
      align: "right",
      cell: (r) => <Menu trigger={<IconButton icon="more" label={`Actions for ${r.text}`} size="sm" />} items={rowMenu(r)} />,
    },
  ];

  const emptyFiltered = (
    <EmptyState icon="filter" title="No prompts match" description="Try another search or clear the filters." action={<Button size="sm" onClick={clearAll}>Clear filters</Button>} />
  );

  const shownCards = filtered.slice(0, cardLimit);
  const toggleCard = (id: string) => setSelectedCards((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const selectedCardRows = filtered.filter((p) => selectedCards.includes(p.id));

  return (
    <>
      <HeaderAction>
        <ButtonLink href={newPromptHref} variant="primary" icon="plus">
          New prompt
        </ButtonLink>
      </HeaderAction>
      <PageHeader title="Prompt Library" subtitle={coverage} />
    <div className="flex min-w-0 flex-col gap-4">

      <section aria-label="Library overview" className="grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-2 xl:grid-cols-4">
        {STATUS_CELLS.map((status) => {
          const pressed = filters.status === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={pressed}
              onClick={() => set("status", pressed ? "" : status)}
              className={cn(
                "flex min-w-0 cursor-pointer flex-col gap-1 bg-surface p-card text-left transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                pressed && "bg-accent-soft hover:bg-accent-soft",
              )}
            >
              <span className="flex items-center gap-1.5 text-label font-medium text-fg-muted">
                <Icon name={STATUS.prompt[status].icon} size={13} />
                {STATUS.prompt[status].label}
              </span>
              <span className="tnum text-section font-semibold text-fg">{summary[status]}</span>
            </button>
          );
        })}
        <div className="flex min-w-0 flex-col gap-1 bg-surface p-card">
          <span className="flex items-center gap-1.5 text-label font-medium text-fg-muted">
            Neutral coverage
            <Tooltip content="Neutral prompts do not name the brand. They test whether AI brings it up on its own.">
              <span className="flex cursor-help text-fg-subtle" tabIndex={0} aria-label="What is neutral coverage?">
                <Icon name="info" size={13} />
              </span>
            </Tooltip>
          </span>
          {summary.active === 0 ? (
            <span className="text-body-sm text-fg-muted">N/A, no active prompts</span>
          ) : (
            <>
              <span className="tnum text-section font-semibold text-fg">
                {summary.neutral} of {summary.active}
              </span>
              <span className={cn("tnum text-helper", summary.neutral === 0 ? "font-medium text-warning-text" : "text-fg-muted")}>
                {summary.neutral === 0 ? "Add neutral prompts" : `neutral · ${summary.core} core`}
                {store.channelCount > 0 ? ` · ${summary.active * store.channelCount} requests per sample` : ""}
              </span>
            </>
          )}
        </div>
      </section>

      {untracked ? (
        <Callout
          tone="warning"
          title="No AI provider selected"
          actions={
            <ButtonLink href={`/stores/${storeId}/settings`} variant="secondary" size="sm">
              Choose providers
            </ButtonLink>
          }
        >
          Prompts are saved. Results show N/A until a provider is selected.
        </Callout>
      ) : null}

      {plan.state !== "ok" ? (
        <Callout tone="warning" title={plan.state === "full" ? "Plan limit reached" : "Near the plan limit"}>
          <span className="tnum">{plan.active} of {plan.limit}</span> active prompts per website.
        </Callout>
      ) : null}

      <div className="flex min-w-0 flex-col gap-3">
        <div role="group" aria-label="Group" className="flex min-w-0 flex-wrap items-center gap-1.5">
          <GroupChip label="All" count={prompts.length} active={filters.group === ""} onClick={() => set("group", "")} />
          {groups.map((g) => (
            <GroupChip key={g.id} label={g.name} count={groupCounts[g.id] ?? 0} active={filters.group === g.id} onClick={() => set("group", filters.group === g.id ? "" : g.id)} />
          ))}
          {(groupCounts[NO_GROUP] ?? 0) > 0 ? <GroupChip label="Ungrouped" count={groupCounts[NO_GROUP]} active={filters.group === NO_GROUP} onClick={() => set("group", filters.group === NO_GROUP ? "" : NO_GROUP)} /> : null}
          <Button size="sm" variant="ghost" icon="layers" onClick={() => setGroupsOpen(true)}>
            Manage groups
          </Button>
        </div>

        <FilterBar
          label="Prompt filters"
          search={{ value: query, onChange: setQuery, placeholder: "Search prompts", label: "Search prompts" }}
          onClearAll={filtering ? clearAll : undefined}
          resultCount={{ shown: filtered.length, total: prompts.length, noun: "prompts" }}
          actions={
            <Segmented
              size="sm"
              label="View"
              value={view}
              onChange={(next) => {
                setView(next);
                setSelectedCards([]);
              }}
              options={[
                { value: "table", label: "Table" },
                { value: "cards", label: "Cards" },
              ]}
            />
          }
        >
          <Popover
            label="More filters"
            width={320}
            trigger={
              <Button icon="filter" variant="secondary">
                Filters{advancedCount > 0 ? ` (${advancedCount})` : ""}
              </Button>
            }
          >
            <div className="flex flex-col gap-3 p-3">
              <FilterSelect label="Status" value={filters.status} onChange={(v) => set("status", v)} options={(Object.keys(STATUS.prompt) as PromptStatus[]).map((v) => ({ value: v, label: STATUS.prompt[v].label }))} />
              <FilterSelect label="Intent" value={filters.intent} onChange={(v) => set("intent", v)} options={Object.entries(INTENT_LABEL).map(([value, label]) => ({ value, label }))} />
              <FilterSelect label="Scope" value={filters.scope} onChange={(v) => set("scope", v)} options={(Object.keys(SCOPE_LABEL) as PromptScope[]).map((value) => ({ value, label: SCOPE_LABEL[value] }))} />
              <FilterSelect label="Core set" value={filters.core} onChange={(v) => set("core", v)} options={[{ value: "yes", label: "Core" }, { value: "no", label: "Not core" }]} />
              <FilterSelect label="Topic" value={filters.topic} onChange={(v) => set("topic", v)} options={topics.map((t) => ({ value: t.topic, label: `${t.topic} (${t.count})` }))} />
              <FilterSelect label="Source" value={filters.source} onChange={(v) => set("source", v)} options={(Object.keys(SOURCE_LABEL) as PromptSource[]).map((value) => ({ value, label: SOURCE_LABEL[value] }))} />
            </div>
          </Popover>
        </FilterBar>

        {view === "table" ? (
          <DataTable
            label="Prompt library"
            data={filtered}
            columns={columns}
            rowKey={(r) => r.id}
            rowLabel={(r) => r.text}
            defaultSort={{ column: "status", dir: "asc" }}
            selectable
            bulkActions={bulk}
            mobileCards
            pageSize={25}
            empty={filtering ? emptyFiltered : undefined}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            {selectedCardRows.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-control border border-accent/30 bg-accent-soft px-3 py-2" role="region" aria-label="Bulk actions">
                <span className="tnum text-body-sm font-medium text-accent-text" aria-live="polite">{selectedCardRows.length} selected</span>
                <div className="flex flex-wrap items-center gap-2">{bulk(selectedCardRows, () => setSelectedCards([]))}</div>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedCards([])}>Deselect</Button>
              </div>
            ) : null}
            {filtered.length === 0 ? (
              <Card>{emptyFiltered}</Card>
            ) : (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Prompt cards">
                {shownCards.map((r) => (
                  <li key={r.id}>
                    <Card className="flex h-full flex-col gap-3 p-card">
                      <div className="flex items-start gap-2">
                        <Checkbox checked={selectedCards.includes(r.id)} onChange={() => toggleCard(r.id)} aria-label={`Select ${r.text}`} className="-m-2.5 p-2.5" />
                        <Link href={`${base}/${r.id}`} className="line-clamp-3 min-w-0 flex-1 rounded text-body font-medium text-fg hover:text-accent-text hover:underline">
                          {r.text}
                        </Link>
                        <Menu trigger={<IconButton icon="more" label={`Actions for ${r.text}`} size="sm" />} items={rowMenu(r)} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Status kind="prompt" value={r.status} />
                        {r.isCore ? <Badge tone="accent" icon="flag">Core</Badge> : null}
                        <PromptKind mentionsBrand={r.mentionsBrand} />
                      </div>
                      <p className="truncate text-helper text-fg-muted">{[INTENT_LABEL[r.intent], r.topic || null, groupName(r.groupId), SCOPE_SHORT[r.scope]].filter(Boolean).join(" · ")}</p>
                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-soft pt-3">
                        <LastResults results={r.lastResults ?? []} reason={untracked ? "No provider" : "Not run yet"} />
                        <span className="tnum shrink-0 text-helper text-fg-muted">v{r.version}</span>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
            {filtered.length > cardLimit ? (
              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => setCardLimit((n) => n + CARD_PAGE)}>
                  Show more ({filtered.length - cardLimit} left)
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <GroupsDrawer
        open={groupsOpen}
        onClose={() => setGroupsOpen(false)}
        groups={groups}
        counts={Object.fromEntries(Object.entries(groupCounts).filter(([id]) => id !== NO_GROUP))}
        ungrouped={groupCounts[NO_GROUP] ?? 0}
        onCreate={(name) => groupApi.create(name)}
        onRename={(id, name) => groupApi.rename(id, name)}
        onDelete={(id) => {
          clearGroup(id);
          groupApi.remove(id);
          if (filters.group === id) set("group", "");
        }}
      />

      <ConfirmDialog
        open={pending?.kind === "archive"}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          changeStatus(pending.ids, "archived", pending.done);
          setPending(null);
        }}
        title={pendingRows.length === 1 ? "Archive this prompt?" : `Archive ${pendingRows.length} prompts?`}
        confirmLabel="Archive"
      >
        {pendingRows.length === 1 ? <span className="[overflow-wrap:anywhere]">“{pendingRows[0].text}”. </span> : null}
        Archived prompts stop running. Past results and versions stay. You can restore them as drafts.
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

      <Dialog
        open={pending?.kind === "copy"}
        onClose={() => setPending(null)}
        title={`Copy ${pluralize(pendingRows.length, "prompt")}`}
        description="Copies are added to the other website as drafts."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="primary" disabled={!copyToId} onClick={confirmCopy}>Copy</Button>
          </>
        }
      >
        <Field label="Website">
          {({ id }) => (
            <Select id={id} value={copyToId} onChange={(event) => setCopyToId(event.target.value)}>
              {otherWebsites.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          )}
        </Field>
      </Dialog>
    </div>
    </>
  );
}

function GroupChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-body-sm transition-colors duration-[var(--dur-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:h-11",
        active ? "border-accent/40 bg-accent-soft font-medium text-accent-text" : "border-line bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <span className="max-w-40 truncate">{label}</span>
      <span className="tnum text-helper">{count}</span>
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (next: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Field label={label}>
      {({ id }) => (
        <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">All</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      )}
    </Field>
  );
}
