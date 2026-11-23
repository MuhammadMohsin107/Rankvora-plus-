"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { demoNow, simulatedToast, useDemoSettings } from "@/demo-state";
import type { ProviderConnection, ProviderLocalState } from "@/types/settings";

/**
 * AI platform connections, used by the Integrations page, which owns them.
 * State lives in demo-state under `org.providers`. No key is ever read or stored: "replace key" creates a masked
 * demo key (last 4 characters only), so nobody is invited to paste a real secret.
 */
export function useProviders(providers: ProviderConnection[]) {
  const toast = useToast();
  const base = useMemo<Record<string, ProviderLocalState>>(
    () => Object.fromEntries(providers.map((p) => [p.provider, { status: p.status, byok: p.byok, keyLast4: p.keyLast4, lastVerifiedAt: p.lastVerifiedAt, notify: false }])),
    [providers],
  );
  const { value: local, patch } = useDemoSettings<Record<string, ProviderLocalState>>("org.providers", base);
  const [testing, setTesting] = useState<string | null>(null);
  const [keyFor, setKeyFor] = useState<ProviderConnection | null>(null);
  const [disableFor, setDisableFor] = useState<ProviderConnection | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers;
    return () => list.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const save = (p: ProviderConnection, next: Partial<ProviderLocalState>, label: string) =>
    patch({ [p.provider]: { ...local[p.provider], ...next } }, { kind: "settings.saved", label });

  const test = (p: ProviderConnection) => {
    setTesting(p.provider);
    timers.current.push(
      window.setTimeout(() => {
        setTesting(null);
        if (p.testOutcome.ok) {
          save(p, { status: "connected", lastVerifiedAt: demoNow() }, `${p.label} connection tested`);
          toast.push(simulatedToast(`${p.label} test passed`));
        } else {
          save(p, { status: "needs_attention" }, `${p.label} connection test failed`);
          toast.push({ title: `${p.label} test failed (simulated)`, description: p.testOutcome.message, tone: "danger" });
        }
      }, 1400),
    );
  };

  const issueDemoKey = (p: ProviderConnection) => {
    const last4 = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
    save(p, { byok: true, keyLast4: last4, status: "connected", lastVerifiedAt: demoNow() }, `${p.label} demo key replaced`);
    toast.push(simulatedToast(`${p.label} demo key replaced`));
    setKeyFor(null);
  };

  const useOwnKey = (p: ProviderConnection, on: boolean) => {
    if (on) setKeyFor(p);
    else setDisableFor(p);
  };

  const stopOwnKey = (p: ProviderConnection) => {
    save(p, { byok: false, keyLast4: null }, `${p.label} now uses the platform key`);
    toast.push(simulatedToast(`${p.label} now uses the platform key`));
    setDisableFor(null);
  };

  const notify = (p: ProviderConnection) => {
    save(p, { notify: true }, `Notify me about ${p.label}`);
    toast.push(simulatedToast(`You will be told when ${p.label} is available`, "info"));
  };

  const dialogs = (
    <>
      <ConfirmDialog
        open={keyFor !== null}
        onClose={() => setKeyFor(null)}
        onConfirm={() => keyFor && issueDemoKey(keyFor)}
        title={keyFor ? `${keyFor.label} demo key` : ""}
        confirmLabel="Use demo key"
        tone="primary"
      >
        <p>A masked demo key is set. This demo never asks for a real key.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={disableFor !== null}
        onClose={() => setDisableFor(null)}
        onConfirm={() => disableFor && stopOwnKey(disableFor)}
        title={disableFor ? `Stop using your ${disableFor.label} key?` : ""}
        confirmLabel="Use platform key"
      >
        <p>The demo key is removed. Requests use the platform key and count against your plan.</p>
      </ConfirmDialog>
    </>
  );

  return { local, testing, test, issueDemoKey, useOwnKey, setKeyFor, notify, dialogs };
}
