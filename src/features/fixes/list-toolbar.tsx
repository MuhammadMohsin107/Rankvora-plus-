"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/form";
import { Popover } from "@/components/ui/popover";

export type FilterOption = { value: string; label: string };
export type FilterDef = { id: string; label: string; options: FilterOption[] };

type Props = {
  label: string;
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  /** The few filters shown in the bar. */
  primary: FilterDef[];
  /** The rest, inside the "More filters" panel. */
  more: FilterDef[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onClear: () => void;
  shown: number;
  total: number;
  noun?: string;
  actions?: ReactNode;
};

/** Search, a few filters, and "More filters" for the rest. Owns no state: the list decides what the values mean. */
export function ListToolbar({ label, query, onQuery, placeholder, primary, more, values, onChange, onClear, shown, total, noun, actions }: Props) {
  const moreActive = more.filter((f) => values[f.id]).length;
  return (
    <FilterBar
      label={`${label} filters`}
      search={{ value: query, onChange: onQuery, placeholder, label: `Search ${label.toLowerCase()}` }}
      filters={primary.map((f) => ({ id: f.id, label: f.label, options: f.options, value: values[f.id] ?? "", onChange: (v) => onChange(f.id, v) }))}
      onClearAll={onClear}
      resultCount={{ shown, total, noun }}
      actions={actions}
    >
      {more.length > 0 ? (
        <Popover
          label="More filters"
          width={300}
          trigger={
            <Button variant="secondary" icon="filter">
              More filters{moreActive ? ` (${moreActive})` : ""}
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            {more.map((f) => (
              <label key={f.id} className="flex flex-col gap-1.5 text-label font-medium text-fg">
                {f.label}
                <Select value={values[f.id] ?? ""} onChange={(event) => onChange(f.id, event.target.value)}>
                  <option value="">All</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
        </Popover>
      ) : null}
    </FilterBar>
  );
}
