"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ErrorSummary } from "@/components/ui/error-summary";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { canAddWebsite, useWorkspace } from "@/features/session/session";
import { api, ApiRequestError, newIdempotencyKey } from "@/lib/api-client";
import { SITE_TYPE_ORDER, siteTypeLabel } from "@/lib/labels";
import { countryName, LANGUAGE_CODES, languageName, MARKETS } from "@/lib/locale-options";

import { useWebsites, type Website } from "./websites-data";

type Values = {
  name: string;
  domain: string;
  siteType: string;
  market: string;
  language: string;
  timezone: string;
  businessCategory: string;
  businessDescription: string;
};

const LABELS: Record<keyof Values, string> = {
  name: "Name",
  domain: "Website address",
  siteType: "Site type",
  market: "Market",
  language: "Language",
  timezone: "Time zone",
  businessCategory: "Business category",
  businessDescription: "Description",
};

export function AddWebsite() {
  const router = useRouter();
  const { organization } = useWorkspace();
  const { reload } = useWebsites();
  const [values, setValues] = useState<Values>({
    name: "",
    domain: "",
    siteType: "",
    market: "",
    language: "en",
    timezone: organization.timezone,
    businessCategory: "",
    businessDescription: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef({ body: "", id: "" });
  const summaryRef = useRef<HTMLDivElement>(null);
  const fieldId = (name: keyof Values) => `website-${name}`;
  const set = (name: keyof Values) => (value: string) => setValues((current) => ({ ...current, [name]: value }));
  const zones = Intl.supportedValuesOf("timeZone");

  if (!canAddWebsite(organization.role)) {
    return (
      <>
        <PageHeader title="Add website" />
        <EmptyState icon="lock" title="Only an owner or admin can add websites" action={<ButtonLink href="/stores">Go to websites</ButtonLink>} />
      </>
    );
  }

  const chooseMarket = (code: string) => {
    const preset = MARKETS.find((item) => item.code === code);
    setValues((current) => ({ ...current, market: code, ...(preset ? { language: preset.language, timezone: preset.timezone } : {}) }));
  };

  const showErrors = (found: Record<string, string>) => {
    setErrors(found);
    window.setTimeout(() => summaryRef.current?.focus(), 0);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (values.name.trim().length < 2) found.name = "Enter a name of at least 2 characters.";
    if (!values.domain.trim()) found.domain = "Enter the website address.";
    if (!values.siteType) found.siteType = "Choose a site type.";
    if (!values.market) found.market = "Choose a country.";
    if (Object.keys(found).length) return showErrors(found);
    setErrors({});
    setError(null);
    setBusy(true);
    const body = {
      organizationId: organization.id,
      name: values.name,
      domain: values.domain,
      siteType: values.siteType,
      market: values.market,
      language: values.language,
      timezone: values.timezone,
      businessCategory: values.businessCategory.trim() || null,
      businessDescription: values.businessDescription.trim() || null,
    };
    // The same details sent twice use the same key, so a retry cannot add the website again.
    const serialized = JSON.stringify(body);
    if (key.current.body !== serialized) key.current = { body: serialized, id: newIdempotencyKey() };
    try {
      const website = await api<Website>("/api/v1/websites", { method: "POST", body, idempotencyKey: key.current.id });
      await reload();
      router.push(`/stores/${website.id}`);
    } catch (failure) {
      if (failure instanceof ApiRequestError && Object.keys(failure.fields).length) showErrors(failure.fields);
      else setError(failure instanceof ApiRequestError ? failure.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const errorList = Object.entries(errors).filter(([name]) => name in LABELS) as [keyof Values, string][];

  return (
    <>
      <PageHeader title="Add website" />
      <Card className="max-w-2xl">
        <CardBody>
          <form noValidate onSubmit={submit} className="flex flex-col gap-3">
            {errorList.length ? (
              <ErrorSummary ref={summaryRef} items={errorList.map(([name, detail]) => ({ label: LABELS[name], detail, targetId: fieldId(name) }))} />
            ) : null}
            {error ? <p role="alert" className="rounded-control border border-line border-l-[3px] border-l-danger bg-surface-2 px-3 py-2 text-body-sm text-fg">{error}</p> : null}
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              <Field id={fieldId("name")} label={LABELS.name} required error={errors.name}>
                {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={values.name} onChange={(e) => set("name")(e.target.value)} />}
              </Field>
              <Field id={fieldId("domain")} label={LABELS.domain} required error={errors.domain}>
                {({ id, describedBy, invalid }) => <Input id={id} inputMode="url" autoCapitalize="none" placeholder="example.com" aria-describedby={describedBy} invalid={invalid} value={values.domain} onChange={(e) => set("domain")(e.target.value)} />}
              </Field>
              <Field id={fieldId("siteType")} label={LABELS.siteType} required error={errors.siteType}>
                {({ id, describedBy, invalid }) => (
                  <Select id={id} aria-describedby={describedBy} invalid={invalid} value={values.siteType} onChange={(e) => set("siteType")(e.target.value)}>
                    <option value="">Choose…</option>
                    {SITE_TYPE_ORDER.map((type) => <option key={type} value={type}>{siteTypeLabel(type)}</option>)}
                  </Select>
                )}
              </Field>
              <Field id={fieldId("market")} label={LABELS.market} required error={errors.market}>
                {({ id, describedBy, invalid }) => (
                  <Select id={id} aria-describedby={describedBy} invalid={invalid} value={values.market} onChange={(e) => chooseMarket(e.target.value)}>
                    <option value="">Choose…</option>
                    {MARKETS.map(({ code }) => <option key={code} value={code}>{countryName(code)}</option>)}
                  </Select>
                )}
              </Field>
              <Field id={fieldId("language")} label={LABELS.language} error={errors.language}>
                {({ id, describedBy, invalid }) => (
                  <Select id={id} aria-describedby={describedBy} invalid={invalid} value={values.language} onChange={(e) => set("language")(e.target.value)}>
                    {LANGUAGE_CODES.map((code) => <option key={code} value={code}>{languageName(code)}</option>)}
                  </Select>
                )}
              </Field>
              <Field id={fieldId("timezone")} label={LABELS.timezone} error={errors.timezone}>
                {({ id, describedBy, invalid }) => (
                  <Select id={id} aria-describedby={describedBy} invalid={invalid} value={values.timezone} onChange={(e) => set("timezone")(e.target.value)}>
                    {(zones.includes(values.timezone) ? zones : [values.timezone, ...zones]).map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                  </Select>
                )}
              </Field>
            </div>
            <Field id={fieldId("businessCategory")} label={LABELS.businessCategory} error={errors.businessCategory}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} maxLength={80} value={values.businessCategory} onChange={(e) => set("businessCategory")(e.target.value)} />}
            </Field>
            <Field id={fieldId("businessDescription")} label={LABELS.businessDescription} error={errors.businessDescription}>
              {({ id, describedBy, invalid }) => <Textarea id={id} rows={3} maxLength={1000} aria-describedby={describedBy} invalid={invalid} value={values.businessDescription} onChange={(e) => set("businessDescription")(e.target.value)} />}
            </Field>
            <div className="flex items-center justify-end gap-2">
              <ButtonLink href="/stores" variant="ghost">Cancel</ButtonLink>
              <Button type="submit" variant="primary" loading={busy}>Add website</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
