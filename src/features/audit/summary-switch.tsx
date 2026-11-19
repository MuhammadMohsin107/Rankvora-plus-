"use client";

import { useState, type ReactNode } from "react";

import { Segmented } from "@/components/ui/form";

type Option = { value: string; label: string; content: ReactNode };

/** Switches between pre-rendered summaries (local state). */
export function SummarySwitch({ options, label }: { options: Option[]; label: string }) {
  const [value, setValue] = useState(options[0]?.value ?? "");
  const active = options.find((o) => o.value === value) ?? options[0];
  return (
    <div className="flex flex-col gap-3">
      {options.length > 1 ? <Segmented label={label} value={value} onChange={setValue} options={options.map((o) => ({ value: o.value, label: o.label }))} className="self-start" /> : null}
      {active?.content}
    </div>
  );
}
