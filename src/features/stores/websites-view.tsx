"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { buildWebsiteLookup, rowWebsite } from "@/components/shell/row-website";
import { WebsiteAvatar } from "@/components/ui/avatar";
import { Status } from "@/components/ui/badge";
import { ButtonLink, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar } from "@/components/ui/filter-bar";
import { Segmented } from "@/components/ui/form";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/overlay";
import { RateInline } from "@/components/ui/rate-inline";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { isAlertUnread, simulatedToast, useDemoAlerts, useDemoCollection, useDemoEvents } from "@/demo-state";
import { SITE_TYPE_ORDER, siteTypeLabel } from "@/lib/labels";
import { OPEN_TASK_STATUSES } from "@/lib/record-status";
import { STATUS } from "@/lib/status";
import { ratePercent } from "@/lib/format";
import type { PortfolioTask } from "@/services/dashboard";
import type { AlertHeadline, Store, StoreStatus } from "@/types/core";

import { transitionCopy } from "./status-transitions";
import { WebsiteCard } from "./website-card";
import { nextWebsiteAction, untrackedReason } from "./website-model";

type View = "table" | "cards";
type PendingAction = { store: Store; to: StoreStatus };

const STATUS_ORDER = Object.keys(STATUS.store);
const mentionPct = (store: Store) => (store.summary ? ratePercent(store.summary.mention.n, store.summary.mention.d) : null);

export function WebsitesView({ stores, alerts, tasks }: { stores: Store[]; alerts: AlertHeadline[]; tasks: PortfolioTask[] }) {
  const router = useRouter();
  const toast = useToast();
  const { rows: websites, update } = useDemoCollection<Store>("websites", stores);
  const { rows: alertRows } = useDemoAlerts(alerts);
  const { rows: taskRows } = useDemoCollection<PortfolioTask>("tasks", tasks);
  const events = useDemoEvents();

  const [view, setView] = useState<View>("table");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [siteType, setSiteType] = useState("");
  const [market, setMarket] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);

  const counts = useMemo(() => {
    const out = new Map<string, { unreadAlerts: number; pendingTasks: number }>();
    const entry = (id: string) => out.get(id) ?? out.set(id, { unreadAlerts: 0, pendingTasks: 0 }).get(id)!;
    for (const a of alertRows) if (isAlertUnread(a)) entry(a.storeId).unreadAlerts += 1;
    const lookup = buildWebsiteLookup(events);
    for (const t of taskRows) {
      const id = rowWebsite(t, lookup);
      if (id && OPEN_TASK_STATUSES.has(t.status)) entry(id).pendingTasks += 1;
    }
    return out;
  }, [alertRows, taskRows, events]);

  const statusOptions = STATUS_ORDER.filter((value) => websites.some((s) => s.status === value)).map((value) => ({ value, label: STATUS.store[value as StoreStatus].label }));
  const typeOptions = SITE_TYPE_ORDER.filter((value) => websites.some((s) => s.platform === value)).map((value) => ({ value, label: siteTypeLabel(value) }));
  const marketOptions = [...new Map(websites.map((s) => [s.market, s.marketName])).entries()].map(([value, label]) => ({ value, label: `${value} · ${label}` }));

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return websites.filter((site) => {
      if (needle && !`${site.name} ${site.domain} ${site.brandName} ${site.marketName}`.toLowerCase().includes(needle)) return false;
      if (status && site.status !== status) return false;
      if (siteType && site.platform !== siteType) return false;
      if (market && site.market !== market) return false;
      return true;
    });
  }, [websites, query, status, siteType, market]);

  const clearFilters = () => {
    setQuery("");
    setStatus("");
    setSiteType("");
    setMarket("");
  };

  const apply = (site: Store, to: StoreStatus) => {
    const copy = transitionCopy(site.status, to, site.name);
    update(site.id, { status: to }, { kind: "website.updated", label: copy.toastTitle, refs: { websiteId: site.id } });
    toast.push(simulatedToast(copy.toastTitle));
  };

  const rowMenu = (site: Store): MenuItem[] => {
    const items: MenuItem[] = [
      { label: "Dashboard", icon: "dashboard", href: `/stores/${site.id}` },
      { label: site.summary ? "Website settings" : "Continue setup", icon: "settings", href: `/stores/${site.id}/settings` },
      { type: "separator" },
    ];
    if (site.status === "active") items.push({ label: "Pause", icon: "pause", onSelect: () => setPending({ store: site, to: "paused" }) });
    if (site.status === "paused") items.push({ label: "Resume", icon: "play", onSelect: () => apply(site, "active") });
    if (site.status === "ready") items.push({ label: "Activate", icon: "play", onSelect: () => apply(site, "active") });
    if (site.status === "archived") items.push({ label: "Restore", icon: "undo", onSelect: () => apply(site, "paused") });
    if (site.status !== "archived") items.push({ label: "Archive", icon: "minus-circle", tone: "danger", onSelect: () => setPending({ store: site, to: "archived" }) });
    return items;
  };

  const columns: Column<Store>[] = [
    {
      id: "website",
      header: "Website",
      sort: (s) => s.name.toLowerCase(),
      cell: (s) => (
        <div className="flex min-w-0 items-center gap-3">
          <WebsiteAvatar name={s.name} />
          <div className="min-w-0">
            <Link href={`/stores/${s.id}`} onClick={(event) => event.stopPropagation()} className="block truncate rounded font-medium text-fg hover:underline">{s.name}</Link>
            <p className="truncate text-helper text-fg-muted">{s.domain}</p>
          </div>
        </div>
      ),
    },
    { id: "type", header: "Site type", hideBelow: "md", sort: (s) => siteTypeLabel(s.platform), cell: (s) => siteTypeLabel(s.platform) },
    { id: "market", header: "Market", hideBelow: "lg", sort: (s) => s.marketName, cell: (s) => <span className="whitespace-nowrap">{s.marketName} · {s.language.toUpperCase()}</span> },
    { id: "status", header: "Status", sort: (s) => STATUS_ORDER.indexOf(s.status), cell: (s) => <Status kind="store" value={s.status} /> },
    {
      id: "mention",
      header: "Mention rate",
      sort: (s) => mentionPct(s),
      cell: (s) => (s.summary ? <RateInline n={s.summary.mention.n} d={s.summary.mention.d} /> : <span className="text-helper text-fg-muted" title="Nothing is tracked yet. This is not 0%.">N/A · {untrackedReason(s)}</span>),
    },
    {
      id: "next",
      header: "Next step",
      hideBelow: "xl",
      cell: (s) => {
        const action = nextWebsiteAction(s, counts.get(s.id));
        return <Link href={action.href} onClick={(event) => event.stopPropagation()} className="whitespace-nowrap rounded text-body-sm font-medium text-accent-text hover:underline">{action.label}</Link>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (s) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <Menu trigger={<IconButton icon="more" label={`Actions for ${s.name}`} size="sm" />} items={rowMenu(s)} width={200} />
        </div>
      ),
    },
  ];

  const addButton = <ButtonLink href="/stores/new" variant="primary" icon="plus" size="sm">Add website</ButtonLink>;
  const emptyAll = <EmptyState icon="globe" title="No websites yet" action={<ButtonLink href="/stores/new" variant="primary" icon="plus">Add website</ButtonLink>} />;
  const emptyMatch = <EmptyState icon="filter" title="No matching websites" description="Try a different search or clear the filters." action={<button type="button" onClick={clearFilters} className="cursor-pointer rounded text-body-sm font-medium text-accent-text hover:underline">Clear filters</button>} />;

  if (websites.length === 0) return emptyAll;

  const pendingCopy = pending ? transitionCopy(pending.store.status, pending.to, pending.store.name) : null;

  return (
    <div className="flex flex-col gap-4">
      <HeaderAction>{addButton}</HeaderAction>
      <FilterBar
        label="Website filters"
        search={{ value: query, onChange: setQuery, placeholder: "Search websites", label: "Search websites" }}
        filters={[
          { id: "status", label: "Status", value: status, onChange: setStatus, options: statusOptions },
          { id: "type", label: "Site type", value: siteType, onChange: setSiteType, options: typeOptions },
          { id: "market", label: "Market", value: market, onChange: setMarket, options: marketOptions },
        ]}
        onClearAll={clearFilters}
        resultCount={{ shown: filtered.length, total: websites.length, noun: "websites" }}
        actions={
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "table", label: "Table", icon: "list" },
              { value: "cards", label: "Cards", icon: "grid" },
            ]}
          />
        }
      />

      {view === "table" ? (
        <DataTable<Store>
          label="Websites"
          data={filtered}
          columns={columns}
          rowKey={(s) => s.id}
          rowLabel={(s) => s.name}
          defaultSort={{ column: "website", dir: "asc" }}
          onRowClick={(s) => router.push(`/stores/${s.id}`)}
          empty={emptyMatch}
          mobileCards
        />
      ) : filtered.length === 0 ? (
        emptyMatch
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((site) => (
            <WebsiteCard key={site.id} store={site} counts={counts.get(site.id)} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) apply(pending.store, pending.to);
          setPending(null);
        }}
        title={pendingCopy?.confirmTitle ?? ""}
        confirmLabel={pendingCopy?.confirmLabel ?? "Confirm"}
        tone={pendingCopy?.tone ?? "danger"}
      >
        {pendingCopy?.effect}
      </ConfirmDialog>
    </div>
  );
}
