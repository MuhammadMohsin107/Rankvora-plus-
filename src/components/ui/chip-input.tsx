"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

import { Button } from "./button";
import { Field, Input } from "./form";
import { Icon } from "./icon";
import { Tooltip } from "./tooltip";

type ChipInputProps = {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Maximum number of items. */
  max?: number;
  /** Longest single item, in characters. */
  maxLength?: number;
  className?: string;
};

/** Longer than this and the chip text is truncated (full text stays in the title and tooltip). */
const TRUNCATE_AT = 28;

/**
 * Free-text list as removable chips (aliases, differentiators). Enter, comma or Add commits the draft;
 * pasting a comma or line separated list adds each item. Duplicates are ignored with a message.
 */
export function ChipInput({ label, hint, values, onChange, placeholder, disabled, max = 20, maxLength = 80, className }: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | undefined>();
  const full = values.length >= max;

  const commit = (raw = draft) => {
    const parts = raw
      .split(/[\n,]/)
      .map((part) => part.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...values];
    let skipped = 0;
    for (const part of parts) {
      const item = part.slice(0, maxLength);
      if (next.length >= max || next.some((value) => value.toLowerCase() === item.toLowerCase())) skipped += 1;
      else next.push(item);
    }
    if (next.length !== values.length) onChange(next);
    setNotice(skipped > 0 ? (parts.length === 1 ? "Already added." : `${skipped} skipped: already added or over the limit.`) : undefined);
    setDraft("");
  };

  return (
    <div className={className}>
      <Field label={label} hint={full ? `Up to ${max} items.` : hint} error={notice}>
        {({ id, describedBy, invalid }) => (
          <div className="flex gap-2">
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={draft}
              disabled={disabled || full}
              placeholder={placeholder}
              onChange={(event) => {
                setDraft(event.target.value);
                if (notice) setNotice(undefined);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commit();
                }
              }}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text");
                if (/[\n,]/.test(text)) {
                  event.preventDefault();
                  commit(`${draft}${text}`);
                }
              }}
            />
            <Button variant="secondary" icon="plus" disabled={disabled || full || !draft.trim()} onClick={() => commit()}>Add</Button>
          </div>
        )}
      </Field>
      {values.length > 0 ? (
        <>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label} list`}>
            {values.map((value) => {
              const long = value.length > TRUNCATE_AT;
              const text = (
                <span title={long ? value : undefined} className="max-w-[16rem] truncate">
                  {value}
                </span>
              );
              return (
                <li key={value} className="inline-flex max-w-full">
                  <span className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-line-strong bg-surface pl-2.5 pr-1 text-xs text-fg pointer-coarse:h-11">
                    {long ? <Tooltip content={value}>{text}</Tooltip> : text}
                    {disabled ? null : (
                      <button
                        type="button"
                        onClick={() => {
                          onChange(values.filter((item) => item !== value));
                          setNotice(undefined);
                        }}
                        aria-label={`Remove ${value}`}
                        className={cn("flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-muted hover:bg-surface-2 hover:text-fg pointer-coarse:size-9")}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="tnum mt-1.5 text-xs text-fg-muted" aria-live="polite">
            {values.length} of {max}
          </p>
        </>
      ) : null}
    </div>
  );
}
