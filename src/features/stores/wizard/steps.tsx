"use client";

import { useRef, useState } from "react";

import { Badge, Chip, Status } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, KeyValue } from "@/components/ui/card";
import { ChipInput } from "@/components/ui/chip-input";
import { Spinner } from "@/components/ui/feedback";
import { Checkbox, Field, Input, RadioCards, Segmented, Select, Textarea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { PLATFORM_LABEL } from "@/lib/labels";
import type { AiChannel, StorePlatform } from "@/types/core";
import type { StoreSetupSample } from "@/types/settings";

import { COUNTRIES, INDUSTRIES, LANGUAGES, PLATFORM_ORDER, TIMEZONES } from "../options";
import { normalizeWebsite, validateOptionalUrl, validateRequired } from "../validation";
import { ChannelPicker } from "./channel-picker";
import type { ConnectionMethod, WizardForm } from "./model";

export type StepProps = {
  form: WizardForm;
  patch: (next: Partial<WizardForm>) => void;
  /** Visible error for a field (after blur or a failed Next). */
  error: (field: string) => string | undefined;
  blur: (field: string) => void;
  goTo: (step: number) => void;
};

/* ───────── 1. Basics ───────── */

export function BasicsStep({ form, patch, error, blur }: StepProps) {
  const site = normalizeWebsite(form.website);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
      <Field label="Store name" required error={error("name")}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="name" aria-describedby={describedBy} invalid={invalid} value={form.name} placeholder="RunPro Pakistan" autoComplete="off" onChange={(e) => patch({ name: e.target.value })} onBlur={() => blur("name")} />
        )}
      </Field>
      <Field
        label="Website"
        required
        error={error("website")}
        hint={site.host ? `Saved as ${site.host}` : "Domain or full address"}
      >
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="website" aria-describedby={describedBy} invalid={invalid} value={form.website} placeholder="runpro.pk" autoComplete="off" inputMode="url" onChange={(e) => patch({ website: e.target.value })} onBlur={() => blur("website")} />
        )}
      </Field>
      <Field label="Platform" className="md:col-span-1">
        {({ id, describedBy }) => (
          <Select id={id} name="platform" aria-describedby={describedBy} value={form.platform} onChange={(e) => patch({ platform: e.target.value as StorePlatform })}>
            {PLATFORM_ORDER.map((value) => (
              <option key={value} value={value}>{PLATFORM_LABEL[value]}</option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}

/* ───────── 2. Connection ───────── */

export function ConnectionStep({ form, patch, error, onAuthorize }: StepProps & { onAuthorize: () => void }) {
  const site = normalizeWebsite(form.website);
  const shop = `${(site.host ?? "your-store").split(".")[0]}.myshopify.com`;
  const setMethod = (value: ConnectionMethod) => patch(value === "shopify" ? { connection: value, platform: "shopify" } : { connection: value, shopifyState: "idle" });
  const connectionError = error("connection");

  return (
    <div className="flex flex-col gap-4">
      <div data-field="connection" tabIndex={-1} className="flex flex-col gap-2 outline-none">
        <RadioCards<ConnectionMethod | "woocommerce" | "wordpress" | "webflow">
          label="Connection method"
          value={form.connection}
          onChange={(value) => {
            if (value === "manual" || value === "shopify") setMethod(value);
          }}
          options={[
            { value: "manual", label: "Manual", description: "No connection. Fixes are guidance only." },
            { value: "shopify", label: "Shopify", description: "Per-store authorization. Read access first." },
            { value: "woocommerce", label: "WooCommerce", disabled: true, badge: <Badge>Later</Badge> },
            { value: "wordpress", label: "WordPress", disabled: true, badge: <Badge>Later</Badge> },
            { value: "webflow", label: "Webflow", disabled: true, badge: <Badge>Later</Badge> },
          ]}
        />
        {connectionError ? (
          <p role="alert" className="flex items-center gap-1 text-xs text-danger">
            <Icon name="alert-circle" size={13} />
            {connectionError}
          </p>
        ) : null}
      </div>

      {form.connection === "shopify" ? (
        <div className="rounded-control border border-line bg-surface-2/50 p-4">
          {form.shopifyState === "idle" ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-fg-muted">Authorize <span className="font-medium text-fg">{shop}</span> to read products and pages.</p>
              <Button variant="primary" icon="plug" onClick={onAuthorize}>Authorize Shopify</Button>
            </div>
          ) : null}
          {form.shopifyState === "authorizing" ? (
            <p className="flex items-center gap-2 text-[13px] text-fg-muted" role="status"><Spinner className="text-accent-text" />Waiting for Shopify to confirm</p>
          ) : null}
          {form.shopifyState === "authorized" ? (
            <div className="flex flex-col gap-3">
              <Callout tone="success" title="Shopify authorized">Simulated. No real connection was made.</Callout>
              <KeyValue
                columns={2}
                items={[
                  { label: "Shop", value: shop },
                  { label: "Granted scopes", value: <span className="flex flex-wrap gap-1.5"><Badge icon="check">read_products</Badge><Badge icon="check">read_content</Badge></span> },
                ]}
              />
              <Button variant="ghost" size="sm" className="self-start" onClick={() => patch({ shopifyState: "idle" })}>Disconnect</Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ───────── 3. Brand and market ───────── */

export function BrandStep({ form, patch, error, blur }: StepProps) {
  const onCountry = (code: string) => {
    const country = COUNTRIES.find((c) => c.code === code);
    patch({
      country: code,
      ...(country && !form.timezone ? { timezone: country.timezone } : {}),
      ...(country && !form.language ? { language: country.language } : {}),
    });
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
      <Field label="Brand name" required error={error("brandName")} hint="As customers write it">
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="brandName" aria-describedby={describedBy} invalid={invalid} value={form.brandName} autoComplete="off" onChange={(e) => patch({ brandName: e.target.value })} onBlur={() => blur("brandName")} />
        )}
      </Field>
      <Field label="Industry" required error={error("industry")}>
        {({ id, describedBy, invalid }) => (
          <Select id={id} name="industry" aria-describedby={describedBy} invalid={invalid} value={form.industry} onChange={(e) => patch({ industry: e.target.value })} onBlur={() => blur("industry")}>
            <option value="">Choose industry</option>
            {INDUSTRIES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </Select>
        )}
      </Field>
      <ChipInput className="md:col-span-2" label="Aliases" hint="Other spellings. Press Enter to add." placeholder="Run Pro" values={form.aliases} onChange={(aliases) => patch({ aliases })} />
      <Field className="md:col-span-2" label="Description" error={error("description")} hint={`${form.description.length} / 400`}>
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} name="description" aria-describedby={describedBy} invalid={invalid} rows={3} value={form.description} placeholder="What the brand sells and who for" onChange={(e) => patch({ description: e.target.value })} onBlur={() => blur("description")} />
        )}
      </Field>
      <Field label="Country" required error={error("country")}>
        {({ id, describedBy, invalid }) => (
          <Select id={id} name="country" aria-describedby={describedBy} invalid={invalid} value={form.country} onChange={(e) => onCountry(e.target.value)} onBlur={() => blur("country")}>
            <option value="">Choose country</option>
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
      <Field label="Time zone" required error={error("timezone")} hint="Used for schedules and reports">
        {({ id, describedBy, invalid }) => (
          <Select id={id} name="timezone" aria-describedby={describedBy} invalid={invalid} value={form.timezone} onChange={(e) => patch({ timezone: e.target.value })} onBlur={() => blur("timezone")}>
            <option value="">Choose time zone</option>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}

/* ───────── 4. Products and services ───────── */

export function ProductsStep({ form, patch, sample, goTo }: StepProps & { sample: StoreSetupSample }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});
  const counter = useRef(0);
  const shopifyReady = form.connection === "shopify" && form.shopifyState === "authorized";

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
    <div className="flex flex-col gap-4">
      <Segmented
        label="Product source"
        value={form.productSource}
        onChange={(value) => patch({ productSource: value })}
        options={[
          { value: "manual", label: "Add manually", icon: "pencil" },
          { value: "shopify", label: "From Shopify", icon: "plug" },
        ]}
      />

      {form.productSource === "manual" ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-start">
            <Field label="Name" error={errors.title}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} invalid={invalid} value={title} placeholder="Glide 2" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
              )}
            </Field>
            <Field label="Category">
              {({ id }) => <Input id={id} value={category} placeholder="Road running" onChange={(e) => setCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />}
            </Field>
            <Field label="Page address" error={errors.url}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="url" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
              )}
            </Field>
            <Button variant="secondary" icon="plus" className="md:mt-[26px]" onClick={add}>Add</Button>
          </div>

          {form.products.length === 0 ? (
            <p className="rounded-control border border-dashed border-line-strong px-3 py-4 text-center text-[13px] text-fg-muted">No products yet. You can add them later.</p>
          ) : (
            <ul className="divide-y divide-line rounded-control border border-line">
              {form.products.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg">{product.title}</p>
                    <p className="truncate text-xs text-fg-subtle">{[product.category, product.url].filter(Boolean).join(" · ") || "No details"}</p>
                  </div>
                  <IconButton icon="trash" label={`Remove ${product.title}`} size="sm" onClick={() => patch({ products: form.products.filter((p) => p.id !== product.id) })} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : shopifyReady ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="info" icon="plug">Imported from Shopify · sample</Badge>
            <span className="tnum text-xs text-fg-subtle">{form.shopifySelected.length} of {sample.shopifyProducts.length} selected</span>
          </div>
          <ul className="divide-y divide-line rounded-control border border-line">
            {sample.shopifyProducts.map((product) => (
              <li key={product.id} className="px-3 py-2">
                <Checkbox
                  checked={form.shopifySelected.includes(product.id)}
                  onChange={(e) => patch({ shopifySelected: e.target.checked ? [...form.shopifySelected, product.id] : form.shopifySelected.filter((id) => id !== product.id) })}
                  label={product.title}
                  description={product.category}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Callout tone="info" title="Shopify is not connected" actions={<Button size="sm" onClick={() => goTo(1)}>Go to Connection</Button>} />
      )}
    </div>
  );
}

/* ───────── 5. Competitors ───────── */

export function CompetitorsStep({ form, patch }: StepProps) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [errors, setErrors] = useState<{ name?: string; domain?: string }>({});
  const counter = useRef(0);

  const confirmed = form.competitors.filter((c) => c.state === "confirmed");
  const suggested = form.competitors.filter((c) => c.state === "suggested");
  const dismissed = form.competitors.filter((c) => c.state === "dismissed");
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

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="comp-confirmed" className="flex flex-col gap-2">
        <h3 id="comp-confirmed" className="text-[13px] font-semibold text-fg">Confirmed <span className="tnum font-normal text-fg-subtle">{confirmed.length}</span></h3>
        {confirmed.length === 0 ? (
          <p className="rounded-control border border-dashed border-line-strong px-3 py-3 text-[13px] text-fg-muted">None yet. Confirm a suggestion or add one.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {confirmed.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-fg">{c.name}</p>
                  <p className="truncate text-xs text-fg-subtle">{c.domain}</p>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton icon="x" label={`Remove ${c.name} from confirmed`} size="sm" onClick={() => (c.reason === "Added by you" ? patch({ competitors: form.competitors.filter((x) => x.id !== c.id) }) : setState(c.id, "suggested"))} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="comp-suggested" className="flex flex-col gap-2">
        <h3 id="comp-suggested" className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
          Suggested <span className="tnum font-normal text-fg-subtle">{suggested.length}</span>
          <Badge tone="neutral" icon="sparkles">Demo suggestions</Badge>
        </h3>
        {suggested.length === 0 ? (
          <p className="rounded-control border border-dashed border-line-strong px-3 py-3 text-[13px] text-fg-muted">No suggestions left.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {suggested.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-fg">{c.name}</p>
                  <p className="truncate text-xs text-fg-subtle">{c.domain} · {c.reason}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="secondary" icon="check" onClick={() => setState(c.id, "confirmed")}>Confirm</Button>
                  <Button size="sm" variant="ghost" onClick={() => setState(c.id, "dismissed")}>Dismiss</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {dismissed.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
            <span>Dismissed:</span>
            {dismissed.map((c) => (
              <Chip key={c.id}>
                {c.name}
                <button type="button" onClick={() => setState(c.id, "suggested")} className="ml-1 cursor-pointer rounded px-1 text-accent-text hover:underline">Restore</button>
              </Chip>
            ))}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="comp-add" className="flex flex-col gap-2">
        <h3 id="comp-add" className="text-[13px] font-semibold text-fg">Add a competitor</h3>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start">
          <Field label="Name" error={errors.name}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
            )}
          </Field>
          <Field label="Website" error={errors.domain}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="url" value={domain} placeholder="competitor.com" onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
            )}
          </Field>
          <Button variant="secondary" icon="plus" className="md:mt-[26px]" onClick={add}>Add</Button>
        </div>
      </section>
    </div>
  );
}

/* ───────── 6. AI channels + review ───────── */

export function ChannelsStep({ form, patch, error, channels }: StepProps & { channels: AiChannel[] }) {
  return (
    <div className="flex flex-col gap-6">
      <ChannelPicker
        channels={channels}
        selected={form.channelIds}
        onChange={(channelIds) => patch({ channelIds })}
        trackingMode={form.trackingMode}
        onTrackingModeChange={(trackingMode) => patch({ trackingMode })}
        error={error("channels")}
      />

      <div className="rounded-control border border-line bg-surface-2/50 p-3">
        <p className="mb-2 text-xs font-medium text-fg-muted">Store status</p>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <li className="flex items-center gap-1.5"><Status kind="store" value="draft" /><span className="text-xs text-fg-subtle">setup incomplete</span></li>
          <Icon name="chevron-right" size={14} className="text-line-strong" />
          <li className="flex items-center gap-1.5"><Status kind="store" value="ready" /><span className="text-xs text-fg-subtle">setup complete</span></li>
          <Icon name="chevron-right" size={14} className="text-line-strong" />
          <li className="flex items-center gap-1.5"><Status kind="store" value="active" /><span className="text-xs text-fg-subtle">tracking on</span></li>
        </ol>
      </div>
    </div>
  );
}
