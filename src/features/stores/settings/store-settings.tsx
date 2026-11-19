"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { DEMO_NOW } from "@/lib/format";
import type { AiChannel, Competitor, ProductService, Store, StoreStatus } from "@/types/core";
import type { ActivityEntry, BrandVersion, DomainRecord, IntegrationDetail, NotificationEvent, NotificationMatrix, ActivityKind } from "@/types/settings";

import { transitionCopy } from "../status-transitions";
import type { TrackingMode } from "../wizard/model";
import { ActivityTab } from "./activity-tab";
import { BrandTab, draftFromVersion, type BrandDraft } from "./brand-tab";
import { CompetitorsTab } from "./competitors-tab";
import { DangerTab } from "./danger-tab";
import { DomainsTab } from "./domains-tab";
import { IntegrationsTab } from "./integrations-tab";
import { NotificationsTab, type StoreNotifState } from "./notifications-tab";
import { ProductsTab } from "./products-tab";
import { ProfileTab, type ProfileValues } from "./profile-tab";
import { nextId, type TabId } from "./util";

export type StoreSettingsData = {
  store: Store;
  channels: AiChannel[];
  competitors: Competitor[];
  products: ProductService[];
  brandVersions: BrandVersion[];
  domains: DomainRecord;
  integrations: IntegrationDetail;
  activity: ActivityEntry[];
  events: NotificationEvent[];
  orgMatrix: NotificationMatrix;
  orgWebhookReady: boolean;
  notifications: StoreNotifState;
  promptCount: number;
};

type SetupItem = { id: string; label: string; done: boolean; optional?: boolean; tab?: TabId; href?: string };

export function StoreSettings({ data }: { data: StoreSettingsData }) {
  const { store } = data;
  const toast = useToast();

  const [status, setStatus] = useState<StoreStatus>(store.status);
  const [pending, setPending] = useState<StoreStatus | null>(null);

  const [savedProfile, setSavedProfile] = useState<ProfileValues>({ name: store.name, platform: store.platform, timezone: store.timezone });
  const [profile, setProfile] = useState<ProfileValues>(savedProfile);
  const [savedChannelIds, setSavedChannelIds] = useState<string[]>(store.channelIds);
  const [channelIds, setChannelIds] = useState<string[]>(store.channelIds);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("web_grounded");

  const [versions, setVersions] = useState<BrandVersion[]>(data.brandVersions);
  const [brandDraft, setBrandDraft] = useState<BrandDraft>(draftFromVersion(data.brandVersions[0]));
  const [domains, setDomains] = useState<DomainRecord>(data.domains);
  const [competitors, setCompetitors] = useState<Competitor[]>(data.competitors);
  const [products, setProducts] = useState<ProductService[]>(data.products);
  const [integrations, setIntegrations] = useState<IntegrationDetail>(data.integrations);
  const [savedNotif, setSavedNotif] = useState<StoreNotifState>(data.notifications);
  const [notif, setNotif] = useState<StoreNotifState>(data.notifications);
  const [activity, setActivity] = useState<ActivityEntry[]>(data.activity);
  const [jump, setJump] = useState<{ id: TabId; n: number }>({ id: "profile", n: 0 });

  const readOnly = status === "archived";
  const goTab = (id: TabId) => setJump((current) => ({ id, n: current.n + 1 }));

  const log = (title: string, kind: ActivityKind, detail?: string) =>
    setActivity((current) => [{ id: nextId("local-act", current.map((a) => a.id)), storeId: store.id, at: DEMO_NOW, actor: "You", title, detail, kind }, ...current]);

  const applyStatus = (to: StoreStatus) => {
    const copy = transitionCopy(status, to, profile.name);
    log(`Status changed: ${status.replace("_", " ")} to ${to}`, "store");
    setStatus(to);
    toast.push({ title: copy.toastTitle, description: "Demo action: nothing was changed on a server." });
  };

  /* Setup checklist (drives the "Finish setup" callout and the Mark ready gate). */
  const consoleState = integrations.searchConsole.state;
  const setupItems: SetupItem[] = [
    { id: "brand", label: "Brand description", done: (versions[0]?.description ?? "").trim().length > 0, tab: "brand" },
    { id: "channels", label: "AI channels", done: savedChannelIds.length > 0, tab: "profile" },
    { id: "prompts", label: "Prompts", done: data.promptCount > 0, href: `/stores/${store.id}/prompts` },
    { id: "competitors", label: "Confirmed competitors", done: competitors.some((c) => c.status === "confirmed"), optional: true, tab: "competitors" },
    { id: "products", label: "Products and services", done: products.length > 0, optional: true, tab: "products" },
    { id: "console", label: "Search Console", done: consoleState === "connected", optional: true, tab: "integrations" },
  ];
  const required = setupItems.filter((item) => !item.optional);
  const requiredDone = required.every((item) => item.done);
  const doneCount = setupItems.filter((item) => item.done).length;

  const commerceState = integrations.commerce.state;
  const blocked: Partial<Record<StoreStatus, string>> = {};
  if (!requiredDone && (status === "draft" || status === "needs_review")) blocked.ready = "Finish the required setup items first.";
  if (status === "disconnected" && commerceState !== "connected" && commerceState !== "manual") blocked.active = "Reconnect the integration first.";

  const showSetup = status === "draft" || status === "needs_review" || status === "ready";
  const pendingCopy = pending ? transitionCopy(status, pending, profile.name) : null;

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      content: (
        <ProfileTab
          storeName={profile.name}
          domain={domains.canonical}
          status={status}
          readOnly={readOnly}
          profile={profile}
          savedProfile={savedProfile}
          onProfile={setProfile}
          onSaveProfile={() => {
            setSavedProfile(profile);
            log("Profile updated", "store", [profile.name !== savedProfile.name && "name", profile.platform !== savedProfile.platform && "platform", profile.timezone !== savedProfile.timezone && "time zone"].filter(Boolean).join(", "));
            toast.push({ title: "Profile saved", description: "Demo action: nothing was changed on a server." });
          }}
          platformLocked={commerceState === "connected" || commerceState === "needs_attention"}
          blockedTransitions={blocked}
          onStatus={setPending}
          channels={data.channels}
          channelIds={channelIds}
          savedChannelIds={savedChannelIds}
          trackingMode={trackingMode}
          onChannels={setChannelIds}
          onTracking={setTrackingMode}
          onSaveChannels={() => {
            setSavedChannelIds(channelIds);
            log("AI channels updated", "store", `${channelIds.length} channels`);
            toast.push({ title: "Channels saved", description: "Applies to the next run. Demo action." });
          }}
          goTab={goTab}
        />
      ),
    },
    {
      id: "brand",
      label: "Brand",
      content: (
        <BrandTab
          versions={versions}
          draft={brandDraft}
          onDraft={setBrandDraft}
          readOnly={readOnly}
          timezone={store.timezone}
          onSaveVersion={(note) => {
            const version = (versions[0]?.version ?? 0) + 1;
            const next: BrandVersion = { version, createdAt: DEMO_NOW, createdBy: "You", note, brandName: brandDraft.brandName.trim(), aliases: brandDraft.aliases, differentiators: brandDraft.differentiators, description: brandDraft.description.trim() };
            setVersions([next, ...versions]);
            setBrandDraft(draftFromVersion(next));
            log(`Brand profile saved as v${version}`, "brand", note);
            toast.push({ title: `Brand saved as v${version}`, description: "Earlier audits and runs keep their version." });
          }}
        />
      ),
    },
    {
      id: "domains",
      label: "Domains",
      content: (
        <DomainsTab
          record={domains}
          readOnly={readOnly}
          since={store.createdAt}
          onChange={(next, title, detail) => {
            setDomains(next);
            log(title, "domain", detail);
          }}
        />
      ),
    },
    {
      id: "competitors",
      label: "Competitors",
      count: competitors.filter((c) => c.status !== "archived").length,
      content: (
        <CompetitorsTab
          storeId={store.id}
          competitors={competitors}
          market={store.market}
          marketName={store.marketName}
          readOnly={readOnly}
          onChange={(next, title) => {
            setCompetitors(next);
            log(title, "competitor");
          }}
        />
      ),
    },
    {
      id: "products",
      label: "Products and services",
      count: products.length,
      content: (
        <ProductsTab
          storeId={store.id}
          products={products}
          readOnly={readOnly}
          onChange={(next, title) => {
            setProducts(next);
            log(title, "product");
          }}
        />
      ),
    },
    {
      id: "integrations",
      label: "Integrations",
      content: (
        <IntegrationsTab
          detail={integrations}
          host={domains.canonical}
          storePlatform={profile.platform}
          readOnly={readOnly}
          onChange={(next, title, detail) => {
            setIntegrations(next);
            if (next.commerce.platform !== profile.platform && next.commerce.state === "connected") {
              setProfile((current) => ({ ...current, platform: next.commerce.platform }));
              setSavedProfile((current) => ({ ...current, platform: next.commerce.platform }));
            }
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
          orgMatrix={data.orgMatrix}
          webhookReady={data.orgWebhookReady}
          saved={savedNotif}
          draft={notif}
          onDraft={setNotif}
          readOnly={readOnly}
          onSave={() => {
            setSavedNotif(notif);
            log(notif.mode === "inherit" ? "Notifications follow organization defaults" : "Notification overrides saved", "notification");
            toast.push({ title: "Notifications saved", description: "Demo action: nothing was changed on a server." });
          }}
        />
      ),
    },
    { id: "activity", label: "Activity log", content: <ActivityTab entries={activity} timezone={store.timezone} /> },
    { id: "danger", label: "Danger zone", content: <DangerTab status={status} storeName={profile.name} onStatus={setPending} /> },
  ];

  return (
    <>
      <PageHeader
        title="Store settings"
        subtitle={`${profile.name} · ${domains.canonical}`}
        meta={<Status kind="store" value={status} />}
        actions={<ButtonLink href={`/stores/${store.id}`} variant="secondary" trailingIcon="arrow-right">Dashboard</ButtonLink>}
      />

      <div className="flex flex-col gap-4">
        {readOnly ? (
          <Callout tone="neutral" title="Archived: read-only" actions={<Button size="sm" variant="secondary" icon="undo" onClick={() => setPending("paused")}>Restore</Button>}>
            Restore the store to edit it.
          </Callout>
        ) : null}

        {showSetup ? (
          <Callout
            tone={status === "ready" ? "success" : "warning"}
            title={status === "ready" ? "Ready to activate" : "Finish setup"}
            actions={
              status === "ready" ? (
                <Button size="sm" variant="primary" icon="play" onClick={() => setPending("active")}>Activate</Button>
              ) : (
                <Button size="sm" variant="primary" icon="check-circle" disabled={!requiredDone} onClick={() => setPending("ready")}>Mark ready</Button>
              )
            }
          >
            <p className="tnum text-xs text-fg-muted">{doneCount} of {setupItems.length} done{requiredDone ? "" : " · required items first"}</p>
            <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
              {setupItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-[13px] text-fg">
                    <Icon name={item.done ? "check-circle" : "circle"} size={15} className={item.done ? "shrink-0 text-success" : "shrink-0 text-fg-subtle"} />
                    <span className="truncate">{item.label}</span>
                    {item.optional && !item.done ? <span className="text-xs text-fg-subtle">Optional</span> : null}
                  </span>
                  {item.done ? null : item.href ? (
                    <Link href={item.href} className="shrink-0 rounded px-1 text-xs font-medium text-accent-text hover:underline">Open</Link>
                  ) : (
                    <button type="button" onClick={() => item.tab && goTab(item.tab)} className="shrink-0 cursor-pointer rounded px-1 text-xs font-medium text-accent-text hover:underline">Open</button>
                  )}
                </li>
              ))}
            </ul>
          </Callout>
        ) : null}

        {commerceState === "needs_attention" && !readOnly ? (
          <Callout tone="warning" title="Commerce connection needs attention" actions={<Button size="sm" variant="secondary" onClick={() => goTab("integrations")}>Open integrations</Button>}>
            {integrations.commerce.note}
          </Callout>
        ) : null}

        <Tabs key={jump.n} label="Store settings" tabs={tabs} defaultId={jump.id} />
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
