"use client";

import { useEffect, useRef, useState } from "react";

import { Tabs } from "@/components/ui/tabs";
import type { NewPromptData, PromptSuggestion } from "@/types/prompts";

import { AiTab } from "./ai-tab";
import { initialForm, type AiState, type ManualForm, type SessionPrompt } from "./create-types";
import { ImportTab } from "./import-tab";
import { ManualTab } from "./manual-tab";

/** Create flow: manual, AI suggestions, CSV import. State lives here so switching tabs loses nothing. */
export function CreatePrompt({ data }: { data: NewPromptData }) {
  const [form, setForm] = useState<ManualForm>(() => initialForm(data.store));
  const [ai, setAi] = useState<AiState>({ batch: 0, dismissed: [], accepted: {}, loading: false });
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [session, setSession] = useState<SessionPrompt[]>([]);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const remember = (texts: string[]) => {
    const added = texts.map<SessionPrompt>((text) => {
      seq.current += 1;
      return { id: `new-${seq.current}`, text };
    });
    setSession((current) => [...current, ...added]);
  };

  const regenerate = () => {
    if (ai.loading) return;
    setAi((current) => ({ ...current, loading: true }));
    timer.current = setTimeout(() => {
      setAi((current) => ({ batch: (current.batch + 1) % Math.max(1, data.suggestionBatches.length), dismissed: [], accepted: {}, loading: false }));
    }, 900);
  };

  const accept = (suggestion: PromptSuggestion, text: string) => {
    remember([text]);
    setAi((current) => ({ ...current, accepted: { ...current.accepted, [suggestion.id]: text } }));
  };

  return (
    <Tabs
      label="Create prompt"
      tabs={[
        { id: "manual", label: "Manual", content: <ManualTab data={data} form={form} setForm={setForm} session={session} onCreated={(text) => remember([text])} /> },
        {
          id: "ai",
          label: "AI suggestions",
          content: (
            <AiTab
              data={data}
              state={ai}
              session={session}
              onRegenerate={regenerate}
              onAccept={accept}
              onDismiss={(id) => setAi((current) => ({ ...current, dismissed: [...current.dismissed, id] }))}
            />
          ),
        },
        {
          id: "import",
          label: "Import CSV",
          content: <ImportTab data={data} csv={csv} setCsv={setCsv} fileName={fileName} setFileName={setFileName} session={session} onImported={remember} />,
        },
      ]}
    />
  );
}
