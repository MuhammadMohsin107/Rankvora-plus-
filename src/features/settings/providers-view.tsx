"use client";

import { useEffect, useRef, useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Field, Input, Switch } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { DEMO_NOW, formatRelative } from "@/lib/format";
import { SEARCH_MODE_LABEL, channelLabel } from "@/lib/labels";
import type { IntegrationState } from "@/types/core";
import type { ProviderConnection } from "@/types/settings";

type LocalState = { status: IntegrationState; byok: boolean; keyLast4: string | null; lastVerifiedAt: string | null };

export function ProvidersView({ providers }: { providers: ProviderConnection[] }) {
  const toast = useToast();
  const [local, setLocal] = useState<Record<string, LocalState>>(() =>
    Object.fromEntries(providers.map((p) => [p.provider, { status: p.status, byok: p.byok, keyLast4: p.keyLast4, lastVerifiedAt: p.lastVerifiedAt }])),
  );
  const [testing, setTesting] = useState<string | null>(null);
  const [keyFor, setKeyFor] = useState<ProviderConnection | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [disableFor, setDisableFor] = useState<ProviderConnection | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const ids = timers;
    return () => ids.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const update = (provider: string, next: Partial<LocalState>) => setLocal((current) => ({ ...current, [provider]: { ...current[provider], ...next } }));

  const test = (p: ProviderConnection) => {
    setTesting(p.provider);
    timers.current.push(
      window.setTimeout(() => {
        setTesting(null);
        if (p.testOutcome.ok) {
          update(p.provider, { status: "connected", lastVerifiedAt: DEMO_NOW });
          toast.push({ title: `${p.label} connection works`, description: "Simulated test request succeeded." });
        } else {
          update(p.provider, { status: "needs_attention" });
          toast.push({ title: `${p.label} test failed`, description: p.testOutcome.message, tone: "danger" });
        }
      }, 1400),
    );
  };

  const keyError = keyValue.trim().length < 20 ? "Paste the full API key (at least 20 characters)." : null;
  const closeKey = () => {
    setKeyFor(null);
    setKeyValue("");
    setKeyTouched(false);
  };
  const saveKey = () => {
    setKeyTouched(true);
    if (keyError || !keyFor) return;
    update(keyFor.provider, { byok: true, keyLast4: keyValue.trim().slice(-4), status: "connected" });
    toast.push({ title: `${keyFor.label} key saved`, description: "Demo: the key was not stored anywhere." });
    closeKey();
  };

  const onByok = (p: ProviderConnection, on: boolean) => {
    if (on) setKeyFor(p);
    else setDisableFor(p);
  };

  const available = providers.filter((p) => p.availability === "available");
  const later = providers.filter((p) => p.availability === "later");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {available.map((p) => {
          const s = local[p.provider];
          const isTesting = testing === p.provider;
          return (
            <Card key={p.provider} as="article" className="flex flex-col">
              <CardHeader
                as="h3"
                title={p.label}
                subtitle={p.apiLabel}
                actions={<Status kind="integration" value={s.status} />}
              />
              <CardBody className="flex flex-1 flex-col gap-4">
                <p className="rounded-control bg-surface-2 px-2.5 py-1.5 text-xs text-fg-muted">{channelLabel({ providerLabel: p.label, apiLabel: p.apiLabel, model: p.model ?? "", searchMode: p.searchMode ?? "model_only" })}</p>
                <KeyValue
                  columns={2}
                  items={[
                    { label: "Model", value: p.model },
                    { label: "Search", value: p.searchMode ? <>{p.searchCapability}<span className="block text-xs text-fg-subtle">{SEARCH_MODE_LABEL[p.searchMode]}</span></> : p.searchCapability },
                    { label: "Citations", value: p.supportsCitations ? <Badge tone="success" icon="check">Supported</Badge> : <Badge tone="neutral" icon="minus">Not supported</Badge> },
                    { label: "Key", value: s.byok && s.keyLast4 ? <span className="tnum">{"••••••••"}{s.keyLast4}</span> : "Platform-managed" },
                    { label: "Last verified", value: s.lastVerifiedAt ? formatRelative(s.lastVerifiedAt) : "Never" },
                  ]}
                />
                <div className="mt-auto flex flex-col gap-3 border-t border-line pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[13px] text-fg">
                      Use your own key
                      <Tooltip content="Bring your own key: requests use your provider account instead of the platform key.">
                        <span tabIndex={0} aria-label="Bring your own key: requests use your provider account instead of the platform key." className="flex cursor-help text-fg-subtle">
                          <Icon name="info" size={13} />
                        </span>
                      </Tooltip>
                    </span>
                    <Switch label={`Use your own ${p.label} key`} checked={s.byok} onChange={(on) => onByok(p, on)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" icon="refresh" loading={isTesting} onClick={() => test(p)}>{isTesting ? "Testing" : "Test connection"}</Button>
                    {s.byok ? <Button variant="ghost" icon="key" onClick={() => setKeyFor(p)}>Replace key</Button> : null}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {later.map((p) => (
          <Card key={p.provider} as="article" className="flex flex-col bg-surface-2/40">
            <CardHeader as="h3" title={p.label} subtitle={p.apiLabel} actions={<Badge tone="neutral">Later</Badge>} />
            <CardBody className="flex flex-1 flex-col gap-4">
              <p className="text-[13px] text-fg-muted">{p.laterNote}</p>
              <Button
                className="mt-auto self-start"
                variant="secondary"
                icon="bell"
                onClick={() => toast.push({ title: `We will tell you when ${p.label} is available`, description: "Demo action.", tone: "info" })}
              >
                Notify me
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
        <Icon name="info" size={13} />
        Copilot is not offered.
        <Tooltip content="Consumer apps such as Copilot and the ChatGPT app are not tracked. Results are API answer samples.">
          <span tabIndex={0} aria-label="Consumer apps such as Copilot and the ChatGPT app are not tracked. Results are API answer samples." className="flex cursor-help">
            <Icon name="help" size={13} />
          </span>
        </Tooltip>
      </p>

      <Dialog
        open={keyFor !== null}
        onClose={closeKey}
        title={keyFor ? `${keyFor.label} API key` : ""}
        description="The key is masked after saving."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeKey}>Cancel</Button>
            <Button variant="primary" onClick={saveKey}>Save key</Button>
          </>
        }
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            saveKey();
          }}
        >
          <Field label="API key" required error={keyTouched ? (keyError ?? undefined) : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="password" autoComplete="off" aria-describedby={describedBy} invalid={invalid} value={keyValue} onChange={(e) => setKeyValue(e.target.value)} onBlur={() => setKeyTouched(true)} />
            )}
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={disableFor !== null}
        onClose={() => setDisableFor(null)}
        onConfirm={() => {
          if (disableFor) {
            update(disableFor.provider, { byok: false, keyLast4: null });
            toast.push({ title: `${disableFor.label} now uses the platform key`, description: "Demo action: nothing was changed on a server." });
          }
          setDisableFor(null);
        }}
        title={disableFor ? `Stop using your ${disableFor.label} key?` : ""}
        confirmLabel="Use platform key"
      >
        The stored key is removed. Requests use the platform key and count against your plan limits.
      </ConfirmDialog>
    </div>
  );
}
