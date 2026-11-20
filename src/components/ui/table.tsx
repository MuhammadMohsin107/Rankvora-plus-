"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button, IconButton } from "./button";
import { EmptyState, ErrorState, Skeleton } from "./feedback";
import { FilterBar } from "./filter-bar";
import { Checkbox, Select } from "./form";
import { Icon } from "./icon";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sort?: (row: T) => string | number | null;
  align?: "left" | "right" | "center";
  /** Tailwind width class, e.g. "w-40". */
  width?: string;
  /**
   * Hide the column when the table's own width is below this step. The thresholds follow the table container
   * (not the viewport), so tables beside a sidebar or in a narrow column drop columns before they overflow:
   * sm 576px, md 672px, lg 768px, xl 1024px, 2xl 1152px.
   */
  hideBelow?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Visually hide the header (e.g. action columns) but keep it for assistive tech. */
  srOnlyHeader?: boolean;
};

export type TableFilter<T> = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  /** The row's value(s) for this filter. */
  value: (row: T) => string | string[];
};

export type TableDensity = "compact" | "comfortable" | "spacious";
export type TableError = { title?: string; detail?: string; onRetry?: () => void };

type DataTableProps<T> = {
  /** Accessible name of the table. */
  label: string;
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchable?: { placeholder?: string; text: (row: T) => string };
  filters?: TableFilter<T>[];
  /** Initial sort. Every sortable column then cycles none, ascending, descending, none, starting from this state. */
  defaultSort?: { column: string; dir: "asc" | "desc" };
  selectable?: boolean;
  /** Rendered in a bar while rows are selected. */
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  /** Makes rows focusable (Tab) and activatable with Enter or Space as well as click. */
  onRowClick?: (row: T) => void;
  /** Short row name for screen readers, e.g. a finding title: "Select Missing schema". */
  rowLabel?: (row: T) => string;
  pageSize?: number;
  empty?: ReactNode;
  toolbarExtra?: ReactNode;
  /** Row spacing. Default "comfortable". */
  density?: TableDensity;
  /** Same as density="compact". */
  dense?: boolean;
  /** Shape-matched skeleton rows instead of data. */
  loading?: boolean;
  /** Error state with an optional retry. Replaces the rows. */
  error?: TableError | null;
  /** Below the `sm` container width (about 576px), render each row as a compact card; otherwise the table scrolls inside its card. */
  mobileCards?: boolean;
  className?: string;
};

/* Container-query steps so columns hide by the space the table actually has, not by the window. */
const hideClass = {
  sm: "hidden @xl:table-cell",
  md: "hidden @2xl:table-cell",
  lg: "hidden @3xl:table-cell",
  xl: "hidden @5xl:table-cell",
  "2xl": "hidden @6xl:table-cell",
};
const alignClass = { left: "text-left", right: "text-right", center: "text-center" };
const cellPad: Record<TableDensity, string> = {
  compact: "px-3 py-1.5 pointer-coarse:py-2.5",
  comfortable: "px-4 py-3 pointer-coarse:py-3.5",
  spacious: "px-4 py-4",
};
const headPad: Record<TableDensity, string> = {
  compact: "px-3 py-2",
  comfortable: "px-4 py-2.5",
  spacious: "px-4 py-3",
};

/* ------------------------------------------------------------------ */
/* Pure helpers (unit-tested)                                          */
/* ------------------------------------------------------------------ */

export type SortState = { column: string; dir: "asc" | "desc" } | null;

/** One cycle for every sortable column: none, ascending, descending, none. */
export function nextSort(current: SortState, columnId: string): SortState {
  if (!current || current.column !== columnId) return { column: columnId, dir: "asc" };
  return current.dir === "asc" ? { column: columnId, dir: "desc" } : null;
}

export function ariaSortFor(current: SortState, columnId: string): "ascending" | "descending" | "none" {
  if (current?.column !== columnId) return "none";
  return current.dir === "asc" ? "ascending" : "descending";
}

const collator = new Intl.Collator("en-GB", { numeric: true, sensitivity: "base" });

/** Stable sort; missing values (null) always sit last, in both directions. */
export function sortRows<T>(rows: T[], getter: (row: T) => string | number | null, dir: "asc" | "desc"): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (av === bv) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const result = typeof av === "number" && typeof bv === "number" ? av - bv : collator.compare(String(av), String(bv));
    return result * sign;
  });
}

/** 1-based inclusive range for "Showing 11-20 of 34"; 0-0 when empty. */
export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  return { from: page * pageSize + 1, to: Math.min(total, (page + 1) * pageSize) };
}

/* ------------------------------------------------------------------ */

export function DataTable<T>({
  label,
  data,
  columns,
  rowKey,
  searchable,
  filters,
  defaultSort,
  selectable,
  bulkActions,
  onRowClick,
  rowLabel,
  pageSize: initialPageSize = 10,
  empty,
  toolbarExtra,
  density: densityProp,
  dense,
  loading,
  error,
  mobileCards,
  className,
}: DataTableProps<T>) {
  const density: TableDensity = densityProp ?? (dense ? "compact" : "comfortable");
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>(defaultSort ?? null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    let result = data;
    if (searchable && query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter((row) => searchable.text(row).toLowerCase().includes(needle));
    }
    for (const filter of filters ?? []) {
      const chosen = filterValues[filter.id];
      if (!chosen) continue;
      result = result.filter((row) => {
        const value = filter.value(row);
        return Array.isArray(value) ? value.includes(chosen) : value === chosen;
      });
    }
    if (sort) {
      const column = columns.find((c) => c.id === sort.column);
      if (column?.sort) result = sortRows(result, column.sort, sort.dir);
    }
    return result;
  }, [data, query, filterValues, sort, searchable, filters, columns]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  // Only rows that are still visible can be acted on: a filter never leaves hidden rows in a bulk action.
  const selectedRows = rows.filter((row) => selected.has(rowKey(row)));
  const allOnPage = pageRows.length > 0 && pageRows.every((row) => selected.has(rowKey(row)));
  const filtering = Boolean(query.trim()) || Object.values(filterValues).some(Boolean);
  const sortedColumn = sort ? columns.find((c) => c.id === sort.column) : undefined;

  const toggleSort = (column: Column<T>) => {
    if (!column.sort) return;
    setSort((current) => nextSort(current, column.id));
    setPage(0);
  };

  const toggleRow = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const togglePage = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const row of pageRows) {
        if (allOnPage) next.delete(rowKey(row));
        else next.add(rowKey(row));
      }
      return next;
    });

  const clearFilters = () => {
    setQuery("");
    setFilterValues({});
    setPage(0);
  };

  const hasToolbar = searchable || (filters && filters.length > 0) || toolbarExtra;

  const interactive = (row: T) =>
    onRowClick
      ? {
          tabIndex: 0,
          onClick: (event: MouseEvent<HTMLElement>) => {
            if ((event.target as HTMLElement).closest("a,button,input,select,textarea,label,[role=menu],[role=menuitem]")) return;
            onRowClick(row);
          },
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            // Only when the row itself has focus, so Enter on a link or button inside keeps its own behaviour.
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onRowClick(row);
            }
          },
        }
      : {};

  const checkbox = (row: T) => (
    <Checkbox
      checked={selected.has(rowKey(row))}
      onChange={() => toggleRow(rowKey(row))}
      aria-label={rowLabel ? `Select ${rowLabel(row)}` : "Select row"}
      className="-m-2.5 p-2.5 pointer-coarse:-m-3.5 pointer-coarse:p-3.5"
    />
  );

  const titleColumn = columns.find((c) => !c.srOnlyHeader);
  const actionColumns = columns.filter((c) => c.srOnlyHeader);
  const detailColumns = columns.filter((c) => c !== titleColumn && !c.srOnlyHeader);
  const skeletonRows = Math.min(initialPageSize, 5);

  const showFooter = rows.length > 10 || pageCount > 1;

  return (
    <div className={cn("flex min-w-0 max-w-full flex-col gap-3", className)}>
      {hasToolbar ? (
        <FilterBar
          label={`${label} filters`}
          search={searchable ? { value: query, onChange: (value) => { setQuery(value); setPage(0); }, placeholder: searchable.placeholder, label: `Search ${label}` } : undefined}
          filters={(filters ?? []).map((filter) => ({
            id: filter.id,
            label: filter.label,
            options: filter.options,
            value: filterValues[filter.id] ?? "",
            onChange: (value) => {
              setFilterValues((current) => ({ ...current, [filter.id]: value }));
              setPage(0);
            },
          }))}
          onClearAll={clearFilters}
          resultCount={{ shown: rows.length, total: data.length }}
          actions={toolbarExtra}
        />
      ) : null}

      {selectable && selectedRows.length > 0 && bulkActions ? (
        <div className="flex flex-wrap items-center gap-2 rounded-control border border-accent/30 bg-accent-soft px-3 py-2" role="region" aria-label="Bulk actions">
          <span className="tnum text-[13px] font-medium text-accent-text" aria-live="polite">{selectedRows.length} selected</span>
          {allOnPage && rows.length > pageRows.length && selectedRows.length < rows.length ? (
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(rows.map(rowKey)))}>
              Select all {rows.length}
            </Button>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">{bulkActions(selectedRows, () => setSelected(new Set()))}</div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            Deselect
          </Button>
        </div>
      ) : null}

      {/* @container: columns and the card layout respond to the table's own width. It also keeps a wide table from
          widening its flex or grid ancestors, so the scroll stays inside the card. */}
      <div className="@container min-w-0 max-w-full overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {error ? (
          <div className="p-4">
            <ErrorState
              title={error.title ?? "Could not load this table"}
              detail={error.detail}
              action={error.onRetry ? <Button variant="secondary" icon="refresh" onClick={error.onRetry}>Try again</Button> : undefined}
            />
          </div>
        ) : (
          <>
            <div className={cn("ui-scroll relative min-w-0 max-w-full overflow-x-auto", mobileCards && "hidden @xl:block")}>
              <table className="w-full min-w-max border-collapse text-[13px] @xl:min-w-0" aria-busy={loading || undefined}>
                <caption className="sr-only">{label}</caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    {selectable ? (
                      <th scope="col" className={cn("w-12", headPad[density])}>
                        <Checkbox checked={allOnPage} onChange={togglePage} disabled={loading || pageRows.length === 0} aria-label="Select all rows on this page" className="-m-2.5 p-2.5 pointer-coarse:-m-3.5 pointer-coarse:p-3.5" />
                      </th>
                    ) : null}
                    {columns.map((column) => (
                      <th
                        key={column.id}
                        scope="col"
                        aria-sort={column.sort ? ariaSortFor(sort, column.id) : undefined}
                        className={cn(
                          "text-xs font-medium text-fg-muted",
                          headPad[density],
                          alignClass[column.align ?? "left"],
                          column.width,
                          column.hideBelow && hideClass[column.hideBelow],
                        )}
                      >
                        {column.srOnlyHeader ? (
                          <span className="sr-only">{column.header}</span>
                        ) : column.sort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column)}
                            className={cn(
                              "-mx-1 inline-flex min-h-6 cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:text-fg pointer-coarse:min-h-11",
                              column.align === "right" && "flex-row-reverse",
                              sort?.column === column.id && "text-fg",
                            )}
                          >
                            {column.header}
                            <Icon
                              name={sort?.column === column.id ? (sort.dir === "asc" ? "chevron-up" : "chevron-down") : "chevrons-up-down"}
                              size={13}
                              className={sort?.column === column.id ? "text-accent-text" : "text-fg-muted"}
                            />
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: skeletonRows }, (_, index) => (
                        <tr key={index} className="border-b border-line last:border-0" aria-hidden="true">
                          {selectable ? (
                            <td className={cn("w-12", cellPad[density])}>
                              <Skeleton className="size-4" />
                            </td>
                          ) : null}
                          {columns.map((column, columnIndex) => (
                            <td key={column.id} className={cn(cellPad[density], column.hideBelow && hideClass[column.hideBelow])}>
                              {column.srOnlyHeader ? null : <Skeleton className={cn("h-3.5", columnIndex === 0 ? "w-3/4" : columnIndex % 2 ? "w-1/2" : "w-2/3", column.align === "right" && "ml-auto")} />}
                            </td>
                          ))}
                        </tr>
                      ))
                    : pageRows.map((row) => {
                        const key = rowKey(row);
                        const isSelected = selected.has(key);
                        return (
                          <tr
                            key={key}
                            {...interactive(row)}
                            className={cn(
                              "border-b border-line last:border-0 transition-colors duration-[var(--dur-fast)]",
                              onRowClick && "cursor-pointer outline-none focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                              isSelected ? "bg-accent-soft/60" : "hover:bg-surface-2",
                            )}
                          >
                            {selectable ? (
                              <td className={cn("w-12", cellPad[density])} onClick={(event) => event.stopPropagation()}>
                                {checkbox(row)}
                              </td>
                            ) : null}
                            {columns.map((column) => (
                              <td key={column.id} className={cn(cellPad[density], "align-middle text-fg", alignClass[column.align ?? "left"], column.hideBelow && hideClass[column.hideBelow])}>
                                {column.cell(row)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {mobileCards ? (
              <ul className="@xl:hidden" aria-label={label} aria-busy={loading || undefined}>
                {loading
                  ? Array.from({ length: 3 }, (_, index) => (
                      <li key={index} aria-hidden="true" className="flex flex-col gap-2 border-b border-line p-4 last:border-0">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-3/5" />
                      </li>
                    ))
                  : pageRows.map((row) => {
                      const key = rowKey(row);
                      const isSelected = selected.has(key);
                      return (
                        <li
                          key={key}
                          {...interactive(row)}
                          className={cn(
                            "flex flex-col gap-2 border-b border-line p-4 last:border-0",
                            onRowClick && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                            isSelected && "bg-accent-soft/60",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {selectable ? <div onClick={(event) => event.stopPropagation()}>{checkbox(row)}</div> : null}
                            <div className="min-w-0 flex-1 text-sm font-medium text-fg">{titleColumn ? titleColumn.cell(row) : null}</div>
                            {actionColumns.length > 0 ? <div className="flex shrink-0 items-center gap-1">{actionColumns.map((column) => <span key={column.id}>{column.cell(row)}</span>)}</div> : null}
                          </div>
                          {detailColumns.length > 0 ? (
                            <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
                              {detailColumns.map((column) => (
                                <div key={column.id} className="col-span-2 grid grid-cols-subgrid items-baseline">
                                  <dt className="text-xs text-fg-muted">{column.header}</dt>
                                  <dd className="min-w-0 text-fg">{column.cell(row)}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </li>
                      );
                    })}
              </ul>
            ) : null}

            {!loading && pageRows.length === 0 ? (
              <div className="p-4">
                {filtering ? (
                  <EmptyState icon="filter" title="No matches" description="Nothing fits these filters." action={<Button size="sm" onClick={clearFilters}>Clear filters</Button>} />
                ) : (
                  (empty ?? <EmptyState icon="list" title="Nothing here yet" />)
                )}
              </div>
            ) : null}

            {!loading && showFooter ? (
              <Pagination
                page={safePage}
                pageCount={pageCount}
                total={rows.length}
                pageSize={pageSize}
                onPage={setPage}
                onPageSize={(size) => {
                  setPageSize(size);
                  setPage(0);
                }}
              />
            ) : null}
          </>
        )}
      </div>
      {/* Announces the sort change; the visual cue is the arrow in the header. */}
      <p className="sr-only" aria-live="polite">
        {sort && sortedColumn ? `Sorted by ${sortedColumn.header}, ${sort.dir === "asc" ? "ascending" : "descending"}` : "Not sorted"}
      </p>
    </div>
  );
}

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
};

export function Pagination({ page, pageCount, total, pageSize, onPage, onPageSize }: PaginationProps) {
  const { from, to } = pageRange(page, pageSize, total);
  if (total <= 10 && pageCount <= 1 && !onPageSize) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2">
      <p className="tnum text-xs text-fg-muted" aria-live="polite">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        {onPageSize ? (
          <div className="w-32">
            <Select aria-label="Rows per page" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <IconButton icon="chevron-left" label="Previous page" size="sm" variant="secondary" disabled={page === 0} onClick={() => onPage(page - 1)} />
        <span className="tnum text-xs text-fg-muted">
          {page + 1} / {pageCount}
        </span>
        <IconButton icon="chevron-right" label="Next page" size="sm" variant="secondary" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} />
      </div>
    </div>
  );
}
