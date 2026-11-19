"use client";

import { useState } from "react";

import { Button } from "./button";
import { Chip } from "./badge";
import { Field, Input } from "./form";

type ChipInputProps = {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Maximum number of items. */
  max?: number;
  className?: string;
};

/** Free-text list as removable chips (aliases, differentiators). Enter or Add commits the draft. */
export function ChipInput({ label, hint, values, onChange, placeholder, disabled, max = 20, className }: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const full = values.length >= max;

  const commit = () => {
    const clean = draft.trim().replace(/\s+/g, " ");
    if (!clean) return;
    if (!values.some((value) => value.toLowerCase() === clean.toLowerCase()) && !full) onChange([...values, clean]);
    setDraft("");
  };

  return (
    <div className={className}>
      <Field label={label} hint={full ? `Up to ${max} items.` : hint}>
        {({ id, describedBy }) => (
          <div className="flex gap-2">
            <Input
              id={id}
              aria-describedby={describedBy}
              value={draft}
              disabled={disabled || full}
              placeholder={placeholder}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                }
              }}
            />
            <Button variant="secondary" icon="plus" disabled={disabled || full || !draft.trim()} onClick={commit}>Add</Button>
          </div>
        )}
      </Field>
      {values.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label} list`}>
          {values.map((value) => (
            <li key={value}>
              <Chip removeLabel={`Remove ${value}`} onRemove={disabled ? undefined : () => onChange(values.filter((item) => item !== value))}>{value}</Chip>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
