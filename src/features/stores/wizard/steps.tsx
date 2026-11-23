"use client";

import { useRef, useState, type ReactNode } from "react";

import { Badge, Chip } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, KeyValue } from "@/components/ui/card";
import { ChipInput } from "@/components/ui/chip-input";
import { Field, Input, RadioCards, Select, Switch, Textarea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { SITE_TYPE_ORDER, siteTypeLabel } from "@/lib/labels";
import type { AiChannel } from "@/types/core";
import type { StoreSetupSample } from "@/types/settings";

import { CONNECTOR_NOTE, CONNECTOR_OPTIONS, type ConnectorChoice } from "../connectors";
import { COUNTRIES, INDUSTRIES, LANGUAGES } from "../options";
import { normalizeWebsite, validateOptionalUrl, validateRequired } from "../validation";
import { ChannelPicker } from "./channel-picker";
import { buildChecklist, startingStatus, type WizardForm } from "./model";
import { STATUS } from "@/lib/status";

export type StepProps = {
  form: WizardForm;
  patch: (next: Partial<WizardForm>) => void;
  /** Visible error for a field (after blur or a failed Next). */
  error: (field: string) => string | undefined;
  blur: (field: string) => void;
};

/* ───────── 1. Basics ───────── */

export function BasicsStep({ form, patch, error, blur }: StepProps) {
  const site = normalizeWebsite(form.website);
  const onName = (name: string) => patch({ name, ...(form.brandName === "" || form.brandName === form.name ? { brandName: name } : {}) });
  const onCountry = (code: string) => {
    const country = COUNTRIES.find((c) => c.code === code);
    patch({ country: code, ...(country ? { timezone: country.timezone, language: form.language || country.language } : {}) });
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
      <Field label="Website name" required error={error("name")}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="name" aria-describedby={describedBy} invalid={invalid} value={form.name} placeholder="Northwind Studio" autoComplete="off" onChange={(e) => onName(e.target.value)} onBlur={() => blur("name")} />
        )}
      </Field>
      <Field label="Domain" required error={error("website")} hint={site.host ? `Saved as ${site.host}` : "Domain or full address"}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="website" aria-describedby={describedBy} invalid={invalid} value={form.website} placeholder="northwind.com" autoComplete="off" inputMode="url" onChange={(e) => patch({ website: e.target.value })} onBlur={() => blur("website")} />
        )}
      </Field>
      <Field label="Brand name" required error={error("brandName")} hint="As customers write it">
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="brandName" aria-describedby={describedBy} invalid={invalid} value={form.brandName} autoComplete="off" onChange={(e) => patch({ brandName: e.target.value })} onBlur={() => blur("brandName")} />
        )}
      </Field>
      <Field label="Site type" required error={error("siteType")}>
        {({ id, describedBy, invalid }) => (
          <Select id={id} name="siteType" aria-describedby={describedBy} invalid={invalid} value={form.siteType} onChange={(e) => patch({ siteType: e.target.value as WizardForm["siteType"] })}>
            {SITE_TYPE_ORDER.map((value) => (
              <option key={value} value={value}>{siteTypeLabel(value)}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Market" required error={error("country")}>
        {({ id, describedBy, invalid }) => (
          <Select id={id} name="country" aria-describedby={describedBy} invalid={invalid} value={form.country} onChange={(e) => onCountry(e.target.value)} onBlur={() => blur("country")}>
            <option value="">Choose market</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Language" required error={error("language")}>
        {({ id, describedBy, invalid }) => (
          <Select id={id} name="language" aria-describedby={describedBy} invalid={invalid} value={form.language} onChange={(e) => patch({ language: e.target.value })} onBlur={() => blur("language")}>
            <option value="">Choose language</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}

/* ───────── 2. Brand profile ───────── */

function Disclosure({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <details className="group rounded-control border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-body font-medium text-fg [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {title}
          <span className="text-helper font-normal text-fg-muted">Optional</span>
          {count > 0 ? <Badge tone="accent">{count} added</Badge> : null}
        </span>
        <Icon name="chevron-down" size={16} className="text-fg-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-line p-3.5">{children}</div>
    </details>
  );
}

function CompetitorsBlock({ form, patch, sample }: { form: WizardForm; patch: StepProps["patch"]; sample: StoreSetupSample }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [errors, setErrors] = useState<{ name?: string; domain?: string }>({});
  const counter = useRef(0);
  const [offered, setOffered] = useState(false);

  const confirmed = form.competitors.filter((c) => c.state === "confirmed");
  const suggested = form.competitors.filter((c) => c.state === "suggested");
  const setState = (id: string, state: "confirmed" | "suggested" | "dismissed") => patch({ competitors: form.competitors.map((c) => (c.id === id ? { ...c, state } : c)) });

  const add = () => {
    const site = normalizeWebsite(domain);
    const next = { name: validateRequired(name, "Name", 2, 80) ?? undefined, domain: site.error };
    setErrors(next);
    if (next.name || next.domain || !site.host) return;
    counter.current += 1;
    patch({ competitors: [...form.competitors, { id: `added-${counter.current}`, name: name.trim(), domain: site.host, reason: "Added by you", state: "confirmed" }] });
    setName("");
    setDomain("");
  };

  const loadSuggestions = () => {
    setOffered(true);
    const known = new Set(form.competitors.map((c) => c.domain));
    patch({ competitors: [...form.competitors, ...sample.suggestedCompetitors.filter((c) => !known.has(c.domain)).map((c) => ({ ...c, state: "suggested" as const }))] });
  };

  return (
    <section aria-labelledby="wiz-competitors" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="wiz-competitors" className="text-body font-semibold text-fg">Competitors <span className="text-helper font-normal text-fg-muted">Optional</span></h3>
        {!offered && suggested.length === 0 ? <Button size="sm" variant="ghost" icon="sparkles" onClick={loadSuggestions}>Show demo suggestions</Button> : null}
      </div>

      {confirmed.length > 0 ? (
        <ul className="divide-y divide-line rounded-control border border-line">
          {confirmed.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-body-sm font-medium text-fg">{c.name}</p>
                <p className="truncate text-helper text-fg-muted">{c.domain}</p>
              </div>
              <IconButton icon="x" label={`Remove ${c.name}`} size="sm" onClick={() => patch({ competitors: form.competitors.filter((x) => x.id !== c.id) })} />
            </li>
          ))}
        </ul>
      ) : null}

      {suggested.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-label font-medium text-fg-muted">Suggested <Badge tone="neutral" icon="sparkles">Demo suggestions</Badge></p>
          <ul className="divide-y divide-line rounded-control border border-line">
            {suggested.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-fg">{c.name}</p>
                  <p className="truncate text-helper text-fg-muted">{c.domain} · {c.reason}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="secondary" icon="check" onClick={() => setState(c.id, "confirmed")}>Confirm</Button>
                  <Button size="sm" variant="ghost" onClick={() => setState(c.id, "dismissed")}>Dismiss</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start">
        <Field label="Competitor name" error={errors.name}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />}
        </Field>
        <Field label="Competitor domain" error={errors.domain}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="url" value={domain} placeholder="competitor.com" onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />}
        </Field>
        <Button variant="secondary" icon="plus" className="md:mt-[26px]" onClick={add}>Add</Button>
      </div>
    </section>
  );
}

function OfferingsBlock({ form, patch }: { form: WizardForm; patch: StepProps["patch"] }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});
  const counter = useRef(0);
  const add = () => {
    const next = { title: validateRequired(title, "Name", 2, 120) ?? undefined, url: validateOptionalUrl(url) ?? undefined };
    setErrors(next);
    if (next.title || next.url) return;
    counter.current += 1;
    patch({ products: [...form.products, { id: `manual-${counter.current}`, title: title.trim(), category: category.trim(), url: url.trim() }] });
    setTitle("");
    setCategory("");
    setUrl("");
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-label font-medium text-fg">Products or services</p>
      {form.products.length > 0 ? (
        <ul className="divide-y divide-line rounded-control border border-line">
          {form.products.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-body-sm font-medium text-fg">{product.title}</p>
                <p className="truncate text-helper text-fg-muted">{[product.category, product.url].filter(Boolean).join(" · ") || "No details"}</p>
              </div>
              <IconButton icon="trash" label={`Remove ${product.title}`} size="sm" onClick={() => patch({ products: form.products.filter((p) => p.id !== product.id) })} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-start">
        <Field label="Name" error={errors.title}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />}
        </Field>
        <Field label="Category">
          {({ id }) => <Input id={id} value={category} onChange={(e) => setCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />}
        </Field>
        <Field label="Page address" error={errors.url}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="url" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />}
        </Field>
        <Button variant="secondary" icon="plus" className="md:mt-[26px]" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

function FactsBlock({ form, patch }: { form: WizardForm; patch: StepProps["patch"] }) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const counter = useRef(0);
  const addFact = () => {
    if (!label.trim() || !value.trim()) return;
    counter.current += 1;
    patch({ facts: [...form.facts, { id: `fact-${counter.current}`, label: label.trim(), value: value.trim(), sourceUrl: "" }] });
    setLabel("");
    setValue("");
  };
  const addFaq = () => {
    if (!question.trim() || !answer.trim()) return;
    counter.current += 1;
    patch({ faqs: [...form.faqs, { id: `faq-${counter.current}`, question: question.trim(), answer: answer.trim() }] });
    setQuestion("");
    setAnswer("");
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        <p className="text-label font-medium text-fg">Brand facts</p>
        {form.facts.length > 0 ? (
          <ul className="divide-y divide-line rounded-control border border-line">
            {form.facts.map((fact) => (
              <li key={fact.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <p className="min-w-0 truncate text-body-sm text-fg"><span className="font-medium">{fact.label}:</span> {fact.value}</p>
                <IconButton icon="trash" label={`Remove ${fact.label}`} size="sm" onClick={() => patch({ facts: form.facts.filter((f) => f.id !== fact.id) })} />
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-start">
          <Field label="Label">{({ id }) => <Input id={id} value={label} placeholder="Founded" onChange={(e) => setLabel(e.target.value)} />}</Field>
          <Field label="Fact">{({ id }) => <Input id={id} value={value} placeholder="Family-run since 2019" onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFact())} />}</Field>
          <Button variant="secondary" icon="plus" className="md:mt-[26px]" onClick={addFact}>Add</Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-label font-medium text-fg">FAQs</p>
        {form.faqs.length > 0 ? (
          <ul className="divide-y divide-line rounded-control border border-line">
            {form.faqs.map((faq) => (
              <li key={faq.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-fg">{faq.question}</p>
                  <p className="truncate text-helper text-fg-muted">{faq.answer}</p>
                </div>
                <IconButton icon="trash" label={`Remove ${faq.question}`} size="sm" onClick={() => patch({ faqs: form.faqs.filter((f) => f.id !== faq.id) })} />
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start">
          <Field label="Question">{({ id }) => <Input id={id} value={question} onChange={(e) => setQuestion(e.target.value)} />}</Field>
          <Field label="Answer">{({ id }) => <Input id={id} value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFaq())} />}</Field>
          <Button variant="secondary" icon="plus" className="md:mt-[26px]" onClick={addFaq}>Add</Button>
        </div>
      </div>
    </div>
  );
}

export function BrandStep({ form, patch, error, blur, sample }: StepProps & { sample: StoreSetupSample }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
        <Field label="Category" required error={error("category")}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} name="category" aria-describedby={describedBy} invalid={invalid} value={form.category} onChange={(e) => patch({ category: e.target.value })} onBlur={() => blur("category")}>
              <option value="">Choose category</option>
              {INDUSTRIES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          )}
        </Field>
        <ChipInput label="Aliases" hint="Other spellings. Press Enter to add." placeholder="North Wind" values={form.aliases} onChange={(aliases) => patch({ aliases })} />
        <Field className="md:col-span-2" label="Description" error={error("description")} hint={`${form.description.length} / 400`}>
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} name="description" aria-describedby={describedBy} invalid={invalid} rows={3} value={form.description} placeholder="What the brand offers and who for" onChange={(e) => patch({ description: e.target.value })} onBlur={() => blur("description")} />
          )}
        </Field>
      </div>

      <CompetitorsBlock form={form} patch={patch} sample={sample} />

      <div className="flex flex-col gap-3">
        <Disclosure title="Products and services" count={form.products.length}>
          <OfferingsBlock form={form} patch={patch} />
        </Disclosure>
        <Disclosure title="Facts and FAQs" count={form.facts.length + form.faqs.length}>
          <FactsBlock form={form} patch={patch} />
        </Disclosure>
      </div>
    </div>
  );
}

/* ───────── 3. Connections (all optional) ───────── */

export function ConnectionsStep({ form, patch, channels }: StepProps & { channels: AiChannel[] }) {
  const options: { value: ConnectorChoice | "none"; label: string; description?: string }[] = [
    { value: "none", label: "None", description: "Fixes are guidance only." },
    ...CONNECTOR_OPTIONS.map((value) => ({ value, label: siteTypeLabel(value), description: CONNECTOR_NOTE[value] })),
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <p className="text-label font-medium text-fg">Publishing connector <span className="font-normal text-fg-muted">Optional</span></p>
        <RadioCards<ConnectorChoice | "none"> label="Publishing connector" value={form.connector} onChange={(connector) => patch({ connector })} options={options} columns={3} />
        <p className="flex items-center gap-1.5 text-helper text-fg-muted"><Icon name="info" size={13} />Authorization is simulated. No real connection is made.</p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-control border border-line p-3.5">
        <div className="min-w-0">
          <p className="text-body font-medium text-fg">Search Console <span className="text-helper font-normal text-fg-muted">Optional</span></p>
          <p className="text-helper text-fg-muted">Search queries for prompt ideas.</p>
        </div>
        <Switch checked={form.searchConsole} onChange={(searchConsole) => patch({ searchConsole })} label="Connect Search Console (simulated)" />
      </div>

      <details className="group rounded-control border border-line" open={form.channelIds.length > 0}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-body font-medium text-fg [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            AI channels <span className="text-helper font-normal text-fg-muted">Optional</span>
            {form.channelIds.length > 0 ? <Badge tone="accent">{form.channelIds.length} selected</Badge> : null}
          </span>
          <Icon name="chevron-down" size={16} className="text-fg-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-line p-3.5">
          <ChannelPicker channels={channels} selected={form.channelIds} onChange={(channelIds) => patch({ channelIds })} trackingMode={form.trackingMode} onTrackingModeChange={(trackingMode) => patch({ trackingMode })} />
        </div>
      </details>
    </div>
  );
}

/* ───────── 4. Review ───────── */

export function ReviewStep({ form, channels }: { form: WizardForm; channels: AiChannel[] }) {
  const site = normalizeWebsite(form.website);
  const country = COUNTRIES.find((c) => c.code === form.country);
  const status = startingStatus(form, false);
  const checklist = buildChecklist(form);
  const picked = channels.filter((c) => form.channelIds.includes(c.id)).map((c) => c.providerLabel);
  return (
    <div className="flex flex-col gap-3">
      <KeyValue
        columns={2}
        items={[
          { label: "Website", value: form.name.trim() || "Not set" },
          { label: "Domain", value: site.host ?? "Not set" },
          { label: "Brand", value: form.brandName.trim() || "Not set" },
          { label: "Site type", value: siteTypeLabel(form.siteType) },
          { label: "Market", value: country ? `${country.name} · ${form.language.toUpperCase()}` : "Not set" },
          { label: "Category", value: form.category || "Not set" },
          { label: "Competitors", value: `${form.competitors.filter((c) => c.state === "confirmed").length} confirmed` },
          { label: "Publishing connector", value: form.connector === "none" ? "None" : siteTypeLabel(form.connector) },
          { label: "Search Console", value: form.searchConsole ? "Connected (simulated)" : "Not connected" },
          { label: "AI channels", value: picked.length ? picked.join(", ") : "None yet" },
        ]}
      />
      <ul className="flex flex-col gap-1.5">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-body-sm">
            <Icon name={item.state === "done" ? "check-circle" : "circle"} size={15} className={item.state === "done" ? "text-success-icon" : "text-fg-faint"} />
            <span className="text-fg">{item.label}</span>
            <span className="text-fg-muted">{item.detail}</span>
          </li>
        ))}
      </ul>
      <Callout tone={status === "ready" ? "success" : "info"} title={`Starts as ${STATUS.store[status].label}`}>
        {form.channelIds.length === 0 ? "Choose an AI channel later in Website settings to start tracking." : "Run an audit to see the first results."} Stored in this browser only.
      </Callout>
      {form.aliases.length > 0 ? (
        <p className="flex flex-wrap items-center gap-1.5 text-helper text-fg-muted">Aliases {form.aliases.map((a) => <Chip key={a}>{a}</Chip>)}</p>
      ) : null}
    </div>
  );
}
