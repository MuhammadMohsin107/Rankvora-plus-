"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Status } from "@/components/ui/badge";
import { ButtonLink, Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SearchField, Segmented, Select } from "@/components/ui/form";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/overlay";
import { RateInline } from "@/components/ui/rate-inline";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatRelative, ratePercent } from "@/lib/format";
import { PLATFORM_LABEL } from "@/lib/labels";
import { STATUS } from "@/lib/status";
import type { Store, StoreStatus } from "@/types/core";

import { StoreCard } from "./store-card";
import { IntegrationPair } from "./integration-pair";
import { transitionCopy } from "./status-transitions";

type View = "table" | "cards";
type SortKey = "name" | "mention" | "next" | "status";
type PendingAction = { store: Store; to: StoreStatus };

const STATUS_ORDER = Object.keys(STATUS.store);

function sortStores(stores: Store[], key: SortKey): Store[] {
  const list = [...stores];
  if (key === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
  if (key === "status") return list.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  if (key === "next") return list.sort((a, b) => (a.summary?.nextRunAt ?? "9").localeCompare(b.summary?.nextRunAt ?? "9"));
  return list.sort((a, b) => (mentionPct(b) ?? -1) - (mentionPct(a) ?? -1));
}

function mentionPct(store: Store): number | null {
  return store.summary ? ratePercent(store.summary.mention.n, store.summary.mention.d) : null;
}

export function StoresView({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<View>("table");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [platform, setPlatform] = useState("");
  const [market, setMarket] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [overrides, setOverrides] = useState<Record<string, StoreStatus>>({});
  const [pending, setPending] = useState<PendingAction | null>(null);

  const current = useMemo(() => stores.map((store) => (overrides[store.id] ? { ...store, status: overrides[store.id] } : store)), [stores, overrides]);

  const statusOptions = useMemo(() => STATUS_ORDER.filter((value) => current.some((s) => s.status === value)), [current]);
  const platformOptions = useMemo(() => [...new Set(current.map((s) => s.platform))], [current]);
  const marketOptions = useMemo(() => [...new Map(current.map((s) => [s.market, s.marketName])).entries()], [current]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return current.filter((store) => {
      if (needle && !`${store.name} ${store.domain} ${store.brandName} ${store.marketName}`.toLowerCase().includes(needle)) return false;
      if (status && store.status !== status) return false;
      if (platform && store.platform !== platform) return false;
      if (market && store.market !== market) return false;
      return true;
    });
  }, [current, query, status, platform, market]);

  const filtering = Boolean(query.trim() || status || platform || market);
  const clearFilters = () => {
    setQuery("");
    setStatus("");
    setPlatform("");
    setMarket("");
  };

  const apply = (store: Store, to: StoreStatus) => {
    const copy = transitionCopy(store.status, to, store.name);
    setOverrides((currentOverrides) => ({ ...currentOverrides, [store.id]: to }));
    toast.push({ title: copy.toastTitle, description: "Demo action: nothing was changed on a server." });
  };

  const rowMenu = (store: Store): MenuItem[] => {
    const items: MenuItem[] = [
      { label: store.summary ? "Settings" : "Continue setup", icon: "settings", href: `/stores/${store.id}/settings` },
      { type: "separator" },
    ];
    if (store.status === "active") items.push({ label: "Pause", icon: "pause", onSelect: () => setPending({ store, to: "paused" }) });
    if (store.status === "paused") items.push({ label: "Resume", icon: "play", onSelect: () => apply(store, "active") });
    if (store.status === "archived") items.push({ label: "Restore", icon: "undo", onSelect: () => apply(store, "paused") });
    if (store.status !== "archived") items.push({ label: "Archive", icon: "minus-circle", tone: "danger", onSelect: () => setPending({ store, to: "archived" }) });
    return items;
  };

  const columns: Column<Store>[] = [
    {
      id: "store",
      header: "Store",
      sort: (s) => s.name.toLowerCase(),
      cell: (s) => (
        <div className="min-w-0">
          <Link href={`/stores/${s.id}`} onClick={(event) => event.stopPropagation()} className="rounded font-medium text-fg hover:underline">{s.name}</Link>
          <p className="truncate text-xs text-fg-subtle">{s.domain}</p>
        </div>
      ),
    },
    { id: "platform", header: "Platform", hideBelow: "md", sort: (s) => PLATFORM_LABEL[s.platform], cell: (s) => PLATFORM_LABEL[s.platform] },
    { id: "market", header: "Market", hideBelow: "lg", sort: (s) => s.marketName, cell: (s) => <span className="whitespace-nowrap">{s.market} · {s.marketName}</span> },
    { id: "status", header: "Status", sort: (s) => STATUS_ORDER.indexOf(s.status), cell: (s) => <Status kind="store" value={s.status} /> },
    {
      id: "mention",
      header: "Brand mention rate",
      sort: (s) => mentionPct(s),
      cell: (s) => (s.summary ? <RateInline n={s.summary.mention.n} d={s.summary.mention.d} /> : <span className="text-xs text-fg-subtle" title="No AI channel is connected, so nothing is tracked yet. This is not 0%.">N/A · no tracking data</span>),
    },
    { id: "integrations", header: "Integrations", hideBelow: "lg", cell: (s) => <IntegrationPair integrations={s.integrations} /> },
    {
      id: "next",
      header: "Next run",
      hideBelow: "xl",
      sort: (s) => s.summary?.nextRunAt ?? null,
      cell: (s) =>
        s.summary?.nextRunAt ? (
          <div className="tnum whitespace-nowrap leading-tight">
            <span className="text-[13px] text-fg">{formatDateTime(s.summary.nextRunAt, s.timezone)}</span>
            <span className="block text-xs text-fg-subtle">{formatRelative(s.summary.nextRunAt)}</span>
          </div>
        ) : (
          <span className="text-xs text-fg-subtle">Not scheduled</span>
        ),
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

  const emptyAll = (
    <EmptyState icon="store" title="No stores yet" action={<ButtonLink href="/stores/new" variant="primary" icon="plus">Add store</ButtonLink>} />
  );
  const emptyMatch = (
    <EmptyState icon="filter" title="No matching stores" />
  );

  if (stores.length === 0) return emptyAll;

  const pendingCopy = pending ? transitionCopy(pending.store.status, pending.to, pending.store.name) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Search stores" placeholder="Search stores" value={query} onChange={setQuery} className="w-full sm:w-64" />
        <div className="w-[calc(50%-0.25rem)] sm:w-40">
          <Select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Status: all</option>
            {statusOptions.map((value) => (
              <option key={value} value={value}>{STATUS.store[value as StoreStatus].label}</option>
            ))}
          </Select>
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-40">
          <Select aria-label="Platform" value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="">Platform: all</option>
            {platformOptions.map((value) => (
              <option key={value} value={value}>{PLATFORM_LABEL[value]}</option>
            ))}
          </Select>
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-40">
          <Select aria-label="Market" value={market} onChange={(event) => setMarket(event.target.value)}>
            <option value="">Market: all</option>
            {marketOptions.map(([code, name]) => (
              <option key={code} value={code}>{code} · {name}</option>
            ))}
          </Select>
        </div>
        {view === "cards" ? (
          <div className="w-[calc(50%-0.25rem)] sm:w-40">
            <Select aria-label="Sort by" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              <option value="name">Sort: name</option>
              <option value="mention">Sort: mention rate</option>
              <option value="next">Sort: next run</option>
              <option value="status">Sort: status</option>
            </Select>
          </div>
        ) : null}
        {filtering ? <Button variant="ghost" size="sm" icon="x" onClick={clearFilters}>Clear</Button> : null}
        <Segmented
          className="ml-auto"
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "Table", icon: "list" },
            { value: "cards", label: "Cards", icon: "grid" },
          ]}
        />
      </div>

      {view === "table" ? (
        <DataTable<Store>
          label="Stores"
          data={filtered}
          columns={columns}
          rowKey={(s) => s.id}
          defaultSort={{ column: "store", dir: "asc" }}
          onRowClick={(s) => router.push(`/stores/${s.id}`)}
          empty={filtering ? emptyMatch : emptyAll}
        />
      ) : filtered.length === 0 ? (
        emptyMatch
      ) : (
        <>
          <p className="-mb-1 text-xs text-fg-subtle">Changes compare with the previous run</p>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortStores(filtered, sortKey).map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        </>
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
