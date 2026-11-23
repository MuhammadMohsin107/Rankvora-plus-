"use client";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Switch } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { formatRelative } from "@/lib/format";
import { SEARCH_MODE_LABEL } from "@/lib/labels";
import type { ProviderConnection } from "@/types/settings";

import { useProviders } from "./use-providers";

/** Detailed AI platform cards. The Integrations hub shows the same connections as short rows. */
export function ProvidersView({ providers }: { providers: ProviderConnection[] }) {
  const state = useProviders(providers);
  const available = providers.filter((p) => p.availability === "available");
  const later = providers.filter((p) => p.availability === "later");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {available.map((p) => {
          const s = state.local[p.provider];
          const isTesting = state.testing === p.provider;
          return (
            <Card key={p.provider} as="article" className="flex flex-col">
              <CardHeader as="h3" title={p.label} subtitle={p.apiLabel} actions={<Status kind="integration" value={s.status} />} />
              <CardBody className="flex flex-1 flex-col gap-4">
                <KeyValue
                  columns={2}
                  items={[
                    { label: "Model", value: p.model },
                    { label: "Search", value: p.searchMode ? <>{p.searchCapability}<span className="block text-xs text-fg-subtle">{SEARCH_MODE_LABEL[p.searchMode]}</span></> : p.searchCapability },
                    { label: "Citations", value: p.supportsCitations ? <Badge tone="success" icon="check">Supported</Badge> : <Badge tone="neutral" icon="minus">Not supported</Badge> },
                    ...(s.byok && s.keyLast4 ? [{ label: "Demo key", value: <span className="tnum">{"••••••••"}{s.keyLast4}</span> }] : []),
                    { label: "Last verified", value: s.lastVerifiedAt ? formatRelative(s.lastVerifiedAt) : "Never" },
                  ]}
                />
                <div className="mt-auto flex flex-col gap-3 border-t border-line pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-body text-fg">
                      Use your own key
                      <Tooltip content="Requests use your provider account instead of the platform key. The demo sets a masked key.">
                        <span tabIndex={0} aria-label="Requests use your provider account instead of the platform key. The demo sets a masked key." className="flex cursor-help text-fg-subtle">
                          <Icon name="info" size={13} />
                        </span>
                      </Tooltip>
                    </span>
                    <Switch label={`Use your own ${p.label} key`} checked={s.byok} onChange={(on) => state.useOwnKey(p, on)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" icon="refresh" loading={isTesting} onClick={() => state.test(p)}>{isTesting ? "Testing" : "Test connection"}</Button>
                    {s.byok ? <Button variant="ghost" icon="key" onClick={() => state.setKeyFor(p)}>Replace key</Button> : null}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {later.map((p) => {
          const notified = state.local[p.provider].notify;
          return (
            <Card key={p.provider} as="article" className="flex flex-col bg-surface-2/40">
              <CardHeader as="h3" title={p.label} subtitle={p.apiLabel} actions={<Badge tone="neutral">Later</Badge>} />
              <CardBody className="flex flex-1 flex-col gap-4">
                <p className="text-body-sm text-fg-muted">{p.laterNote}</p>
                {notified ? (
                  <Badge tone="success" icon="check-circle" className="self-start">You will be notified (simulated)</Badge>
                ) : (
                  <Button className="mt-auto self-start" variant="secondary" icon="bell" onClick={() => state.notify(p)}>Notify me</Button>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Tooltip className="self-start" content="Consumer apps such as Copilot and the ChatGPT app are not tracked. Results are API answer samples.">
        <span tabIndex={0} className="flex cursor-help items-center gap-1.5 text-xs text-fg-subtle">
          <Icon name="info" size={13} />
          Copilot is not offered
        </span>
      </Tooltip>

      {state.dialogs}
    </div>
  );
}
