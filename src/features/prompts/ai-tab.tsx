"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { INTENT_LABEL } from "@/lib/labels";
import type { PromptIntent } from "@/types/core";
import type { NewPromptData, PromptSuggestion } from "@/types/prompts";

import type { AiState, SessionPrompt } from "./create-types";
import { CharCount, DuplicateNotice } from "./parts";
import { MAX_PROMPT_LENGTH, findDuplicate, namesBrand, validatePromptText } from "./text";

type Props = {
  data: NewPromptData;
  state: AiState;
  session: SessionPrompt[];
  onRegenerate: () => void;
  onAccept: (suggestion: PromptSuggestion, text: string) => void;
  onDismiss: (id: string) => void;
};

export function AiTab({ data, state, session, onRegenerate, onAccept, onDismiss }: Props) {
  const { store, existing, suggestionBatches } = data;
  const toast = useToast();
  const [editing, setEditing] = useState<{ suggestion: PromptSuggestion; text: string; intent: PromptIntent } | null>(null);
  const [editError, setEditError] = useState<string | undefined>();

  const comparable = [...existing, ...session];
  const visible = (suggestionBatches[state.batch] ?? []).filter((s) => !state.dismissed.includes(s.id));
  const addedCount = Object.keys(state.accepted).length;

  const accept = (suggestion: PromptSuggestion, text: string) => {
    onAccept(suggestion, text);
    toast.push({ title: "Added as draft", description: text });
  };

  const saveEdit = () => {
    if (!editing) return;
    const problem = validatePromptText(editing.text);
    if (problem) return setEditError(problem);
    if (findDuplicate(editing.text, comparable)?.kind === "exact") return setEditError("This prompt already exists.");
    accept({ ...editing.suggestion, intent: editing.intent }, editing.text.trim());
    setEditing(null);
    setEditError(undefined);
  };

  const editDuplicate = editing ? findDuplicate(editing.text, comparable) : null;

  return (
    <Card as="section">
      <CardHeader
        title="Based on the store profile"
        info="Demo suggestions built from brand, market, products and competitors. Accepted prompts are added as drafts."
        actions={
          <Button size="sm" icon="refresh" loading={state.loading} onClick={onRegenerate}>
            Regenerate
          </Button>
        }
      />
      <div className="p-4 pt-3" aria-busy={state.loading}>
        {visible.length === 0 && !state.loading ? (
          <EmptyState icon="sparkles" title="All suggestions reviewed" />
        ) : (
          <ul className={state.loading ? "flex flex-col divide-y divide-line opacity-50" : "flex flex-col divide-y divide-line"}>
            {visible.map((suggestion) => {
              const addedText = state.accepted[suggestion.id];
              const added = addedText !== undefined;
              const match = added ? null : findDuplicate(suggestion.text, comparable);
              const exact = match?.kind === "exact";
              return (
                <li key={suggestion.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-fg [overflow-wrap:anywhere]">{added ? addedText : suggestion.text}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">{INTENT_LABEL[suggestion.intent]}</Badge>
                      {namesBrand(added ? addedText : suggestion.text, store.brandName) ? <Badge tone="neutral" icon="store">Names brand</Badge> : <Badge tone="info" icon="search">Neutral</Badge>}
                      {match ? (
                        <Badge tone="warning" icon="alert-triangle" title={exact ? `Existing: ${match.text}` : undefined}>
                          {exact ? "Already in library" : "Similar prompt exists"}
                        </Badge>
                      ) : null}
                    </div>
                    {match && !exact ? <p className="mt-1.5 text-xs text-fg-subtle [overflow-wrap:anywhere]">“{match.text}”. Adding it creates a variant.</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {added ? (
                      <Badge tone="success" icon="check-circle">Added as draft</Badge>
                    ) : (
                      <>
                        <Button size="sm" variant="primary" icon="check" disabled={exact} title={exact ? "Already in the library" : undefined} onClick={() => accept(suggestion, suggestion.text)}>
                          Accept
                        </Button>
                        <Button size="sm" icon="pencil" onClick={() => setEditing({ suggestion, text: suggestion.text, intent: suggestion.intent })}>
                          Edit
                        </Button>
                        <IconButton icon="x" label={`Dismiss: ${suggestion.text}`} size="sm" onClick={() => onDismiss(suggestion.id)} />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {addedCount > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-4 py-3">
          <ButtonLink href={`/stores/${store.id}/prompts`} variant="primary" trailingIcon="arrow-right">View library</ButtonLink>
        </div>
      ) : null}

      <Dialog
        open={editing !== null}
        onClose={() => {
          setEditing(null);
          setEditError(undefined);
        }}
        title="Edit suggestion"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={saveEdit}>Add as draft</Button>
          </>
        }
      >
        {editing ? (
          <div className="flex flex-col gap-4">
            <Field label="Prompt text" required error={editError}>
              {({ id, describedBy, invalid }) => (
                <>
                  <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={3} value={editing.text} onChange={(event) => setEditing({ ...editing, text: event.target.value })} />
                  <div className="flex justify-end"><CharCount value={editing.text.length} max={MAX_PROMPT_LENGTH} /></div>
                </>
              )}
            </Field>
            {editDuplicate ? <DuplicateNotice match={editDuplicate} storeId={store.id} /> : null}
            <Field label="Intent">
              {({ id }) => (
                <Select id={id} value={editing.intent} onChange={(event) => setEditing({ ...editing, intent: event.target.value as PromptIntent })}>
                  {Object.entries(INTENT_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        ) : null}
      </Dialog>
    </Card>
  );
}
