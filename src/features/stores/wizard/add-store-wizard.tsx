"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { WizardFrame } from "@/components/ui/wizard";
import { cn } from "@/lib/cn";
import type { AiChannel } from "@/types/core";
import type { StoreSetupSample } from "@/types/settings";

import { BasicsStep, BrandStep, ChannelsStep, CompetitorsStep, ConnectionStep, ProductsStep, type StepProps } from "./steps";
import { LAST_STEP, STEPS, buildChecklist, initialForm, requiredComplete, stepErrors, type WizardForm } from "./model";

const FIELD_LABEL: Record<string, string> = {
  name: "Store name",
  website: "Website",
  connection: "Connection",
  brandName: "Brand name",
  industry: "Industry",
  country: "Country",
  language: "Language",
  timezone: "Time zone",
  description: "Description",
  channels: "AI channels",
};

const STEP_COPY: { title: string; subtitle: string }[] = [
  { title: "Basics", subtitle: "Name the store and point to its website." },
  { title: "Connection", subtitle: "Connect a platform or continue manually." },
  { title: "Brand and market", subtitle: "How the brand is written and where it sells." },
  { title: "Products and services", subtitle: "What AI answers should associate with the brand." },
  { title: "Competitors", subtitle: "Confirm who the brand is compared with." },
  { title: "AI channels and review", subtitle: "Choose what to measure, then activate." },
];

function focusField(field: string) {
  const node = document.querySelector<HTMLElement>(`[name="${field}"], [data-field="${field}"]`);
  node?.focus();
  node?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function AddStoreWizard({ channels, sample }: { channels: AiChannel[]; sample: StoreSetupSample }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<WizardForm>(() =>
    initialForm(
      sample,
      channels.map((c) => c.id),
    ),
  );
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  const [focusTick, setFocusTick] = useState(0);
  const [activating, setActivating] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (focusTick > 0) summaryRef.current?.focus();
  }, [focusTick]);

  useEffect(() => {
    const ids = timers;
    return () => ids.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const patch = (next: Partial<WizardForm>) => setForm((current) => ({ ...current, ...next }));
  const errors = stepErrors(step, form);
  const errorKeys = Object.keys(errors);
  const showSummary = attempted[step] && errorKeys.length > 0;
  const error = (field: string) => (touched[field] || attempted[step] ? errors[field] : undefined);
  const blur = (field: string) => setTouched((current) => ({ ...current, [field]: true }));

  const fail = (target: number) => {
    setStep(target);
    setAttempted((current) => ({ ...current, [target]: true }));
    setFocusTick((tick) => tick + 1);
  };

  const next = () => {
    if (errorKeys.length > 0) {
      fail(step);
      return;
    }
    const carry: Partial<WizardForm> = {};
    if (step === 0) {
      if (!form.brandName.trim()) carry.brandName = form.name.trim();
      if (form.platform === "shopify" && form.connection === "manual") carry.connection = "shopify";
      if (form.platform !== "shopify" && form.connection === "shopify") Object.assign(carry, { connection: "manual", shopifyState: "idle" });
    }
    if (Object.keys(carry).length) patch(carry);
    setStep(step + 1);
  };

  const activate = () => {
    for (let index = 0; index <= LAST_STEP; index += 1) {
      if (Object.keys(stepErrors(index, form)).length > 0) {
        fail(index);
        return;
      }
    }
    setActivating(true);
    timers.current.push(
      window.setTimeout(() => {
        toast.push({ title: `${form.name.trim()} activated`, description: "Demo: nothing was created. Status would move Draft, Ready, Active." });
        router.push("/stores");
      }, 900),
    );
  };

  const saveDraft = () => {
    toast.push({ title: "Draft saved", description: "Demo: nothing is stored." });
    router.push("/stores");
  };

  const authorize = () => {
    patch({ shopifyState: "authorizing" });
    timers.current.push(
      window.setTimeout(() => {
        setForm((current) => ({ ...current, shopifyState: "authorized" }));
        toast.push({ title: "Shopify authorized", description: "Simulated. No real connection was made." });
      }, 1200),
    );
  };

  const stepProps: StepProps = { form, patch, error, blur, goTo: setStep };
  const checklist = buildChecklist(form);
  const ready = requiredComplete(form);

  return (
    <WizardFrame
      steps={[...STEPS]}
      current={step}
      title={STEP_COPY[step].title}
      subtitle={STEP_COPY[step].subtitle}
      onStepClick={setStep}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      primary={step === LAST_STEP ? { label: "Activate store", onClick: activate, loading: activating } : { label: "Next", onClick: next }}
      secondary={<Button variant="ghost" onClick={saveDraft}>Save draft</Button>}
      aside={
        <Card>
          <CardHeader title="Setup checklist" info="Draft: setup incomplete. Ready: setup complete, not tracking. Active: scheduled tracking on." actions={<Status kind="store" value={ready ? "ready" : "draft"} />} />
          <CardBody>
            <ol className="flex flex-col gap-2.5">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5">
                  <Icon
                    name={item.state === "done" ? "check-circle" : "circle"}
                    size={16}
                    className={cn("mt-0.5 shrink-0", item.state === "done" ? "text-success" : item.step === step ? "text-accent-text" : "text-fg-subtle")}
                  />
                  <div className="min-w-0">
                    <p className={cn("text-[13px]", item.step === step ? "font-semibold text-fg" : "text-fg")}>{item.label}</p>
                    <p className="truncate text-xs text-fg-subtle">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      }
    >
      {showSummary ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-5 rounded-control border border-danger/30 bg-danger-soft px-3.5 py-3 outline-none">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
            <Icon name="alert-circle" size={15} className="text-danger" />
            Fix {errorKeys.length} {errorKeys.length === 1 ? "item" : "items"} to continue
          </p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {errorKeys.map((field) => (
              <li key={field}>
                <button type="button" onClick={() => focusField(field)} className="cursor-pointer rounded text-left text-[13px] text-danger underline-offset-2 hover:underline">
                  {FIELD_LABEL[field] ?? field}: {errors[field]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step === 0 ? <BasicsStep {...stepProps} /> : null}
      {step === 1 ? <ConnectionStep {...stepProps} onAuthorize={authorize} /> : null}
      {step === 2 ? <BrandStep {...stepProps} /> : null}
      {step === 3 ? <ProductsStep {...stepProps} sample={sample} /> : null}
      {step === 4 ? <CompetitorsStep {...stepProps} /> : null}
      {step === 5 ? <ChannelsStep {...stepProps} channels={channels} /> : null}
    </WizardFrame>
  );
}
