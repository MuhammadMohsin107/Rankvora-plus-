"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, RadioCards, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { pluralize } from "@/lib/format";
import { INTENT_LABEL, SCOPE_LABEL } from "@/lib/labels";
import type { ProductService, PromptGroup, PromptIntent, PromptScope } from "@/types/core";
import type { ExistingPrompt, PromptRecord } from "@/types/prompts";

import { LANGUAGE_OPTIONS, MARKET_OPTIONS } from "./create-types";
import { CharCount, DuplicateNotice } from "./parts";
import { MAX_PROMPT_LENGTH, findDuplicate, validatePromptText } from "./text";

const footerClass = "-mx-5 -mb-4 mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3";

// ---------------------------------------------------------------------------
// Wording: saving creates a new version, after confirmation.
// ---------------------------------------------------------------------------

type WordingProps = {
  open: boolean;
  onClose: () => void;
  prompt: PromptRecord;
  storeId: string;
  existing: ExistingPrompt[];
  /** Runs that used the current version. */
  currentRuns: number;
  onCommit: (text: string) => void;
};

export function WordingDialog({ open, onClose, ...rest }: WordingProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Edit wording" description="Saving creates a new version.">
      <WordingBody onClose={onClose} {...rest} />
    </Dialog>
  );
}

function WordingBody({ onClose, prompt, storeId, existing, currentRuns, onCommit }: Omit<WordingProps, "open">) {
  const [text, setText] = useState(prompt.text);
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const duplicate = useMemo(() => findDuplicate(text, existing), [text, existing]);
  const changed = text.trim() !== prompt.text;
  const next = prompt.version + 1;

  const review = () => {
    const problem = validatePromptText(text) ?? (duplicate?.kind === "exact" ? "Another prompt already uses this wording." : null);
    if (problem) return setError(problem);
    setError(undefined);
    setConfirming(true);
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <Field label="Prompt text" required error={error}>
          {({ id, describedBy, invalid }) => (
            <>
              <Textarea
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                rows={4}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setError(undefined);
                }}
              />
              <div className="flex justify-end"><CharCount value={text.length} max={MAX_PROMPT_LENGTH} /></div>
            </>
          )}
        </Field>
        {duplicate ? <DuplicateNotice match={duplicate} storeId={storeId} /> : null}
      </div>
      <div className={footerClass}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!changed} onClick={review}>Save as v{next}</Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onCommit(text.trim());
          onClose();
        }}
        title={`Create version v${next}?`}
        confirmLabel={`Create v${next}`}
        tone="primary"
      >
        <p>
          This creates version v{next}. Earlier runs keep pointing to v{prompt.version}, and comparisons will mark it as changed.
        </p>
        <p className="tnum mt-2 text-xs text-fg-subtle">v{prompt.version} was used by {pluralize(currentRuns, "run")}.</p>
      </ConfirmDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tracking configuration (does not create a version).
// ---------------------------------------------------------------------------

export type ConfigDraft = {
  intent: PromptIntent;
  topic: string;
  scope: PromptScope;
  market: string;
  language: string;
  groupId: string;
  isCore: boolean;
  productIds: string[];
};

type ConfigProps = {
  open: boolean;
  onClose: () => void;
  prompt: PromptRecord;
  groups: PromptGroup[];
  products: ProductService[];
  onSave: (draft: ConfigDraft) => void;
};

export function ConfigDialog({ open, onClose, ...rest }: ConfigProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Tracking" description="Wording changes create a new version. These settings do not.">
      <ConfigBody onClose={onClose} {...rest} />
    </Dialog>
  );
}

function ConfigBody({ onClose, prompt, groups, products, onSave }: Omit<ConfigProps, "open">) {
  const initial: ConfigDraft = {
    intent: prompt.intent,
    topic: prompt.topic,
    scope: prompt.scope,
    market: prompt.market,
    language: prompt.language,
    groupId: prompt.groupId ?? "",
    isCore: prompt.isCore,
    productIds: prompt.productIds,
  };
  const [draft, setDraft] = useState<ConfigDraft>(initial);
  const set = <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const markets = MARKET_OPTIONS.some((m) => m.value === prompt.market) ? MARKET_OPTIONS : [{ value: prompt.market, label: prompt.market }, ...MARKET_OPTIONS];

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <Field label="Intent">
            {({ id }) => (
              <Select id={id} value={draft.intent} onChange={(event) => set("intent", event.target.value as PromptIntent)}>
                {Object.entries(INTENT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Topic">
            {({ id }) => <Input id={id} value={draft.topic} maxLength={60} onChange={(event) => set("topic", event.target.value)} />}
          </Field>
          <Field label="Market">
            {({ id }) => (
              <Select id={id} value={draft.market} onChange={(event) => set("market", event.target.value)}>
                {markets.map((m) => (
                  <option key={m.value} value={m.value}>{m.label} ({m.value})</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Language">
            {({ id }) => (
              <Select id={id} value={draft.language} onChange={(event) => set("language", event.target.value)}>
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Group" className="sm:col-span-2">
            {({ id }) => (
              <Select id={id} value={draft.groupId} onChange={(event) => set("groupId", event.target.value)}>
                <option value="">Ungrouped</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="text-[13px] font-medium text-fg">Tracking scope</span>
          <RadioCards
            label="Tracking scope"
            columns={3}
            value={draft.scope}
            onChange={(value: PromptScope) => set("scope", value)}
            options={(Object.keys(SCOPE_LABEL) as PromptScope[]).map((value) => ({ value, label: SCOPE_LABEL[value] }))}
          />
        </div>

        {products.length > 0 ? (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-medium text-fg">Linked products</legend>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
              {products.map((product) => (
                <Checkbox
                  key={product.id}
                  label={product.title}
                  description={product.category}
                  checked={draft.productIds.includes(product.id)}
                  onChange={(event) => set("productIds", event.target.checked ? [...draft.productIds, product.id] : draft.productIds.filter((id) => id !== product.id))}
                  className="rounded-control border border-line p-2.5"
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        <Checkbox label="Core prompt" description="Part of the stable set used to compare results over time." checked={draft.isCore} onChange={(event) => set("isCore", event.target.checked)} />
      </div>
      <div className={footerClass}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!dirty}
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </>
  );
}
