"use client";

import Link from "next/link";
import { useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { WebsiteAvatar } from "@/components/ui/avatar";
import { Badge, Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { FilterBar } from "@/components/ui/filter-bar";
import { canAddWebsite, useWorkspace } from "@/features/session/session";
import { siteTypeLabel } from "@/lib/labels";
import { countryName } from "@/lib/locale-options";
import { STATUS } from "@/lib/status";

import { VerificationBadge } from "./verification-badge";
import { useWebsites, type Website } from "./websites-data";

function WebsiteCard({ site }: { site: Website }) {
  return (
    <Card as="article" className="relative flex h-full flex-col gap-3 p-4 transition-shadow duration-[var(--dur-fast)] hover:shadow-pop has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <WebsiteAvatar name={site.name} size="md" />
          <div className="min-w-0">
            <h2 className="truncate text-card-title font-semibold text-fg" title={site.name}>
              <Link href={`/stores/${site.id}`} className="rounded after:absolute after:inset-0 after:rounded-card after:content-[''] hover:underline">{site.name}</Link>
            </h2>
            <p className="truncate text-helper text-fg-muted" title={site.domain?.host}>{site.domain?.host ?? "No domain"}</p>
          </div>
        </div>
        <Status kind="store" value={site.status} />
      </div>
      <p className="text-helper text-fg-muted">
        {countryName(site.market)} · {site.language.toUpperCase()} · {siteTypeLabel(site.siteType)}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
        {site.domain ? <VerificationBadge status={site.domain.verificationStatus} /> : <Badge tone="neutral">No domain</Badge>}
      </div>
    </Card>
  );
}

export function WebsitesScreen() {
  const { organization } = useWorkspace();
  const { status, websites, error, reload } = useWebsites();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const mayAdd = canAddWebsite(organization.role);
  const add = mayAdd ? <ButtonLink href="/stores/new" variant="primary" icon="plus">Add website</ButtonLink> : null;

  const needle = query.trim().toLowerCase();
  const visible = websites.filter(
    (site) => (!needle || `${site.name} ${site.domain?.host ?? ""}`.toLowerCase().includes(needle)) && (!state || site.status === state),
  );
  const statusOptions = [...new Set(websites.map((site) => site.status))].map((value) => ({ value, label: STATUS.store[value].label }));

  return (
    <>
      <PageHeader title="Websites & Brands" />
      {status === "ready" && websites.length > 0 && add ? <HeaderAction>{add}</HeaderAction> : null}
      {status === "loading" ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : status === "error" ? (
        <ErrorState detail={error ?? undefined} action={<Button onClick={() => void reload()}>Try again</Button>} />
      ) : websites.length === 0 ? (
        <EmptyState icon="globe" title="No websites yet" description={mayAdd ? undefined : "An owner or admin can add one."} action={add} />
      ) : (
        <div className="flex flex-col gap-3">
          <FilterBar
            label="Website filters"
            search={{ value: query, onChange: setQuery, placeholder: "Search websites", label: "Search websites" }}
            filters={[{ id: "status", label: "Status", value: state, onChange: setState, options: statusOptions }]}
            onClearAll={() => {
              setQuery("");
              setState("");
            }}
            resultCount={{ shown: visible.length, total: websites.length, noun: "websites" }}
          />
          {visible.length === 0 ? (
            <EmptyState icon="filter" title="No matching websites" />
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visible.map((site) => (
                <WebsiteCard key={site.id} site={site} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
