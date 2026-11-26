"use client";

import type { ReactNode } from "react";

import { FilterBar } from "@/components/ui/filter-bar";

export type FilterOption = { value: string; label: string };
export type FilterDef = { id: string; label: string; options: FilterOption[] };

type Props = {
  label: string;
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  /** Filters shown first in the bar. */
  primary: FilterDef[];
  /** Further filters, shown after them in the same bar. */
  more: FilterDef[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onClear: () => void;
  shown: number;
  total: number;
  noun?: string;
  actions?: ReactNode;
};

/** Search and every filter in one visible bar. Owns no state: the list decides what the values mean. */
export function ListToolbar({ label, query, onQuery, placeholder, primary, more, values, onChange, onClear, shown, total, noun, actions }: Props) {
  return (
    <FilterBar
      label={`${label} filters`}
      search={{ value: query, onChange: onQuery, placeholder, label: `Search ${label.toLowerCase()}` }}
      filters={[...primary, ...more].map((f) => ({ id: f.id, label: f.label, options: f.options, value: values[f.id] ?? "", onChange: (v) => onChange(f.id, v) }))}
      onClearAll={onClear}
      resultCount={{ shown, total, noun }}
      actions={actions}
    />
  );
}
