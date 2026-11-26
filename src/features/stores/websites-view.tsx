"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { buildWebsiteLookup, rowWebsite } from "@/components/shell/row-website";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { FilterBar } from "@/components/ui/filter-bar";
import { isAlertUnread, useDemoAlerts, useDemoCollection, useDemoEvents } from "@/demo-state";
import { SITE_TYPE_ORDER, siteTypeLabel } from "@/lib/labels";
import { OPEN_TASK_STATUSES } from "@/lib/record-status";
import { STATUS } from "@/lib/status";
import type { WebsiteTask } from "@/services/dashboard";
import type { AlertHeadline, Store, StoreStatus } from "@/types/core";

import { DeleteWebsiteDialog, useDeleteWebsite } from "./delete-website";
import { WebsiteCard } from "./website-card";

const STATUS_ORDER = Object.keys(STATUS.store);

export function WebsitesView({ stores, alerts, tasks }: { stores: Store[]; alerts: AlertHeadline[]; tasks: WebsiteTask[] }) {
  const { rows: websites } = useDemoCollection<Store>("websites", stores);
  const { rows: alertRows } = useDemoAlerts(alerts);
  const { rows: taskRows } = useDemoCollection<WebsiteTask>("tasks", tasks);
  const events = useDemoEvents();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [siteType, setSiteType] = useState("");
  const [market, setMarket] = useState("");
  const [deleting, setDeleting] = useState<Store | null>(null);
  const deleteWebsite = useDeleteWebsite();

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

  const emptyAll = <EmptyState icon="globe" title="No websites yet" action={<ButtonLink href="/stores/new" variant="primary" icon="plus">Add website</ButtonLink>} />;
  const emptyMatch = <EmptyState icon="filter" title="No matching websites" action={<button type="button" onClick={clearFilters} className="cursor-pointer rounded text-body-sm font-medium text-accent-text hover:underline">Reset filters</button>} />;

  if (websites.length === 0) return emptyAll;

  return (
    <div className="flex flex-col gap-3">
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
      />

      {filtered.length === 0 ? (
        emptyMatch
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((site) => (
            <WebsiteCard key={site.id} store={site} counts={counts.get(site.id)} onDelete={site.status === "archived" ? () => setDeleting(site) : undefined} />
          ))}
          <Link
            href="/stores/new"
            className="group flex min-h-36 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-strong bg-surface/50 p-4 text-fg-muted transition-colors duration-[var(--dur-fast)] hover:border-accent hover:bg-accent-soft hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface text-fg-muted group-hover:border-accent group-hover:text-accent-text">
              <Icon name="plus" size={22} />
            </span>
            <span className="text-card-title font-semibold">Add website</span>
          </Link>
        </div>
      )}
      <DeleteWebsiteDialog
        key={deleting?.id ?? "none"}
        website={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteWebsite(deleting);
          setDeleting(null);
        }}
      />
    </div>
  );
}
