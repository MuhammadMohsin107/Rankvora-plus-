"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, RadioCards, Select, Textarea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { simulatedToast } from "@/demo-state";
import { INTENT_LABEL, SCOPE_LABEL } from "@/lib/labels";
import type { PromptIntent, PromptScope } from "@/types/core";
import type { PromptContext } from "@/types/prompts";

import { LANGUAGE_OPTIONS, MARKET_OPTIONS, type ManualForm } from "./create-types";
import { CharCount, DuplicateNotice, FieldGroup, PromptKind } from "./parts";
import type { NewPromptInput } from "./prompt-ops";
import { MAX_PROMPT_LENGTH, fillTemplate, findDuplicate, namesBrand, validatePromptText } from "./text";

type Props = {
  context: PromptContext;
  form: ManualForm;
  setForm: (next: ManualForm) => void;
  onCreate: (input: NewPromptInput) => void;
};

export function ManualTab({ context, form, setForm, onCreate }: Props) {
  const { store, groups, products, existing, channels, templates, profile } = context;
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<{ text?: string }>({});
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [more, setMore] = useState(false);
  const base = `/stores/${store.id}/prompts`;

  const market = form.market || store.market;
  const language = form.language || store.language;
  const set = <K extends keyof ManualForm>(key: K, value: ManualForm[K]) => setForm({ ...form, [key]: value });

  const duplicate = useMemo(() => findDuplicate(form.text, existing), [form.text, existing]);
  const brandSpecific = namesBrand(form.text, store.brandName);
  const blocked = duplicate?.kind === "exact" && market === store.market && language === store.language;
  const markets = MARKET_OPTIONS.some((m) => m.value === market) ? MARKET_OPTIONS : [{ value: market, label: market || store.marketName }, ...MARKET_OPTIONS];

  const submit = () => {
    const textError = validatePromptText(form.text) ?? (blocked ? "This prompt already exists. Change the wording or the market." : null);
    if (textError) {
      setErrors({ text: textError });
      return;
    }
    setErrors({});
    onCreate({
      text: form.text,
      intent: form.intent,
      topic: form.topic,
      groupId: form.groupId || null,
      market,
      language,
      scope: form.scope,
      status: form.status,
      productIds: form.productIds,
      isCore: form.isCore,
      source: "manual",
    });
    toast.push({ ...simulatedToast("Prompt created"), description: `${form.text.trim()} · ${form.status}` });
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
        <CardBody className="flex flex-col gap-3">
          <Field label="Prompt text" required error={errors.text}>
            {({ id, describedBy, invalid }) => (
              <>
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  rows={3}
                  value={form.text}
                  placeholder={`e.g. What are the best ${profile.brands} in ${store.marketName || "your market"}?`}
                  onChange={(event) => {
                    set("text", event.target.value);
                    if (errors.text) setErrors({});
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-h-5 items-center">{form.text.trim() ? <PromptKind mentionsBrand={brandSpecific} /> : null}</span>
                  <CharCount value={form.text.length} max={MAX_PROMPT_LENGTH} />
                </div>
              </>
            )}
          </Field>
          {duplicate ? <DuplicateNotice match={duplicate} storeId={store.id} /> : null}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
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
          </div>

          <div>
            <button
              type="button"
              aria-expanded={more}
              aria-controls="more-options"
              onClick={() => setMore((open) => !open)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded text-body-sm font-medium text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Icon name={more ? "chevron-up" : "chevron-down"} size={14} />
              {more ? "Fewer options" : "More options"}
            </button>
            {more ? (
              <div id="more-options" className="mt-3 flex flex-col gap-3">
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
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
                      <Select id={id} value={market} onChange={(event) => set("market", event.target.value)}>
                        {markets.map((m) => (
                          <option key={m.value} value={m.value}>{m.label} ({m.value})</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Language">
                    {({ id }) => (
                      <Select id={id} value={language} onChange={(event) => set("language", event.target.value)}>
                        {LANGUAGE_OPTIONS.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span aria-hidden="true" className="text-body-sm font-medium text-fg">Runs in</span>
                  <RadioCards
                    label="Runs in"
                    columns={3}
                    value={form.scope}
                    onChange={(value: PromptScope) => set("scope", value)}
                    options={(Object.keys(SCOPE_LABEL) as PromptScope[]).map((value) => ({ value, label: SCOPE_LABEL[value] }))}
                  />
                </div>

                {products.length > 0 ? (
                  <FieldGroup legend="Offerings (optional)">
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
                  </FieldGroup>
                ) : null}

                <Checkbox label="Core prompt" description="Stable set for comparing over time." checked={form.isCore} onChange={(event) => set("isCore", event.target.checked)} />
              </div>
            ) : null}
          </div>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-helper text-fg-muted">
            {channels.length === 0 ? (
              "No AI provider selected yet. Results stay N/A."
            ) : (
              <>
                Runs on {channels.map((c) => c.providerLabel).join(", ")} once active.
                <Badge tone="neutral">{form.status === "draft" ? "Saved as draft" : form.status === "active" ? "Active" : "Paused"}</Badge>
              </>
            )}
          </p>
        </CardBody>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-card py-3">
          <ButtonLink href={base} variant="ghost">Cancel</ButtonLink>
          <Button type="submit" variant="primary" icon="plus">Create prompt</Button>
        </div>
      </form>

      <Dialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Templates" description="Filled with this website's brand and market." size="md">
        <ul className="flex flex-col gap-2">
          {templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => applyTemplate(template.id)}
                className="flex w-full cursor-pointer flex-col gap-1 rounded-control border border-line p-3 text-left transition-colors duration-[var(--dur-fast)] hover:border-accent hover:bg-accent-soft/40"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-body-sm font-medium text-fg [overflow-wrap:anywhere]">{template.title}</span>
                  <Badge tone="neutral">{INTENT_LABEL[template.intent]}</Badge>
                </span>
                <span className="text-body-sm text-fg-muted [overflow-wrap:anywhere]">{fillTemplate(template.text, profile)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </Card>
  );
}
