"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Checkbox, Field, Input, RadioCards, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { INTENT_LABEL, SCOPE_LABEL } from "@/lib/labels";
import type { PromptIntent, PromptScope } from "@/types/core";
import type { NewPromptData } from "@/types/prompts";

import { LANGUAGE_OPTIONS, MARKET_OPTIONS, type ManualForm, type SessionPrompt } from "./create-types";
import { CharCount, DuplicateNotice, FieldGroup } from "./parts";
import { MAX_PROMPT_LENGTH, fillTemplate, findDuplicate, namesBrand, validatePromptText } from "./text";

type Props = {
  data: NewPromptData;
  form: ManualForm;
  setForm: (next: ManualForm) => void;
  session: SessionPrompt[];
  onCreated: (text: string) => void;
};

export function ManualTab({ data, form, setForm, session, onCreated }: Props) {
  const { store, groups, products, existing, channels, templates, profile } = data;
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<{ text?: string }>({});
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const base = `/stores/${store.id}/prompts`;

  const set = <K extends keyof ManualForm>(key: K, value: ManualForm[K]) => setForm({ ...form, [key]: value });

  const comparable = useMemo(() => [...existing, ...session], [existing, session]);
  const duplicate = useMemo(() => findDuplicate(form.text, comparable), [form.text, comparable]);
  const brandSpecific = namesBrand(form.text, store.brandName);
  const blocked = duplicate?.kind === "exact" && form.market === store.market && form.language === store.language;
  const markets = MARKET_OPTIONS.some((m) => m.value === store.market) ? MARKET_OPTIONS : [{ value: store.market, label: store.marketName }, ...MARKET_OPTIONS];

  const submit = () => {
    const textError = validatePromptText(form.text) ?? (blocked ? "This prompt already exists. Change the wording or the market." : null);
    if (textError) {
      setErrors({ text: textError });
      return;
    }
    setErrors({});
    toast.push({ title: "Prompt created", description: `${form.text.trim()} · ${form.status}` });
    onCreated(form.text.trim());
    router.push(base);
  };

  const applyTemplate = (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setForm({ ...form, text: fillTemplate(template.text, profile), intent: template.intent, topic: template.topic });
    setErrors({});
    setTemplatesOpen(false);
    toast.push({ title: "Template applied", description: template.title, tone: "info" });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card as="section">
        <CardHeader
          title="Prompt"
          actions={
            <Button size="sm" icon="copy" onClick={() => setTemplatesOpen(true)}>
              Copy from template
            </Button>
          }
        />
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <CardBody className="flex flex-col gap-4">
            <Field label="Prompt text" required error={errors.text}>
              {({ id, describedBy, invalid }) => (
                <>
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    rows={3}
                    value={form.text}
                    placeholder={`e.g. What are the best ${profile.category} brands in ${store.marketName}?`}
                    onChange={(event) => {
                      set("text", event.target.value);
                      if (errors.text) setErrors({});
                    }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-fg-subtle">Write it as a real user would ask.</span>
                    <CharCount value={form.text.length} max={MAX_PROMPT_LENGTH} />
                  </div>
                </>
              )}
            </Field>
            {duplicate ? <DuplicateNotice match={duplicate} storeId={store.id} /> : null}

            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
              <Field label="Intent">
                {({ id }) => (
                  <Select id={id} value={form.intent} onChange={(event) => set("intent", event.target.value as PromptIntent)}>
                    {Object.entries(INTENT_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Topic">
                {({ id }) => <Input id={id} value={form.topic} maxLength={60} placeholder="e.g. Beginners" onChange={(event) => set("topic", event.target.value)} />}
              </Field>
              <Field label="Group">
                {({ id }) => (
                  <Select id={id} value={form.groupId} onChange={(event) => set("groupId", event.target.value)}>
                    <option value="">Ungrouped</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Status">
                {({ id }) => (
                  <Select id={id} value={form.status} onChange={(event) => set("status", event.target.value as ManualForm["status"])}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </Select>
                )}
              </Field>
              <Field label="Market">
                {({ id }) => (
                  <Select id={id} value={form.market} onChange={(event) => set("market", event.target.value)}>
                    {markets.map((m) => (
                      <option key={m.value} value={m.value}>{m.label} ({m.value})</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Language">
                {({ id }) => (
                  <Select id={id} value={form.language} onChange={(event) => set("language", event.target.value)}>
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            <div className="flex flex-col gap-1.5">
              <span aria-hidden="true" className="text-[13px] font-medium text-fg">Tracking scope</span>
              <RadioCards
                label="Tracking scope"
                columns={3}
                value={form.scope}
                onChange={(value: PromptScope) => set("scope", value)}
                options={(Object.keys(SCOPE_LABEL) as PromptScope[]).map((value) => ({ value, label: SCOPE_LABEL[value] }))}
              />
            </div>

            <FieldGroup legend="Linked products">
              {products.length === 0 ? (
                <p className="text-[13px] text-fg-muted">No products or services in this store yet.</p>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                  {products.map((product) => (
                    <Checkbox
                      key={product.id}
                      label={product.title}
                      description={product.category}
                      checked={form.productIds.includes(product.id)}
                      onChange={(event) => set("productIds", event.target.checked ? [...form.productIds, product.id] : form.productIds.filter((id) => id !== product.id))}
                      className="rounded-control border border-line p-2.5"
                    />
                  ))}
                </div>
              )}
            </FieldGroup>

            <Checkbox label="Core prompt" description="Part of the stable set used to compare results over time." checked={form.isCore} onChange={(event) => set("isCore", event.target.checked)} />
          </CardBody>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-4 py-3">
            <ButtonLink href={base} variant="ghost">Cancel</ButtonLink>
            <Button type="submit" variant="primary" icon="plus">Create prompt</Button>
          </div>
        </form>
      </Card>

      <Card as="section" className="h-fit">
        <CardHeader title="Preview" info="How this prompt will be tracked once it is active." />
        <CardBody>
          <KeyValue
            columns={1}
            items={[
              {
                label: "Type",
                value: form.text.trim() ? (
                  brandSpecific ? <Badge tone="neutral" icon="store">Names brand</Badge> : <Badge tone="info" icon="search">Neutral</Badge>
                ) : (
                  <span className="text-fg-subtle">Add text</span>
                ),
              },
              {
                label: "Runs on",
                value:
                  channels.length === 0 ? (
                    <span className="text-fg-muted">No AI channels selected for this store.</span>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {channels.map((c) => (
                        <li key={c.id} className="text-[13px] text-fg-muted">{c.label}</li>
                      ))}
                    </ul>
                  ),
              },
            ]}
          />
        </CardBody>
      </Card>

      <Dialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Organization templates" description="Filled with this store's brand and market." size="md">
        <ul className="flex flex-col gap-2">
          {templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => applyTemplate(template.id)}
                className="flex w-full cursor-pointer flex-col gap-1 rounded-control border border-line p-3 text-left transition-colors duration-[var(--dur-fast)] hover:border-accent hover:bg-accent-soft/40"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-fg">{template.title}</span>
                  <Badge tone="neutral">{INTENT_LABEL[template.intent]}</Badge>
                </span>
                <span className="text-[13px] text-fg-muted [overflow-wrap:anywhere]">{fillTemplate(template.text, profile)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
