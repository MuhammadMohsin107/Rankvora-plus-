"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/ui/toast";
import { WizardFrame } from "@/components/ui/wizard";
import type { WizardData } from "@/types/audit";

import { StepChannels, StepCriteria, StepPrompts, StepReview, StepType, StepWebsite, UsageAside } from "./wizard-steps";
import { includedPrompts, initialState, predictUsage, urlLines, type WizardState } from "./wizard-model";

const STEPS = [
  { id: "type", label: "Type and lanes" },
  { id: "prompts", label: "Prompts" },
  { id: "channels", label: "AI channels" },
  { id: "website", label: "Website scope" },
  { id: "criteria", label: "Criteria and limits" },
  { id: "review", label: "Review" },
];

// Step headings say what to decide (the stepper already names the step); a subtitle appears only when it adds a rule.
const TITLES: { title: string; subtitle?: string }[] = [
  { title: "What kind of audit?" },
  { title: "Which prompts?", subtitle: "Versions are fixed at start." },
  { title: "Which AI channels?", subtitle: "Provider API, model and search mode. Results are API answer samples." },
  { title: "What should be crawled?" },
  { title: "Rules and caps" },
  { title: "Ready to start?" },
];

function stepError(step: number, data: WizardData, s: WizardState): string | null {
  switch (step) {
    case 0:
      return !s.ai && !s.web ? "Select at least one lane" : null;
    case 1:
      return s.ai && includedPrompts(data, s).length === 0 ? "Include at least one prompt" : null;
    case 2:
      return s.ai && s.channelIds.length === 0 ? "Select at least one channel" : null;
    case 3: {
      if (!s.web) return null;
      if (!s.startHomepage && !s.startSitemap && !s.startUrlList && !s.startCms) return "Choose a start point";
      if (s.startUrlList && urlLines(s.urlList).length === 0) return "Add at least one URL";
      if (s.pageTypes.length === 0) return "Select a page type";
      return null;
    }
    case 4:
      return s.maxUrls > 0 && s.maxRequests > 0 && s.budgetUsd > 0 ? null : "Limits must be above 0";
    default:
      return null;
  }
}

export function AuditWizard({ data }: { data: WizardData }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(() => initialState(data));
  const [starting, setStarting] = useState(false);

  const set = (patch: Partial<WizardState>) => setState((current) => ({ ...current, ...patch }));
  const usage = predictUsage(data, state);
  const last = step === STEPS.length - 1;

  const error = stepError(step, data, state);
  const reviewBlock = last ? (usage.overBudget ? "Over the budget cap" : STEPS.slice(0, 5).map((_, i) => stepError(i, data, state)).find(Boolean) ?? null) : null;
  const blocked = last ? reviewBlock : error;

  const start = () => {
    setStarting(true);
    // Demo: no audit is created. The wizard lands on the store's running audit, else its latest full audit.
    const landing = data.landingAudit;
    toast.push({
      title: "Audit started",
      description: `${usage.jobs} AI jobs and about ${usage.pages} pages queued.${landing ? ` Demo: opening "${landing.title}".` : " Demo: no audit is created."}`,
      tone: "success",
    });
    router.push(landing ? `/stores/${data.store.id}/audits/${landing.id}` : `/stores/${data.store.id}/audits`);
  };

  const body = [
    <StepType key="type" data={data} state={state} set={set} />,
    <StepPrompts key="prompts" data={data} state={state} set={set} />,
    <StepChannels key="channels" data={data} state={state} set={set} />,
    <StepWebsite key="website" data={data} state={state} set={set} />,
    <StepCriteria key="criteria" data={data} state={state} set={set} />,
    <StepReview key="review" data={data} state={state} set={set} usage={usage} onEdit={setStep} />,
  ][step];

  return (
    <WizardFrame
      steps={STEPS}
      current={step}
      title={TITLES[step].title}
      subtitle={TITLES[step].subtitle}
      aside={<UsageAside data={data} state={state} />}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      onStepClick={setStep}
      primary={{
        label: last ? "Start audit" : "Next",
        onClick: last ? start : () => setStep(step + 1),
        disabled: Boolean(blocked),
        loading: starting,
      }}
      // Steps 1 to 5 show their problem next to the field; only the review step needs the reason beside the button.
      blockedReason={last ? (blocked ?? undefined) : undefined}
    >
      {body}
    </WizardFrame>
  );
}
