"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { INTENT_LABEL } from "@/lib/labels";
import type { PromptIntent } from "@/types/core";
import type { PromptContext, PromptSuggestion } from "@/types/prompts";

import type { AiState } from "./create-types";
import { CharCount, DuplicateNotice, PromptKind } from "./parts";
import { SUGGESTION_SOURCE_LABEL, suggestionsFor, type SuggestionSource } from "./suggestions";
import { MAX_PROMPT_LENGTH, findDuplicate, validatePromptText } from "./text";

type Props = {
  context: PromptContext;
  state: AiState;
  source: SuggestionSource;
  onSource: (next: SuggestionSource) => void;
  onRegenerate: () => void;
  /** Adds the prompt as a draft. Returns false when it could not be added. */
  onAccept: (suggestion: PromptSuggestion, text: string, intent: PromptIntent) => boolean;
  onAcceptAll: (items: PromptSuggestion[]) => void;
  onDismiss: (id: string) => void;
};

export function AiTab({ context, state, source, onSource, onRegenerate, onAccept, onAcceptAll, onDismiss }: Props) {
  const { store, existing, profile, competitors, products } = context;
  const [editing, setEditing] = useState<{ suggestion: PromptSuggestion; text: string; intent: PromptIntent } | null>(null);
  const [editError, setEditError] = useState<string | undefined>();

  const list = suggestionsFor(source, profile, competitors, state.batch);
  const visible = list.filter((s) => !state.dismissed.includes(s.id));
  const addable = visible.filter((s) => state.accepted[s.id] === undefined && findDuplicate(s.text, existing)?.kind !== "exact");
  const addedCount = Object.keys(state.accepted).length;
  const basis = [store.brandName || null, store.marketName || null, products.length > 0 ? `${products.length} offerings` : null, competitors.length > 0 ? `${competitors.length} competitors` : null].filter(Boolean);

  const saveEdit = () => {
    if (!editing) return;
    const problem = validatePromptText(editing.text);
    if (problem) return setEditError(problem);
    if (findDuplicate(editing.text, existing)?.kind === "exact") return setEditError("This prompt already exists.");
    if (onAccept(editing.suggestion, editing.text.trim(), editing.intent)) {
      setEditing(null);
      setEditError(undefined);
    }
  };

  const editDuplicate = editing ? findDuplicate(editing.text, existing) : null;

  return (
    <Card as="section">
      <CardHeader
        title="Suggestions"
        subtitle={basis.length > 0 ? `Based on ${basis.join(", ")}` : undefined}
        info="Built from fixed templates and your website profile. No AI model ran. Accepted prompts are added as drafts."
        actions={
          <>
            <Badge tone="info" icon="layers" title="Demonstration suggestions, not model output">Demo suggestions</Badge>
            {source === "profile" ? (
              <Button size="sm" icon="refresh" loading={state.loading} onClick={onRegenerate}>
                Regenerate
              </Button>
            ) : null}
          </>
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-3 px-card pb-3">
        <div className="w-full sm:w-64">
          <Field label="Source">
            {({ id }) => (
              <Select id={id} value={source} onChange={(event) => onSource(event.target.value as SuggestionSource)}>
                <option value="profile">{SUGGESTION_SOURCE_LABEL.profile}</option>
                <option value="competitors">{SUGGESTION_SOURCE_LABEL.competitors}</option>
                <option value="search_console">{SUGGESTION_SOURCE_LABEL.search_console} (connect first)</option>
              </Select>
            )}
          </Field>
        </div>
        {addable.length > 1 ? (
          <Button size="sm" variant="secondary" icon="plus" onClick={() => onAcceptAll(addable)}>
            Add all {addable.length} as drafts
          </Button>
        ) : null}
      </div>
      <div className="px-card pb-card" aria-busy={state.loading}>
        {source === "search_console" ? (
          <EmptyState
            icon="plug"
            title="Search Console is not connected"
            description="Connect it to see questions people search for."
            action={
              <ButtonLink href={`/stores/${store.id}/settings`} variant="secondary">
                Open Website settings
              </ButtonLink>
            }
          />
        ) : visible.length === 0 && !state.loading ? (
          <EmptyState icon="sparkles" title="All suggestions reviewed" />
        ) : (
          <ul className={state.loading ? "flex flex-col divide-y divide-line opacity-50" : "flex flex-col divide-y divide-line"}>
            {visible.map((suggestion) => {
              const addedId = state.accepted[suggestion.id];
              const added = addedId !== undefined;
              const match = added ? null : findDuplicate(suggestion.text, existing);
              const exact = match?.kind === "exact";
              return (
                <li key={suggestion.id} className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-medium text-fg [overflow-wrap:anywhere]">{suggestion.text}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">{INTENT_LABEL[suggestion.intent]}</Badge>
                      <PromptKind mentionsBrand={suggestion.brandSpecific} />
                      {match ? (
                        <Badge tone="warning" icon="alert-triangle" title={exact ? `Existing: ${match.text}` : undefined}>
                          {exact ? "Already in library" : "Similar prompt exists"}
                        </Badge>
                      ) : null}
                    </div>
                    {match && !exact ? <p className="mt-1.5 text-helper text-fg-muted [overflow-wrap:anywhere]">“{match.text}”. Adding it creates a variant.</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {added ? (
                      <Badge tone="success" icon="check-circle">Added as draft</Badge>
                    ) : (
                      <>
                        <Button size="sm" variant="primary" icon="check" disabled={exact} title={exact ? "Already in the library" : undefined} onClick={() => onAccept(suggestion, suggestion.text, suggestion.intent)}>
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
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-card py-3">
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
          <div className="flex flex-col gap-3">
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
