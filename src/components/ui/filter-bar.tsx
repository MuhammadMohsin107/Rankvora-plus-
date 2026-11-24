"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button } from "./button";
import { Chip } from "./badge";
import { SearchField } from "./form";
import { Icon } from "./icon";

export type FilterBarFilter = {
  id: string;
  /** Short name, shown as "Label: all" and used as the control's accessible name. */
  label: string;
  /** Selected option value; "" means no filter. */
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
};

type FilterBarProps = {
  /** Accessible name of the toolbar, e.g. "Findings filters". */
  label: string;
  search?: { value: string; onChange: (next: string) => void; placeholder?: string; label?: string };
  filters?: FilterBarFilter[];
  /** Extra controls placed after the filters (e.g. a date range). */
  children?: ReactNode;
  /** Show a removable chip for each active filter. Useful when filters live in a popover; off by default because the select already shows its value. */
  chips?: boolean;
  /** Called by "Reset". The button is always shown and is disabled until a search or filter is active. */
  onClearAll?: () => void;
  /** "Showing x of y". Announced politely when it changes. Shown only while filters are active unless `alwaysShowCount`. */
  resultCount?: { shown: number; total: number; noun?: string };
  alwaysShowCount?: boolean;
  /** Right-aligned slot for view toggles (table / cards / board), density, export. */
  actions?: ReactNode;
  /** Kept for callers; the bar is always the same compact height. */
  dense?: boolean;
  className?: string;
};

/** True when a search term or any filter is set. Pure, unit-tested. */
export function hasActiveFilters(search: string | undefined, filters: Pick<FilterBarFilter, "value">[] | undefined): boolean {
  return Boolean(search?.trim()) || (filters ?? []).some((filter) => filter.value !== "");
}

/**
 * One consistent toolbar for tables, card grids and boards: search, filters, active chips, clear and result count,
 * plus a slot for view toggles. It owns no state; the list decides what the values mean.
 */
export function FilterBar({ label, search, filters = [], children, chips = false, onClearAll, resultCount, alwaysShowCount, actions, className }: FilterBarProps) {
  const active = hasActiveFilters(search?.value, filters);
  const activeFilters = filters.filter((filter) => filter.value !== "");
  const showCount = resultCount && (active || alwaysShowCount);
  const hasActions = Boolean(actions);
  const empty = !search && filters.length === 0 && !children && !actions;
  if (empty) return null;
  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 flex-col gap-2", className)}>
      {/* One bar: the search and every filter sit inside it, separated by thin dividers. */}
      <div className={cn("flex min-w-0 max-w-full flex-wrap items-center gap-1 self-start rounded-card border border-line bg-surface p-1 shadow-card max-sm:w-full sm:rounded-full", hasActions && "sm:w-full")}>
        {search ? (
          <SearchField
            bare
            label={search.label ?? `Search ${label.replace(/ filters$/i, "").toLowerCase()}`}
            placeholder={search.placeholder ?? "Search"}
            value={search.value}
            onChange={search.onChange}
            className="w-full sm:w-64"
          />
        ) : null}
        {search && filters.length > 0 ? <span aria-hidden="true" className="mx-1 hidden h-5 w-px shrink-0 bg-line sm:block" /> : null}
        {filters.map((filter) => {
          const selected = filter.options.find((option) => option.value === filter.value);
          return (
            // The pill's width follows the text it shows; the real <select> sits invisibly on top so it stays native and accessible.
            <div
              key={filter.id}
              className={cn(
                "relative inline-flex h-8 max-w-[14rem] items-center gap-1.5 rounded-full border px-3 text-body-sm transition-colors duration-[var(--dur-fast)] focus-within:outline-2 focus-within:outline-ring",
                filter.value ? "border-accent/40 bg-accent-soft font-medium text-accent-text" : "border-line-strong text-fg-muted hover:border-fg-faint hover:bg-surface-2 hover:text-fg",
              )}
            >
              <span className="truncate">{filter.value ? `${filter.label}: ${selected?.label ?? filter.value}` : filter.label}</span>
              <Icon name="chevron-down" size={14} className="shrink-0" />
              <select
                aria-label={filter.label}
                value={filter.value}
                onChange={(event) => filter.onChange(event.target.value)}
                className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
              >
                <option value="">{filter.label}: all</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        {children}
        {onClearAll ? (
          <Button variant="ghost" size="sm" icon="undo" disabled={!active} onClick={onClearAll}>
            Reset
          </Button>
        ) : null}
        {showCount || actions ? (
          <div className={cn("flex items-center gap-3 pl-1 pr-3", hasActions && "ml-auto")}>
            {showCount ? (
              <p className="tnum text-xs text-fg-muted" aria-live="polite" aria-atomic="true">
                Showing {resultCount.shown} of {resultCount.total}
                {resultCount.noun ? ` ${resultCount.noun}` : ""}
              </p>
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>
      {chips && activeFilters.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Active filters">
          {activeFilters.map((filter) => {
            const option = filter.options.find((item) => item.value === filter.value);
            return (
              <li key={filter.id}>
                <Chip removeLabel={`Remove filter ${filter.label}: ${option?.label ?? filter.value}`} onRemove={() => filter.onChange("")}>
                  {filter.label}: {option?.label ?? filter.value}
                </Chip>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
