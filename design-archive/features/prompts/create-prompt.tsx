"use client";

import { useEffect, useRef, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { EmptyState, SkeletonCard } from "@/components/ui/feedback";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { simulatedToast } from "@/demo-state";
import type { PromptIntent, PromptSource } from "@/types/core";
import type { NewPromptData, PromptSuggestion, StoredPrompt } from "@/types/prompts";

import { AiTab } from "./ai-tab";
import { initialForm, type AiState, type ManualForm } from "./create-types";
import { ImportTab } from "./import-tab";
import { ManualTab } from "./manual-tab";
import type { NewPromptInput } from "./prompt-ops";
import { suggestionBatchCount, type SuggestionSource } from "./suggestions";
import { useHydrated, usePromptActions, usePromptContext, usePromptGroups } from "./use-prompts";

const NO_ROWS: StoredPrompt[] = [];

/** Create flow: manual, suggestions, CSV import. Every created prompt is stored in the local demo state. */
export function CreatePrompt({ data }: { data: NewPromptData }) {
  const toast = useToast();
  const hydrated = useHydrated();
  const { context, known } = usePromptContext(data.context);
  const store = context.store;
  const { add, addMany } = usePromptActions<StoredPrompt>(data.storeId, NO_ROWS, { brand: store.brandName, actor: context.actor });
  const groupApi = usePromptGroups(data.storeId, data.context.groups);

  const [form, setForm] = useState<ManualForm>(() => initialForm(data.context.store));
  const [ai, setAi] = useState<AiState>({ batch: 0, dismissed: [], accepted: {}, loading: false });
  const [source, setSource] = useState<SuggestionSource>("profile");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!known) {
    return hydrated ? (
      <EmptyState
        icon="globe"
        title="Website not found"
        action={
          <ButtonLink href="/stores" variant="primary">
            Websites & Brands
          </ButtonLink>
        }
      />
    ) : (
      <SkeletonCard lines={6} />
    );
  }

  const regenerate = () => {
    if (ai.loading) return;
    setAi((current) => ({ ...current, loading: true }));
    timer.current = setTimeout(() => {
      setAi((current) => ({ batch: (current.batch + 1) % suggestionBatchCount, dismissed: [], accepted: {}, loading: false }));
    }, 700);
  };

  const suggestionInput = (text: string, intent: PromptIntent, topic: string): NewPromptInput => ({
    text,
    intent,
    topic,
    groupId: null,
    market: store.market,
    language: store.language,
    scope: "both",
    status: "draft",
    productIds: [],
    isCore: false,
    source: "ai_generated" satisfies PromptSource,
  });

  const accept = (suggestion: PromptSuggestion, text: string, intent: PromptIntent): boolean => {
    const row = add(suggestionInput(text, intent, suggestion.topic));
    setAi((current) => ({ ...current, accepted: { ...current.accepted, [suggestion.id]: row.id } }));
    toast.push({ ...simulatedToast("Prompt added as draft"), description: text });
    return true;
  };

  const acceptAll = (items: PromptSuggestion[]) => {
    const rows = addMany(items.map((s) => suggestionInput(s.text, s.intent, s.topic)));
    setAi((current) => ({ ...current, accepted: { ...current.accepted, ...Object.fromEntries(items.map((s, i) => [s.id, rows[i].id])) } }));
    toast.push({ ...simulatedToast(`${rows.length} prompts added as drafts`) });
  };

  return (
    <Tabs
      label="Create prompt"
      tabs={[
        { id: "manual", label: "Manual", content: <ManualTab context={context} form={form} setForm={setForm} onCreate={(input) => add(input)} /> },
        {
          id: "suggestions",
          label: "Suggestions",
          content: (
            <AiTab
              context={context}
              state={ai}
              source={source}
              onSource={setSource}
              onRegenerate={regenerate}
              onAccept={accept}
              onAcceptAll={acceptAll}
              onDismiss={(id) => setAi((current) => ({ ...current, dismissed: [...current.dismissed, id] }))}
            />
          ),
        },
        {
          id: "import",
          label: "Import CSV",
          content: <ImportTab context={context} csv={csv} setCsv={setCsv} fileName={fileName} setFileName={setFileName} addMany={addMany} ensureGroups={groupApi.ensure} />,
        },
      ]}
    />
  );
}
