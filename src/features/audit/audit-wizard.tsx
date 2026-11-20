"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { WizardFrame } from "@/components/ui/wizard";
import { usePromptGroups, usePrompts } from "@/features/prompts/use-prompts";
import type { AuditRow, AuditType, WizardData } from "@/types/audit";

import { StepCriteria, StepEstimate, StepLanes, StepLimits, StepMarket, StepPrompts, StepProviders, StepReview, StepType, StepWebsite } from "./wizard-steps";
import { applyFinding, buildConfig, includedPrompts, initialState, predictUsage, stateFromConfig, toWizardPrompts, urlLines, type WizardState } from "./wizard-model";
import { useAudits, useHydrated } from "./use-audits";

const NO_ROWS: AuditRow[] = [];

const STEPS = [
  { id: "type", label: "Type" },
  { id: "lanes", label: "Lanes" },
  { id: "prompts", label: "Prompts" },
  { id: "providers", label: "Providers" },
  { id: "market", label: "Market" },
  { id: "website", label: "Website scope" },
  { id: "criteria", label: "Criteria" },
  { id: "limits", label: "Limits" },
  { id: "estimate", label: "Estimate" },
  { id: "review", label: "Review" },
];

const TITLES = ["What kind of audit?", "What should it cover?", "Which prompts?", "Which providers and models?", "Which market and language?", "What should be crawled?", "What should be checked?", "Set limits", "Workload and cost", "Ready to start?"];

const KINDS: AuditType[] = ["initial", "full", "focused", "verification", "triggered", "scheduled"];

function stepIssues(step: number, data: WizardData, s: WizardState, includedCount: number): string[] {
  switch (step) {
    case 0:
      if (s.kind === "verification" && !s.findingId) return ["Choose the finding to re-check"];
      if (s.kind === "triggered" && !s.triggerReason.trim()) return ["Say what triggered the audit"];
      return [];
    case 1:
      return !s.ai && !s.web ? ["Select at least one lane"] : [];
    case 2:
      return s.ai && includedCount === 0 ? ["Include at least one prompt"] : [];
    case 3:
      return s.ai && s.channelIds.length === 0 ? ["Select at least one provider"] : [];
    case 5: {
      if (!s.web) return [];
      const out: string[] = [];
      if (!s.startHomepage && !s.startSitemap && !s.startUrlList && !s.startCms) out.push("Choose a start point");
      if (s.startUrlList && urlLines(s.urlList).length === 0) out.push("Add at least one URL");
      if (s.pageTypes.length === 0) out.push("Select a page type");
      return out;
    }
    case 6:
      return s.web && s.categories.length === 0 ? ["Select a criteria category"] : [];
    case 7:
      return (s.web ? s.maxUrls > 0 : true) && s.maxRequests > 0 && s.budgetUsd > 0 ? [] : ["Limits must be above 0"];
    case 9:
      return data.basisAuditId ? [] : ["No completed audit to base a simulation on"];
    default:
      return [];
  }
}

/** Waits for the browser state (local audits, prompts) before showing the form, so "Run again" and new prompts are available. */
export function AuditWizard({ data }: { data: WizardData }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  return <WizardInner data={data} />;
}

function WizardInner({ data }: { data: WizardData }) {
  const router = useRouter();
  const params = useSearchParams();
  const { prompts: basePrompts } = usePrompts(data.store.id, data.promptsBase);
  const { groups } = usePromptGroups(data.store.id, data.groups);
  const prompts = useMemo(() => toWizardPrompts(basePrompts, groups), [basePrompts, groups]);
  const { rows, createAudit } = useAudits(data.store.id, NO_ROWS);

  const [step, setStep] = useState(0);
  const [showIssues, setShowIssues] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [starting, setStarting] = useState(false);
  const [state, setState] = useState<WizardState>(() => {
    const from = params.get("from");
    const rerun = from ? data.reruns.find((r) => r.id === from) : undefined;
    const local = from ? rows.find((r) => r.id === from && r.config) : undefined;
    let s = local?.config ? stateFromConfig(data, local.config, local.type, local.lanes) : rerun ? stateFromConfig(data, rerun.config, rerun.type, rerun.lanes) : initialState(data);
    const type = params.get("type") as AuditType | null;
    if (type && KINDS.includes(type)) s = { ...s, kind: type };
    const finding = params.get("finding");
    if (finding) s = applyFinding({ ...s, kind: "verification" }, data, prompts, finding);
    const task = params.get("task");
    if (task) s = { ...s, taskId: task };
    return s;
  });

  const set = (patch: Partial<WizardState>) => setState((current) => ({ ...current, ...patch }));
  const usage = predictUsage(data, state, prompts);
  const includedCount = includedPrompts(prompts, state).length;
  const last = step === STEPS.length - 1;
  const issues = stepIssues(step, data, state, includedCount);
  const allIssues = STEPS.slice(0, -1).flatMap((_, i) => stepIssues(i, data, state, includedCount));

  const launch = (asDraft: boolean) => {
    setStarting(true);
    const { config, lanes } = buildConfig(data, state, prompts);
    const created = createAudit({
      type: state.kind,
      lanes,
      config,
      counts: { jobs: usage.jobs, pages: usage.pages, checks: usage.checks },
      createdBy: "You",
      basisAuditId: data.basisAuditId ?? "",
      asDraft,
    });
    router.push(`/stores/${data.store.id}/audits/${created.id}`);
  };

  const next = () => {
    if (issues.length > 0) {
      setShowIssues(true);
      return;
    }
    setShowIssues(false);
    if (!last) {
      setStep(step + 1);
      return;
    }
    if (allIssues.length > 0) {
      setShowIssues(true);
      return;
    }
    if (usage.overBudget || usage.overRequests) setConfirm(true);
    else launch(false);
  };

  const body = [
    <StepType key="type" data={data} state={state} set={set} prompts={prompts} />,
    <StepLanes key="lanes" data={data} state={state} set={set} prompts={prompts} />,
    <StepPrompts key="prompts" data={data} state={state} set={set} prompts={prompts} />,
    <StepProviders key="providers" data={data} state={state} set={set} prompts={prompts} />,
    <StepMarket key="market" data={data} state={state} set={set} prompts={prompts} />,
    <StepWebsite key="website" data={data} state={state} set={set} prompts={prompts} />,
    <StepCriteria key="criteria" data={data} state={state} set={set} prompts={prompts} />,
    <StepLimits key="limits" data={data} state={state} set={set} prompts={prompts} />,
    <StepEstimate key="estimate" data={data} state={state} set={set} prompts={prompts} usage={usage} />,
    <StepReview key="review" data={data} state={state} set={set} prompts={prompts} usage={usage} onEdit={(i) => { setShowIssues(false); setStep(i); }} />,
  ][step];

  return (
    <>
      <WizardFrame
        steps={STEPS}
        current={step}
        title={TITLES[step]}
        onBack={step > 0 ? () => { setShowIssues(false); setStep(step - 1); } : undefined}
        onStepClick={(i) => { setShowIssues(false); setStep(i); }}
        primary={{ label: last ? "Start audit" : "Next", onClick: next, loading: starting }}
        secondary={last ? <Button variant="ghost" icon="file-text" disabled={starting || allIssues.length > 0} onClick={() => launch(true)}>Save draft</Button> : undefined}
        issues={showIssues ? (last ? allIssues : issues) : []}
      >
        {body}
      </WizardFrame>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); launch(false); }} title="Start above the limit?" confirmLabel="Start audit" cancelLabel="Go back" tone="primary">
        The estimate is above the {usage.overBudget ? "budget cap" : "request limit"}. The audit will stop at the limit and end as partially completed.
      </ConfirmDialog>
    </>
  );
}
