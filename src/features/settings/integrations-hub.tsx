"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { Icon, type IconName } from "@/components/ui/icon";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { demoNow, simulatedToast, useDemoCollection, useDemoSettings } from "@/demo-state";
import { formatRelative } from "@/lib/format";
import type { Store } from "@/types/core";
import type { ConnectionState, ConnectorBase, ConnectorId, ProviderConnection } from "@/types/settings";

import { useProviders } from "./use-providers";

const CONNECTOR_ICON: Record<ConnectorId, IconName> = {
  wordpress: "globe",
  webflow: "layers",
  woocommerce: "store",
  shopify: "store",
  search_console: "search",
  pagespeed: "bolt",
};

function Row({ icon, title, summary, status, meta, actions }: { icon: IconName; title: string; summary: string; status: ReactNode; meta?: string; actions: ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] items-center gap-3 px-card py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg-muted">
          <Icon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{title}</p>
          <p className="truncate text-helper text-fg-subtle">{summary}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {status}
        {meta ? <span className="tnum text-helper text-fg-subtle">{meta}</span> : null}
      </div>
      <div className="flex items-center gap-2 sm:justify-end">{actions}</div>
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-fg">{title}</h2>
      <Card>
        <ul className="divide-y divide-line">{children}</ul>
      </Card>
    </section>
  );
}

type Props = {
  providers: ProviderConnection[];
  connectors: ConnectorBase[];
  connections: Record<string, ConnectionState>;
  websites: Store[];
};

/** One status list for everything Rankvora can connect to. All connections are simulated and no secret is ever collected. */
export function IntegrationsHub({ providers, connectors, connections, websites: baseWebsites }: Props) {
  const toast = useToast();
  const ai = useProviders(providers);
  const websites = useDemoCollection<Store>("websites", baseWebsites).rows.filter((w) => w.status !== "archived");
  const { value: conns, patch } = useDemoSettings<Record<string, ConnectionState>>("org.connections", connections);
  const [testing, setTesting] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<ConnectorBase | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [disconnecting, setDisconnecting] = useState<ConnectorBase | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers;
    return () => list.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const siteNames = (ids: string[]) => {
    const names = ids.map((id) => websites.find((w) => w.id === id)?.name).filter(Boolean) as string[];
    return names.length === 0 ? "" : names.length <= 2 ? names.join(", ") : `${names.length} websites`;
  };

  const save = (c: ConnectorBase, next: ConnectionState, label: string) => patch({ [c.id]: next }, { kind: "settings.saved", label });

  const openConnect = (c: ConnectorBase) => {
    setPicked(conns[c.id]?.websiteIds ?? []);
    setConnecting(c);
  };

  const confirmConnect = () => {
    if (!connecting || picked.length === 0) return;
    save(connecting, { status: "connected", websiteIds: picked, lastVerifiedAt: demoNow() }, `${connecting.label} connected to ${picked.length} ${picked.length === 1 ? "website" : "websites"}`);
    toast.push(simulatedToast(`${connecting.label} connected`));
    setConnecting(null);
  };

  const test = (c: ConnectorBase) => {
    const current = conns[c.id];
    setTesting(c.id);
    timers.current.push(
      window.setTimeout(() => {
        setTesting(null);
        if (!c.testOutcome.ok && current.status === "needs_attention") {
          save(c, { ...current, status: "needs_attention" }, `${c.label} connection test failed`);
          toast.push({ title: `${c.label} test failed (simulated)`, description: c.testOutcome.message, tone: "danger" });
        } else {
          save(c, { ...current, status: "connected", lastVerifiedAt: demoNow() }, `${c.label} connection tested`);
          toast.push(simulatedToast(`${c.label} test passed`));
        }
      }, 1200),
    );
  };

  const disconnect = (c: ConnectorBase) => {
    save(c, { status: "not_connected", websiteIds: [], lastVerifiedAt: null }, `${c.label} disconnected`);
    toast.push(simulatedToast(`${c.label} disconnected`, "warning"));
    setDisconnecting(null);
  };

  const connectorRow = (c: ConnectorBase) => {
    const s = conns[c.id] ?? { status: "not_connected", websiteIds: [], lastVerifiedAt: null };
    const on = s.status !== "not_connected";
    return (
      <Row
        key={c.id}
        icon={CONNECTOR_ICON[c.id]}
        title={c.label}
        summary={`${c.summary} Used by ${c.usedFor}.`}
        status={<Status kind="integration" value={s.status} />}
        meta={on ? [siteNames(s.websiteIds), s.lastVerifiedAt ? `checked ${formatRelative(s.lastVerifiedAt)} ago` : ""].filter(Boolean).join(" · ") : undefined}
        actions={
          on ? (
            <>
              <Button variant="secondary" size="sm" icon="refresh" loading={testing === c.id} onClick={() => test(c)}>
                {testing === c.id ? "Testing" : "Test"}
              </Button>
              <Menu
                label={`${c.label} actions`}
                trigger={<IconButton icon="more" label={`${c.label} actions`} size="sm" />}
                width={220}
                items={[
                  { label: s.status === "needs_attention" ? "Reconnect (simulated)" : "Change websites", icon: "pencil", onSelect: () => openConnect(c) },
                  { type: "separator" },
                  { label: "Disconnect", icon: "x-circle", tone: "danger", onSelect: () => setDisconnecting(c) },
                ]}
              />
            </>
          ) : (
            <Button variant="secondary" size="sm" icon="plug" onClick={() => openConnect(c)}>
              Connect
            </Button>
          )
        }
      />
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <Group title="AI platforms">
        {providers.map((p) => {
          const s = ai.local[p.provider];
          const later = p.availability === "later";
          return (
            <Row
              key={p.provider}
              icon="sparkles"
              title={p.label}
              summary={later ? (p.laterNote ?? "Planned.") : `${p.apiLabel}${p.model ? ` · ${p.model}` : ""}`}
              status={later ? <Badge tone="neutral">Later</Badge> : <Status kind="integration" value={s.status} />}
              meta={!later && s.byok && s.keyLast4 ? `Demo key ••••${s.keyLast4}` : undefined}
              actions={
                later ? (
                  s.notify ? (
                    <Badge tone="success" icon="check-circle">Notify on</Badge>
                  ) : (
                    <Button variant="secondary" size="sm" icon="bell" onClick={() => ai.notify(p)}>Notify me</Button>
                  )
                ) : (
                  <>
                    <Button variant="secondary" size="sm" icon="refresh" loading={ai.testing === p.provider} onClick={() => ai.test(p)}>
                      {ai.testing === p.provider ? "Testing" : "Test"}
                    </Button>
                    <Button variant="ghost" size="sm" icon="key" onClick={() => ai.setKeyFor(p)}>
                      {s.byok ? "Replace key" : "Add key"}
                    </Button>
                  </>
                )
              }
            />
          );
        })}
        <li className="flex items-center justify-between gap-3 px-card py-3">
          <span className="text-helper text-fg-subtle">Models, search mode and citations</span>
          <ButtonLink href="/settings/ai-platforms" variant="ghost" size="sm" trailingIcon="arrow-right">AI platforms</ButtonLink>
        </li>
      </Group>

      <Group title="Website connectors (optional)">{connectors.filter((c) => c.group === "cms").map(connectorRow)}</Group>
      <Group title="Search and performance">{connectors.filter((c) => c.group === "search").map(connectorRow)}</Group>

      {ai.dialogs}

      <Dialog
        open={connecting !== null}
        onClose={() => setConnecting(null)}
        title={connecting ? `Connect ${connecting.label}` : ""}
        description="Simulated: no sign-in opens and no credentials are collected."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConnecting(null)}>Cancel</Button>
            <Button variant="primary" disabled={picked.length === 0} onClick={confirmConnect}>Connect</Button>
          </>
        }
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label font-medium text-fg">Websites</legend>
          {websites.map((w) => (
            <Checkbox
              key={w.id}
              label={w.name}
              description={w.domain}
              checked={picked.includes(w.id)}
              onChange={(e) => setPicked((list) => (e.target.checked ? [...list, w.id] : list.filter((x) => x !== w.id)))}
            />
          ))}
          {picked.length === 0 ? <p role="alert" className="text-helper text-danger-text">Choose at least one website.</p> : null}
        </fieldset>
      </Dialog>

      <ConfirmDialog
        open={disconnecting !== null}
        onClose={() => setDisconnecting(null)}
        onConfirm={() => disconnecting && disconnect(disconnecting)}
        title={disconnecting ? `Disconnect ${disconnecting.label}?` : ""}
        confirmLabel="Disconnect"
      >
        <p>Fixes that need it become guidance only. Audits and monitoring keep working.</p>
      </ConfirmDialog>
    </div>
  );
}
