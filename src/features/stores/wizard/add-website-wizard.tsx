"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { WizardFrame } from "@/components/ui/wizard";
import { demoNow, demoStore, simulatedToast, useDemoCollection } from "@/demo-state";
import { cn } from "@/lib/cn";
import type { AiChannel, Store } from "@/types/core";
import type { StoreSetupSample } from "@/types/settings";

import { settingKey } from "../settings/keys";
import { BasicsStep, BrandStep, ConnectionsStep, ReviewStep, type StepProps } from "./steps";
import { LAST_STEP, STEPS, allErrors, type ExistingWebsite, buildChecklist, buildSettingsDocs, formToWebsite, initialForm, requiredComplete, startingStatus, stepErrors, type Errors, type WizardForm } from "./model";

const NO_WEBSITES: Store[] = [];
const STEP_TITLE = ["Basics", "Brand profile", "Connections", "Review"];
const STEP_SUBTITLE = ["Who and where", "What the brand is", "All optional", "Check and create"];

const FIELD_LABEL: Record<string, string> = {
  name: "Website name",
  website: "Domain",
  brandName: "Brand name",
  country: "Market",
  language: "Language",
  siteType: "Site type",
  category: "Category",
  description: "Description",
};

/** Four steps that really create a website in demo-state: it then shows in the selector, list and search. */
export function AddWebsiteWizard({ channels, sample, existing }: { channels: AiChannel[]; sample: StoreSetupSample; existing: ExistingWebsite[] }) {
  const router = useRouter();
  const toast = useToast();
  const { rows: localWebsites, create } = useDemoCollection<Store>("websites", NO_WEBSITES);
  // Seeded websites plus the ones made in this browser: a second website on the same domain is refused.
  const taken = useMemo(() => [...existing, ...localWebsites.map((w) => ({ name: w.name, domain: w.domain }))], [existing, localWebsites]);
  const [form, setForm] = useState<WizardForm>(initialForm);
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  const [creating, setCreating] = useState(false);

  const patch = (next: Partial<WizardForm>) => setForm((current) => ({ ...current, ...next }));
  const errors = stepErrors(step, form, taken);
  const visible = (field: string) => (touched[field] || attempted[step] ? errors[field] : undefined);
  const blur = (field: string) => setTouched((current) => ({ ...current, [field]: true }));
  const issues = attempted[step] ? Object.entries(errors).map(([field, message]) => ({ message: `${FIELD_LABEL[field] ?? field}: ${message}` })) : [];

  const mark = (target: number) => {
    setStep(target);
    setAttempted((current) => ({ ...current, [target]: true }));
  };

  const next = () => {
    if (Object.keys(errors).length > 0) return mark(step);
    setStep(step + 1);
  };

  const submit = (draft: boolean) => {
    if (draft) {
      const basics: Errors = stepErrors(0, form, taken);
      const needed = ["name", "website"].filter((field) => basics[field]);
      if (needed.length > 0) {
        mark(0);
        return;
      }
    } else {
      const failing = allErrors(form, taken)[0];
      if (failing) return mark(failing.step);
    }
    setCreating(true);
    const now = demoNow();
    const row = create(formToWebsite(form, startingStatus(form, draft), now), (r) => ({
      kind: "website.created",
      label: `Website created: ${form.name.trim()}`,
      refs: { websiteId: r.id },
    }));
    const docs = buildSettingsDocs(row.id, form, now);
    demoStore.setSetting(settingKey(row.id, "brand"), docs.brand);
    demoStore.setSetting(settingKey(row.id, "knowledge"), docs.knowledge);
    demoStore.setSetting(settingKey(row.id, "competitors"), docs.competitors);
    demoStore.setSetting(settingKey(row.id, "products"), docs.products);
    demoStore.setSetting(settingKey(row.id, "integrations"), docs.integrations);
    demoStore.setSetting(settingKey(row.id, "domains"), docs.domains);
    demoStore.setSetting(settingKey(row.id, "activity"), docs.activity);
    demoStore.setSetting(settingKey(row.id, "tracking"), { trackingMode: form.trackingMode });
    toast.push({ ...simulatedToast(draft ? "Draft saved" : "website.created"), description: draft ? undefined : `${form.name.trim()} is now in your websites.` });
    router.push(`/stores/${row.id}`);
  };

  const stepProps: StepProps = { form, patch, error: visible, blur };
  const checklist = buildChecklist(form, taken);
  const complete = requiredComplete(form, taken);

  return (
    <WizardFrame
      steps={[...STEPS]}
      current={step}
      title={STEP_TITLE[step]}
      subtitle={STEP_SUBTITLE[step]}
      onStepClick={(index) => (index < step ? setStep(index) : undefined)}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      issues={issues}
      primary={step === LAST_STEP ? { label: "Create website", onClick: () => submit(false), loading: creating } : { label: "Next", onClick: next }}
      secondary={<Button variant="ghost" onClick={() => submit(true)} disabled={creating}>Save draft</Button>}
      aside={
        <Card>
          <CardHeader title="Summary" actions={<Status kind="store" value={complete ? (form.channelIds.length > 0 ? "ready" : "needs_review") : "draft"} />} />
          <CardBody>
            <ol className="flex flex-col gap-2.5">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5">
                  <Icon name={item.state === "done" ? "check-circle" : "circle"} size={16} className={cn("mt-0.5 shrink-0", item.state === "done" ? "text-success-icon" : item.step === step ? "text-accent" : "text-fg-faint")} />
                  <div className="min-w-0">
                    <p className={cn("text-body-sm", item.step === step ? "font-semibold text-fg" : "text-fg")}>{item.label}</p>
                    <p className="truncate text-helper text-fg-muted">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      }
    >
      {step === 0 ? <BasicsStep {...stepProps} /> : null}
      {step === 1 ? <BrandStep {...stepProps} sample={sample} /> : null}
      {step === 2 ? <ConnectionsStep {...stepProps} channels={channels} /> : null}
      {step === 3 ? <ReviewStep form={form} channels={channels} /> : null}
    </WizardFrame>
  );
}
