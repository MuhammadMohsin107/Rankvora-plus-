"use client";

import { useEffect, useRef, useState } from "react";

import { Status } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { Field, RadioCards, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Mono } from "@/components/ui/misc";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { DEMO_NOW, formatRelative } from "@/lib/format";
import { PLATFORM_LABEL } from "@/lib/labels";
import type { StorePlatform } from "@/types/core";
import type { IntegrationDetail, IntegrationScope } from "@/types/settings";

/** Simulated result of authorizing each connector. Real scopes come from the connector at run time. */
const SIMULATED_SCOPES: Partial<Record<StorePlatform, IntegrationScope[]>> = {
  shopify: [
    { scope: "read_products", purpose: "Read the product catalogue", granted: true },
    { scope: "read_content", purpose: "Read pages and articles", granted: true },
    { scope: "write_content", purpose: "Stage and publish approved page changes", granted: false },
  ],
  woocommerce: [
    { scope: "read", purpose: "Read products and pages", granted: true },
    { scope: "write", purpose: "Stage and publish approved changes", granted: true },
  ],
};

type Props = {
  detail: IntegrationDetail;
  host: string;
  storePlatform: StorePlatform;
  readOnly: boolean;
  onChange: (next: IntegrationDetail, logTitle: string, detail?: string) => void;
};

export function IntegrationsTab({ detail, host, storePlatform, readOnly, onChange }: Props) {
  const toast = useToast();
  const { commerce, searchConsole } = detail;
  const [connectOpen, setConnectOpen] = useState(false);
  const [method, setMethod] = useState<StorePlatform>("shopify");
  const [authorizing, setAuthorizing] = useState(false);
  const [disconnect, setDisconnect] = useState<"commerce" | "console" | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [property, setProperty] = useState(`sc-domain:${host}`);
  const [verifying, setVerifying] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const ids = timers;
    return () => ids.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const reconnecting = commerce.state === "needs_attention" || commerce.state === "disconnected";
  const connectPlatform: StorePlatform = reconnecting && commerce.platform !== "manual" ? commerce.platform : method;
  const platformName = PLATFORM_LABEL[connectPlatform];

  const closeConnect = () => {
    setConnectOpen(false);
    setAuthorizing(false);
  };

  const authorize = () => {
    setAuthorizing(true);
    later(() => {
      const scopes = SIMULATED_SCOPES[connectPlatform] ?? [];
      onChange(
        { ...detail, commerce: { platform: connectPlatform, state: "connected", account: connectPlatform === "shopify" ? `${host.split(".")[0]}.myshopify.com` : host, scopes, lastVerifiedAt: DEMO_NOW, note: null } },
        `${platformName} ${reconnecting ? "reconnected" : "connected"}`,
        `Scopes: ${scopes.filter((s) => s.granted).map((s) => s.scope).join(", ")}`,
      );
      toast.push({ title: `${platformName} ${reconnecting ? "reconnected" : "connected"}`, description: "Simulated. No real connection was made." });
      closeConnect();
    }, 1200);
  };

  const verify = () => {
    setVerifying(true);
    later(() => {
      setVerifying(false);
      onChange({ ...detail, commerce: { ...commerce, lastVerifiedAt: DEMO_NOW } }, `${PLATFORM_LABEL[commerce.platform]} connection verified`);
      toast.push({ title: "Connection verified", description: "Simulated check." });
    }, 1000);
  };

  const confirmDisconnect = () => {
    if (disconnect === "commerce") {
      onChange({ ...detail, commerce: { ...commerce, state: "disconnected", scopes: commerce.scopes.map((s) => ({ ...s, granted: false })), note: "Disconnected. Fixes are guidance only until you reconnect." } }, `${PLATFORM_LABEL[commerce.platform]} disconnected`);
      toast.push({ title: `${PLATFORM_LABEL[commerce.platform]} disconnected`, description: "Demo action: nothing was changed on a server." });
    }
    if (disconnect === "console") {
      onChange({ ...detail, searchConsole: { state: "not_connected", property: null, lastVerifiedAt: null, note: null } }, "Search Console disconnected");
      toast.push({ title: "Search Console disconnected", description: "Demo action: nothing was changed on a server." });
    }
    setDisconnect(null);
  };

  const connectConsole = () => {
    setAuthorizing(true);
    later(() => {
      onChange({ ...detail, searchConsole: { state: "connected", property, lastVerifiedAt: DEMO_NOW, note: null } }, "Search Console connected", `Property ${property}`);
      toast.push({ title: "Search Console connected", description: "Simulated. No real connection was made." });
      setConsoleOpen(false);
      setAuthorizing(false);
    }, 1200);
  };

  const commerceConnected = commerce.state === "connected" || commerce.state === "needs_attention";
  const shopifyInfo = commerce.platform === "shopify" || (commerce.platform === "manual" && storePlatform === "shopify");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      <Card className="min-w-0 self-start">
        <CardHeader
          title="Commerce platform"
          subtitle={PLATFORM_LABEL[commerce.platform]}
          info={shopifyInfo ? "Shopify access is a per-store token. Each store connects and is disconnected separately." : "Each store keeps its own connection and access token."}
          actions={<Status kind="integration" value={commerce.state} />}
        />
        <CardBody className="flex flex-col gap-4">
          {commerce.note && (commerce.state !== "needs_attention" || readOnly) ? <Callout tone="neutral">{commerce.note}</Callout> : null}

          <KeyValue
            columns={2}
            items={[
              { label: "Account", value: commerce.account ?? "None" },
              { label: "Last verified", value: commerce.lastVerifiedAt ? formatRelative(commerce.lastVerifiedAt) : "Never" },
            ]}
          />

          {commerce.scopes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-medium text-fg">Granted scopes</p>
              <ul className="divide-y divide-line rounded-control border border-line">
                {commerce.scopes.map((scope) => (
                  <li key={scope.scope} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <Mono>{scope.scope}</Mono>
                      <p className="mt-1 text-xs text-fg-subtle">{scope.purpose}</p>
                    </div>
                    {scope.granted ? <Badge tone="success" icon="check">Granted</Badge> : <Badge tone="neutral" icon="minus">Not granted</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {commerce.state === "connected" ? <Button variant="secondary" icon="refresh" loading={verifying} disabled={readOnly} onClick={verify}>Verify now</Button> : null}
            {reconnecting ? <Button variant="primary" icon="plug" disabled={readOnly} onClick={() => setConnectOpen(true)}>Reconnect</Button> : null}
            {!commerceConnected && !reconnecting ? <Button variant="primary" icon="plug" disabled={readOnly} onClick={() => setConnectOpen(true)}>Connect platform</Button> : null}
            {commerceConnected ? <Button variant="danger-ghost" disabled={readOnly} onClick={() => setDisconnect("commerce")}>Disconnect</Button> : null}
          </div>
        </CardBody>
      </Card>

      <Card className="min-w-0 self-start">
        <CardHeader title="Search Console" info="Search performance for the canonical domain." actions={<Status kind="integration" value={searchConsole.state} />} />
        <CardBody className="flex flex-col gap-4">
          {searchConsole.note ? <Callout tone="neutral">{searchConsole.note}</Callout> : null}
          <KeyValue
            columns={2}
            items={[
              { label: "Property", value: searchConsole.property ? <Mono>{searchConsole.property}</Mono> : "None" },
              { label: "Last verified", value: searchConsole.lastVerifiedAt ? formatRelative(searchConsole.lastVerifiedAt) : "Never" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            {searchConsole.state === "connected" ? (
              <Button variant="danger-ghost" disabled={readOnly} onClick={() => setDisconnect("console")}>Disconnect</Button>
            ) : (
              <Button variant="primary" icon="plug" disabled={readOnly} onClick={() => setConsoleOpen(true)}>Connect Search Console</Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Dialog
        open={connectOpen}
        onClose={closeConnect}
        title={reconnecting ? `Reconnect ${platformName}` : "Connect a platform"}
        description="Authorization is simulated in this demo."
        footer={
          <>
            <Button variant="secondary" onClick={closeConnect}>Cancel</Button>
            <Button variant="primary" icon="plug" loading={authorizing} onClick={authorize}>Authorize {platformName}</Button>
          </>
        }
      >
        {reconnecting ? (
          <p className="text-[13px] text-fg-muted">You will be asked to grant access again. Existing findings and tasks are kept.</p>
        ) : (
          <RadioCards<StorePlatform>
            label="Platform"
            value={method}
            onChange={setMethod}
            columns={2}
            options={[
              { value: "shopify", label: "Shopify", description: "Per-store authorization. Read access first." },
              { value: "woocommerce", label: "WooCommerce", disabled: true, badge: <Badge>Later</Badge> },
              { value: "wordpress", label: "WordPress", disabled: true, badge: <Badge>Later</Badge> },
              { value: "webflow", label: "Webflow", disabled: true, badge: <Badge>Later</Badge> },
            ]}
          />
        )}
        {authorizing ? <p className="mt-3 flex items-center gap-2 text-[13px] text-fg-muted" role="status"><Spinner className="text-accent-text" />Waiting for confirmation</p> : null}
      </Dialog>

      <Dialog
        open={consoleOpen}
        onClose={() => {
          setConsoleOpen(false);
          setAuthorizing(false);
        }}
        title="Connect Search Console"
        description="Authorization is simulated in this demo."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConsoleOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="plug" loading={authorizing} onClick={connectConsole}>Connect</Button>
          </>
        }
      >
        <Field label="Property">
          {({ id }) => (
            <Select id={id} value={property} onChange={(e) => setProperty(e.target.value)}>
              <option value={`sc-domain:${host}`}>sc-domain:{host}</option>
              <option value={`https://${host}/`}>https://{host}/</option>
            </Select>
          )}
        </Field>
      </Dialog>

      <ConfirmDialog
        open={disconnect !== null}
        onClose={() => setDisconnect(null)}
        onConfirm={confirmDisconnect}
        title={disconnect === "console" ? "Disconnect Search Console?" : `Disconnect ${PLATFORM_LABEL[commerce.platform]}?`}
        confirmLabel="Disconnect"
      >
        {disconnect === "console" ? (
          <p>Search data stops syncing. Data already imported stays in past audits.</p>
        ) : (
          <>
            <p>The stored access token for this store is removed. Findings, tasks and history stay.</p>
            <p className="mt-2 flex items-start gap-1.5"><Icon name="info" size={14} className="mt-0.5 shrink-0" />Fix tasks that need the connection become guidance only.</p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
