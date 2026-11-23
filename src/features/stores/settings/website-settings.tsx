"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { demoNow, simulatedToast, useDemoCollection, useDemoSettings } from "@/demo-state";
import { usePrompts } from "@/features/prompts/use-prompts";
import type { AiChannel, Competitor, ProductService, PromptBase, Store, StoreStatus } from "@/types/core";
import type { ActivityEntry, ActivityKind, BrandKnowledgeBase, BrandKnowledgeState, BrandVersion, DomainRecord, IntegrationDetail, NotificationEvent, NotificationPrefs, StoreNotificationOverride } from "@/types/settings";

import { COUNTRIES } from "../options";
import { transitionCopy } from "../status-transitions";
import type { TrackingMode } from "../wizard/model";
import { ActivityTab } from "./activity-tab";
import { BrandTab, draftFromVersion, type BrandDraft } from "./brand-tab";
import { CompetitorsTab } from "./competitors-tab";
import { DangerTab } from "./danger-tab";
import { DomainsTab } from "./domains-tab";
import { IntegrationsTab } from "./integrations-tab";
import { KnowledgeTab } from "./knowledge-tab";
import { settingKey } from "./keys";
import { NotificationsTab, type StoreNotifState } from "./notifications-tab";
import { ProductsTab } from "./products-tab";
import { ProfileTab, type ProfileValues } from "./profile-tab";
import { nextId, type TabId } from "./util";

export type WebsiteSettingsData = {
  store: Store;
  /** False for a website created in this browser (its settings were saved by the Add website wizard). */
  seeded: boolean;
  channels: AiChannel[];
  competitors: Competitor[];
  products: ProductService[];
  prompts: PromptBase[];
  brandVersions: BrandVersion[];
  knowledge: BrandKnowledgeBase;
  domains: DomainRecord;
  integrations: IntegrationDetail;
  activity: ActivityEntry[];
  events: NotificationEvent[];
  orgPrefs: NotificationPrefs;
  notifications: StoreNotificationOverride;
};

type SetupItem = { id: string; label: string; action: string; done: boolean; optional?: boolean; tab?: TabId; href?: string };
type Overrides = Record<string, StoreNotificationOverride>;

const NO_ROWS: Store[] = [];

export function WebsiteSettings({ data }: { data: WebsiteSettingsData }) {
  const id = data.store.id;
  const toast = useToast();

  // Website row (name, status, site type, channels ...): seeded websites are patched, created ones live in demo-state.
  const baseRows = useMemo(() => (data.seeded ? [data.store] : NO_ROWS), [data.seeded, data.store]);
  const { rows, update } = useDemoCollection<Store>("websites", baseRows);
  const store = rows.find((w) => w.id === id) ?? data.store;
  const status = store.status;

  // One saved document per tab.
  const brandBase = useMemo(() => ({ versions: data.brandVersions }), [data.brandVersions]);
  const brand = useDemoSettings(settingKey(id, "brand"), brandBase);
  const knowledgeBase = useMemo<BrandKnowledgeState>(() => ({ facts: data.knowledge.facts, faqs: data.knowledge.faqs, contentContext: data.knowledge.contentContext, sourcePages: data.knowledge.sourcePages, scannedAt: data.knowledge.scannedAt }), [data.knowledge]);
  const knowledge = useDemoSettings(settingKey(id, "knowledge"), knowledgeBase);
  const competitorsBase = useMemo(() => ({ list: data.competitors }), [data.competitors]);
  const competitors = useDemoSettings(settingKey(id, "competitors"), competitorsBase);
  const productsBase = useMemo(() => ({ list: data.products }), [data.products]);
  const products = useDemoSettings(settingKey(id, "products"), productsBase);
  const integrations = useDemoSettings(settingKey(id, "integrations"), data.integrations);
  const domains = useDemoSettings(settingKey(id, "domains"), data.domains);
  const activityBase = useMemo(() => ({ entries: data.activity }), [data.activity]);
  const activity = useDemoSettings(settingKey(id, "activity"), activityBase);
  const trackingBase = useMemo(() => ({ trackingMode: "web_grounded" as TrackingMode }), []);
  const tracking = useDemoSettings(settingKey(id, "tracking"), trackingBase);
  const orgPrefs = useDemoSettings<NotificationPrefs>("org.notifications", data.orgPrefs);
  const overridesBase = useMemo<Overrides>(() => ({ [id]: data.notifications }), [id, data.notifications]);
  const overrides = useDemoSettings<Overrides>("org.notifications.overrides", overridesBase);
  const { prompts } = usePrompts(id, data.prompts);

  // Drafts: null means "untouched", so edits are never overwritten when saved data arrives after hydration.
  const savedProfile: ProfileValues = { name: store.name, platform: store.platform, market: store.market, language: store.language, timezone: store.timezone };
  const [profileDraft, setProfileDraft] = useState<ProfileValues | null>(null);
  const profile = profileDraft ?? savedProfile;
  const [channelDraft, setChannelDraft] = useState<string[] | null>(null);
  const channelIds = channelDraft ?? store.channelIds;
  const [modeDraft, setModeDraft] = useState<TrackingMode | null>(null);
  const trackingMode = modeDraft ?? tracking.value.trackingMode;
  const versions = brand.value.versions;
  const [brandDraft, setBrandDraft] = useState<BrandDraft | null>(null);
  const brandForm = brandDraft ?? draftFromVersion(versions[0], store.industry);
  const savedNotif: StoreNotifState = overrides.value[id] ?? data.notifications;
  const [notifDraft, setNotifDraft] = useState<StoreNotifState | null>(null);
  const notif = notifDraft ?? savedNotif;

  const [pending, setPending] = useState<StoreStatus | null>(null);
  const [jump, setJump] = useState<{ id: TabId; n: number }>({ id: "profile", n: 0 });
  const readOnly = status === "archived";
  const goTab = (tab: TabId) => setJump((current) => ({ id: tab, n: current.n + 1 }));

  /** Adds a line to this website's Activity tab and the unified timeline (one event). */
  const log = (title: string, kind: ActivityKind, detail?: string) => {
    const entry: ActivityEntry = { id: nextId("local-act", activity.value.entries.map((a) => a.id)), storeId: id, at: demoNow(), actor: "You", title, detail, kind };
    activity.save({ entries: [entry, ...activity.value.entries] }, { kind: "website.updated", label: title, refs: { websiteId: id } });
  };
  const said = (title: string) => toast.push(simulatedToast(title));

  const applyStatus = (to: StoreStatus) => {
    const copy = transitionCopy(status, to, store.name);
    update(id, { status: to });
    log(`Status changed: ${status.replace("_", " ")} to ${to.replace("_", " ")}`, "store");
    said(copy.toastTitle);
  };

  const consoleState = integrations.value.searchConsole.state;
  const activePrompts = prompts.filter((p) => p.status === "active").length;
  const setupItems: SetupItem[] = [
    { id: "brand", label: "Brand description", action: "Add brand description", done: (versions[0]?.description ?? "").trim().length > 0, tab: "brand" },
    { id: "channels", label: "AI channels", action: "Choose AI channels", done: store.channelIds.length > 0, tab: "profile" },
    { id: "prompts", label: "Prompts", action: "Add prompts", done: activePrompts > 0, href: `/stores/${id}/prompts/new` },
    { id: "competitors", label: "Confirmed competitors", action: "Confirm a competitor", done: competitors.value.list.some((c) => c.status === "confirmed"), optional: true, tab: "competitors" },
    { id: "products", label: "Products and services", action: "Add an offering", done: products.value.list.length > 0, optional: true, tab: "products" },
    { id: "console", label: "Search Console", action: "Connect Search Console", done: consoleState === "connected", optional: true, tab: "integrations" },
  ];
  const doneCount = setupItems.filter((item) => item.done).length;
  const nextItem = setupItems.find((item) => !item.done && !item.optional);
  const commerceState = integrations.value.commerce.state;
  const reactivateBlocked = status === "disconnected" && commerceState !== "connected" && commerceState !== "manual" ? "Reconnect the connector first." : undefined;
  const showSetup = status === "draft" || status === "needs_review" || status === "ready";
  const pendingCopy = pending ? transitionCopy(status, pending, store.name) : null;

  const webhookReady = orgPrefs.value.webhookUrl.trim() !== "";

  const brandTab = (
    <BrandTab
      versions={versions}
      draft={brandForm}
      onDraft={setBrandDraft}
      readOnly={readOnly}
      timezone={store.timezone}
      fallbackCategory={store.industry}
      onSaveVersion={(note) => {
        const version = (versions[0]?.version ?? 0) + 1;
        const next: BrandVersion = { version, createdAt: demoNow(), createdBy: "You", note, brandName: brandForm.brandName.trim(), category: brandForm.category, aliases: brandForm.aliases, differentiators: brandForm.differentiators, description: brandForm.description.trim() };
        brand.save({ versions: [next, ...versions] });
        update(id, { brandName: next.brandName, ...(next.category ? { industry: next.category } : {}) });
        setBrandDraft(null);
        log(`Brand profile saved as v${version}`, "brand", note);
        said(`Brand profile saved as v${version}`);
      }}
    />
  );

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      content: (
        <ProfileTab
          domain={domains.value.canonical}
          readOnly={readOnly}
          profile={profile}
          savedProfile={savedProfile}
          onProfile={setProfileDraft}
          onSaveProfile={() => {
            const country = COUNTRIES.find((c) => c.code === profile.market);
            update(id, { name: profile.name.trim(), platform: profile.platform, market: profile.market, marketName: country?.name ?? (profile.market === store.market ? store.marketName : profile.market), language: profile.language, timezone: profile.timezone });
            setProfileDraft(null);
            log("Website details updated", "store", (["name", "platform", "market", "language", "timezone"] as const).filter((k) => profile[k] !== savedProfile[k]).join(", "));
            said("Website details saved");
          }}
          channels={data.channels}
          channelIds={channelIds}
          savedChannelIds={store.channelIds}
          trackingMode={trackingMode}
          onChannels={setChannelDraft}
          onTracking={setModeDraft}
          onSaveChannels={() => {
            update(id, { channelIds });
            tracking.save({ trackingMode });
            setChannelDraft(null);
            setModeDraft(null);
            log("AI channels updated", "store", `${channelIds.length} ${channelIds.length === 1 ? "channel" : "channels"}`);
            said("AI channels saved");
          }}
          domains={
            <DomainsTab
              record={domains.value}
              readOnly={readOnly}
              since={store.createdAt}
              onChange={(next, title, detail) => {
                domains.save(next);
                if (next.canonical !== store.domain) update(id, { domain: next.canonical });
                log(title, "domain", detail);
              }}
            />
          }
        />
      ),
    },
    {
      id: "brand",
      label: "Brand knowledge",
      content: (
        <KnowledgeTab
          storeId={id}
          state={knowledge.value}
          crawlers={data.knowledge.crawlers}
          auditId={data.knowledge.auditId}
          readOnly={readOnly}
          onChange={(next, title) => {
            knowledge.save(next);
            log(title, "brand");
          }}
          profile={brandTab}
        />
      ),
    },
    {
      id: "competitors",
      label: "Competitors",
      count: competitors.value.list.filter((c) => c.status !== "archived").length,
      content: (
        <CompetitorsTab
          storeId={id}
          competitors={competitors.value.list}
          market={store.market}
          marketName={store.marketName}
          readOnly={readOnly}
          onChange={(next, title) => {
            competitors.save({ list: next });
            log(title, "competitor");
          }}
        />
      ),
    },
    {
      id: "products",
      label: "Products and services",
      count: products.value.list.length,
      content: (
        <ProductsTab
          storeId={id}
          products={products.value.list}
          readOnly={readOnly}
          onChange={(next, title) => {
            products.save({ list: next });
            log(title, "product");
          }}
        />
      ),
    },
    {
      id: "integrations",
      label: "Connections",
      content: (
        <IntegrationsTab
          detail={integrations.value}
          host={domains.value.canonical}
          readOnly={readOnly}
          onChange={(next, title, detail) => {
            integrations.save(next);
            const connected = next.commerce.state === "connected" || next.commerce.state === "needs_attention";
            update(id, {
              integrations: { commerce: next.commerce.state === "disconnected" ? "disconnected" : connected ? next.commerce.state : "manual", searchConsole: next.searchConsole.state },
              ...(next.commerce.state === "connected" && (store.platform === "manual" || store.platform === "custom") ? { platform: next.commerce.platform } : {}),
            });
            log(title, "integration", detail);
          }}
        />
      ),
    },
    {
      id: "notifications",
      label: "Notifications",
      content: (
        <NotificationsTab
          events={data.events}
          orgMatrix={orgPrefs.value.matrix}
          webhookReady={webhookReady}
          saved={savedNotif}
          draft={notif}
          onDraft={setNotifDraft}
          readOnly={readOnly}
          onSave={() => {
            overrides.save({ ...overrides.value, [id]: { storeId: id, mode: notif.mode, matrix: notif.matrix } });
            setNotifDraft(null);
            log(notif.mode === "inherit" ? "Notifications follow organization defaults" : "Notification overrides saved", "notification");
            said("Notifications saved");
          }}
        />
      ),
    },
    { id: "activity", label: "Activity", content: <ActivityTab entries={activity.value.entries} timezone={store.timezone} /> },
    { id: "danger", label: "Danger zone", content: <DangerTab status={status} websiteName={store.name} reactivateBlocked={reactivateBlocked} onStatus={setPending} /> },
  ];

  return (
    <>
      <PageHeader title="Website settings" subtitle={`${store.name} · ${store.domain}`} meta={<Status kind="store" value={status} />} />
      {status === "ready" ? (
        <HeaderAction>
          <Button size="sm" variant="primary" icon="play" onClick={() => setPending("active")}>Activate</Button>
        </HeaderAction>
      ) : null}

      <div className="flex flex-col gap-4">
        {readOnly ? <Callout tone="neutral" title="Read-only">Restore the website in Danger zone to edit it.</Callout> : null}

        {showSetup ? (
          <Callout
            tone={status === "ready" ? "success" : "warning"}
            title={status === "ready" ? "Ready to activate" : "Finish setup"}
            actions={
              status === "ready" ? null : nextItem ? (
                nextItem.href ? (
                  <ButtonLink href={nextItem.href} size="sm" variant="secondary" icon="arrow-right">{nextItem.action}</ButtonLink>
                ) : (
                  <Button size="sm" variant="secondary" icon="arrow-right" onClick={() => nextItem.tab && goTab(nextItem.tab)}>{nextItem.action}</Button>
                )
              ) : (
                <Button size="sm" variant="secondary" icon="check-circle" onClick={() => setPending("ready")}>Mark ready</Button>
              )
            }
          >
            <p className="tnum text-helper text-fg-muted">{doneCount} of {setupItems.length} done{nextItem ? ` · next: ${nextItem.label}` : ""}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-helper font-medium text-accent-text">Checklist</summary>
              <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1 sm:grid-cols-2">
                {setupItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-body-sm text-fg">
                      <Icon name={item.done ? "check-circle" : "circle"} size={15} className={item.done ? "shrink-0 text-success-icon" : "shrink-0 text-fg-faint"} />
                      <span className="truncate">{item.label}</span>
                      {item.optional && !item.done ? <span className="text-helper text-fg-muted">Optional</span> : null}
                    </span>
                    {item.done ? null : item.href ? (
                      <Link href={item.href} className="shrink-0 rounded px-1 text-helper font-medium text-accent-text hover:underline">Open</Link>
                    ) : (
                      <button type="button" onClick={() => item.tab && goTab(item.tab)} className="shrink-0 cursor-pointer rounded px-1 text-helper font-medium text-accent-text hover:underline">Open</button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </Callout>
        ) : null}

        {commerceState === "needs_attention" && !readOnly ? (
          <Callout tone="warning" title="Connector needs attention" actions={<Button size="sm" variant="secondary" onClick={() => goTab("integrations")}>Open connections</Button>}>
            {integrations.value.commerce.note}
          </Callout>
        ) : null}

        <Tabs key={jump.n} label="Website settings" tabs={tabs} defaultId={jump.id} />
      </div>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) applyStatus(pending);
          setPending(null);
        }}
        title={pendingCopy?.confirmTitle ?? ""}
        confirmLabel={pendingCopy?.confirmLabel ?? "Confirm"}
        tone={pendingCopy?.tone ?? "danger"}
      >
        {pendingCopy?.effect}
      </ConfirmDialog>
    </>
  );
}
