"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageFallback } from "@/components/shell/page-fallback";
import { PageHeader } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Callout, KeyValue, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { useDemoCollection } from "@/demo-state";
import { siteTypeLabel } from "@/lib/labels";
import type { AiChannel, Store } from "@/types/core";
import type { NotificationEvent, NotificationPrefs } from "@/types/settings";

import { WebsiteSettings, type WebsiteSettingsData } from "./settings/website-settings";
import { nextWebsiteAction } from "./website-model";

/** Generic lists the server hands over once, so a created website can open its settings without a server round trip. */
export type LocalWebsiteBundle = { channels: AiChannel[]; events: NotificationEvent[]; orgPrefs: NotificationPrefs };

const NO_ROWS: Store[] = [];

const SECTIONS: Record<string, { title: string; icon: "prompts" | "audit" | "fixes" | "monitoring" | "compare" | "reports"; text: string; action?: { label: string; path: string } }> = {
  prompts: { title: "Prompt Library", icon: "prompts", text: "No prompts yet." },
  audits: { title: "Audit", icon: "audit", text: "No audits yet. Choose an AI channel first.", action: { label: "Open website settings", path: "/settings" } },
  fixes: { title: "Fixes", icon: "fixes", text: "No findings yet. Findings come from audits." },
  monitoring: { title: "Monitoring", icon: "monitoring", text: "No schedules or runs yet." },
  comparisons: { title: "Comparison", icon: "compare", text: "Nothing to compare yet. Comparisons need at least one run." },
  reports: { title: "Reports", icon: "reports", text: "No reports yet." },
};

function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Client view for a website id the server does not know. Ids made by the Add website wizard (`demo-websites-n`)
 * live in demo-state, so the dashboard and settings are drawn here from that row. Prompts render their own client
 * view (`children`); other sections show an honest empty state. An id that is not in demo-state shows "not found".
 */
export function LocalWebsiteGate({ storeId, bundle, children }: { storeId: string; bundle: LocalWebsiteBundle; children: ReactNode }) {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const { rows } = useDemoCollection<Store>("websites", NO_ROWS);
  const store = rows.find((w) => w.id === storeId) ?? null;

  const settingsData = useMemo<WebsiteSettingsData | null>(() => {
    if (!store) return null;
    return {
      store,
      seeded: false,
      channels: bundle.channels,
      competitors: [],
      products: [],
      prompts: [],
      brandVersions: [],
      knowledge: { facts: [], faqs: [], contentContext: "", sourcePages: [], crawlers: [], auditId: null, scannedAt: null },
      domains: { storeId, canonical: store.domain, aliases: [], former: [] },
      integrations: {
        storeId,
        commerce: { platform: store.platform, state: store.integrations.commerce, account: null, scopes: [], lastVerifiedAt: null, note: null },
        searchConsole: { state: store.integrations.searchConsole, property: null, lastVerifiedAt: null, note: null },
      },
      activity: [],
      events: bundle.events,
      orgPrefs: bundle.orgPrefs,
      notifications: { storeId, mode: "inherit", matrix: bundle.orgPrefs.matrix },
    };
  }, [store, storeId, bundle]);

  if (!hydrated) return <PageFallback />;
  if (!store || !settingsData) {
    return (
      <>
        <PageHeader title="Website not found" />
        <EmptyState icon="globe" title="This website is not in this browser" description="Websites you add are stored in this browser only." action={<ButtonLink href="/stores" variant="primary">Open Websites & Brands</ButtonLink>} />
      </>
    );
  }

  const base = `/stores/${storeId}`;
  const section = pathname === base ? "dashboard" : (pathname.slice(base.length + 1).split("/")[0] ?? "");
  if (section === "dashboard") return <UntrackedDashboard store={store} />;
  if (section === "settings") return <WebsiteSettings data={settingsData} />;
  if (section === "prompts") return <>{children}</>;
  const known = SECTIONS[section];
  return (
    <>
      <PageHeader title={known?.title ?? "Website"} subtitle={store.name} />
      <EmptyState
        icon={known?.icon ?? "globe"}
        title={known?.text ?? "Nothing here yet."}
        action={<ButtonLink href={known?.action ? `${base}${known.action.path}` : base} variant="secondary">{known?.action?.label ?? "Open dashboard"}</ButtonLink>}
      />
    </>
  );
}

/**
 * Dashboard of a website with no tracking data (created in this browser, or seeded without runs): N/A metrics
 * (never 0) and ONE next step. Local changes to the website (status, channels) show here at once.
 */
export function UntrackedDashboard({ store: seeded }: { store: Store }) {
  const base = useMemo(() => [seeded], [seeded]);
  const { rows } = useDemoCollection<Store>("websites", base);
  const store = rows.find((w) => w.id === seeded.id) ?? seeded;
  const action = nextWebsiteAction(store);
  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${store.domain} · ${store.marketName} · ${store.language.toUpperCase()}`} meta={<Status kind="store" value={store.status} />} />
      <HeaderAction>
        <ButtonLink href={action.href} variant="primary" size="sm" trailingIcon="arrow-right">{action.label}</ButtonLink>
      </HeaderAction>
      <div className="flex flex-col gap-3">
        <Callout tone="info" title="No tracking data yet">{action.reason}. Rates stay N/A until the first run.</Callout>
        <MetricGrid className="xl:grid-cols-3">
          <MetricCell><Metric label="Brand mention rate" naReason="No runs yet" /></MetricCell>
          <MetricCell><Metric label="Recommendation rate" naReason="No runs yet" /></MetricCell>
          <MetricCell><Metric label="Owned citation rate" naReason="No runs yet" /></MetricCell>
        </MetricGrid>
        <KeyValue
          columns={3}
          items={[
            { label: "Site type", value: siteTypeLabel(store.platform) },
            { label: "Brand", value: store.brandName },
            { label: "AI channels", value: store.channelIds.length ? String(store.channelIds.length) : "None yet" },
          ]}
        />
        <p className="text-helper text-fg-muted">
          {store.simulated ? "Created in this browser (simulated). " : null}<Link href={`/stores/${store.id}/settings`} className="rounded font-medium text-accent-text hover:underline">Website settings</Link>
        </p>
      </div>
    </>
  );
}
