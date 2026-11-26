"use client";

import { useEffect, useRef, useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { demoNow, simulatedToast, useDemoSettings } from "@/demo-state";
import { formatRelative } from "@/lib/format";
import { validateRequired } from "@/features/stores/validation";

export type CustomApi = {
  id: string;
  name: string;
  apiType: string;
  model: string;
  webSearch: boolean;
  keyLast4: string;
  lastVerifiedAt: string;
};

const API_TYPES = ["Chat completions API (OpenAI-compatible)", "Messages API", "Responses API", "Other HTTP API"];
const NONE: { items: CustomApi[] } = { items: [] };

/**
 * APIs added by hand on the Integrations page. Saved in this browser only (demo-state `org.customApis`).
 * Nothing is called and no secret is read: a masked demo key (last 4 characters) is set when the API is added.
 */
export function useCustomApis() {
  const toast = useToast();
  const { value, save } = useDemoSettings<{ items: CustomApi[] }>("org.customApis", NONE);
  const items = value.items;
  const [testing, setTesting] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const add = (input: { name: string; apiType: string; model: string; webSearch: boolean }) => {
    const api: CustomApi = {
      id: `custom-${Date.now().toString(36)}`,
      ...input,
      keyLast4: Math.random().toString(36).slice(2, 6).padEnd(4, "0"),
      lastVerifiedAt: demoNow(),
    };
    save({ items: [...items, api] }, { kind: "settings.saved", label: `API added: ${api.name}` });
    toast.push(simulatedToast(`${api.name} added`));
  };

  const remove = (api: CustomApi) => {
    save({ items: items.filter((i) => i.id !== api.id) }, { kind: "settings.saved", label: `API removed: ${api.name}` });
    toast.push(simulatedToast(`${api.name} removed`, "warning"));
  };

  const test = (api: CustomApi) => {
    setTesting(api.id);
    timer.current = window.setTimeout(() => {
      setTesting(null);
      save({ items: items.map((i) => (i.id === api.id ? { ...i, lastVerifiedAt: demoNow() } : i)) }, { kind: "settings.saved", label: `${api.name} connection tested` });
      toast.push(simulatedToast(`${api.name} test passed`));
    }, 1400);
  };

  return { items, testing, add, remove, test };
}

/** The blank "+" tile at the end of the grid. */
export function AddApiTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-strong bg-surface/50 p-4 text-fg-muted transition-colors duration-[var(--dur-fast)] hover:border-accent hover:bg-accent-soft hover:text-accent-text"
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface group-hover:border-accent group-hover:text-accent-text">
        <Icon name="plus" size={22} />
      </span>
      <span className="text-card-title font-semibold">Add API</span>
    </button>
  );
}

export function AddApiDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (input: { name: string; apiType: string; model: string; webSearch: boolean }) => void }) {
  // Remount on open so the form starts empty each time.
  return <AddApiBody key={String(open)} open={open} onClose={onClose} onAdd={onAdd} />;
}

function AddApiBody({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (input: { name: string; apiType: string; model: string; webSearch: boolean }) => void }) {
  const [name, setName] = useState("");
  const [apiType, setApiType] = useState(API_TYPES[0]);
  const [model, setModel] = useState("");
  const [webSearch, setWebSearch] = useState("none");
  const [touched, setTouched] = useState(false);
  const nameError = validateRequired(name, "API name", 2, 40);
  const modelError = validateRequired(model, "Model", 2, 60);
  const submit = () => {
    setTouched(true);
    if (nameError || modelError) return;
    onAdd({ name: name.trim(), apiType, model: model.trim(), webSearch: webSearch === "provider" });
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add API"
      description="Demo: no real key is needed."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="plus" onClick={submit}>Add API</Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="API name" required error={touched ? (nameError ?? undefined) : undefined}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="off" placeholder="For example Mistral" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="API type">
          {({ id }) => (
            <Select id={id} value={apiType} onChange={(e) => setApiType(e.target.value)}>
              {API_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Model" required error={touched ? (modelError ?? undefined) : undefined}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="off" placeholder="For example demo-model-d" value={model} onChange={(e) => setModel(e.target.value)} />}
        </Field>
        <Field label="Web search">
          {({ id }) => (
            <Select id={id} value={webSearch} onChange={(e) => setWebSearch(e.target.value)}>
              <option value="none">None (model knowledge only)</option>
              <option value="provider">Provider web search</option>
            </Select>
          )}
        </Field>
        <p className="text-helper text-fg-subtle">Demo only: audits use the built-in platforms.</p>
      </form>
    </Dialog>
  );
}

export function CustomApiCard({ api, testing, onTest, onRemove }: { api: CustomApi; testing: boolean; onTest: () => void; onRemove: () => void }) {
  return (
    <Card as="article" className="flex flex-col">
      <CardHeader title={api.name} subtitle={api.apiType} actions={<Status kind="integration" value="connected" />} />
      <CardBody className="flex flex-1 flex-col gap-4">
        <KeyValue
          columns={2}
          items={[
            { label: "Model", value: api.model },
            { label: "Search", value: api.webSearch ? "Provider web search" : "None" },
            { label: "Citations", value: <Badge tone="neutral" icon="minus">Not confirmed</Badge> },
            { label: "Demo key", value: <span className="tnum">{"••••••••"}{api.keyLast4}</span> },
            { label: "Last verified", value: formatRelative(api.lastVerifiedAt) },
          ]}
        />
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Button variant="secondary" icon="refresh" loading={testing} onClick={onTest}>{testing ? "Testing" : "Test connection"}</Button>
          <Button variant="danger-ghost" icon="trash" onClick={onRemove}>Remove</Button>
        </div>
      </CardBody>
    </Card>
  );
}
