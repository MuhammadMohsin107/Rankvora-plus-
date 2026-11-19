"use client";

import { useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button, IconButton } from "./button";
import { EmptyState } from "./feedback";
import { Checkbox, SearchField, Select } from "./form";
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
  /** Hide the column below this breakpoint to keep mobile tables compact. */
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

type DataTableProps<T> = {
  /** Accessible name of the table. */
  label: string;
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchable?: { placeholder?: string; text: (row: T) => string };
  filters?: TableFilter<T>[];
  defaultSort?: { column: string; dir: "asc" | "desc" };
  selectable?: boolean;
  /** Rendered in a bar while rows are selected. */
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  empty?: ReactNode;
  toolbarExtra?: ReactNode;
  dense?: boolean;
  className?: string;
};

const hideClass = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell", "2xl": "hidden 2xl:table-cell" };
const alignClass = { left: "text-left", right: "text-right", center: "text-center" };

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
  pageSize: initialPageSize = 10,
  empty,
  toolbarExtra,
  dense,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(defaultSort ?? null);
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
      if (column?.sort) {
        const getter = column.sort;
        const dir = sort.dir === "asc" ? 1 : -1;
        result = [...result].sort((a, b) => {
          const av = getter(a);
          const bv = getter(b);
          if (av === bv) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          return (av < bv ? -1 : 1) * dir;
        });
      }
    }
    return result;
  }, [data, query, filterValues, sort, searchable, filters, columns]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const selectedRows = data.filter((row) => selected.has(rowKey(row)));
  const allOnPage = pageRows.length > 0 && pageRows.every((row) => selected.has(rowKey(row)));
  const filtering = Boolean(query.trim()) || Object.values(filterValues).some(Boolean);

  const toggleSort = (column: Column<T>) => {
    if (!column.sort) return;
    setSort((current) => (current?.column !== column.id ? { column: column.id, dir: "asc" } : current.dir === "asc" ? { column: column.id, dir: "desc" } : null));
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
  const cellPad = dense ? "px-3 py-2" : "px-3.5 py-2.5 pointer-coarse:py-3.5";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {hasToolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {searchable ? (
            <SearchField
              label={`Search ${label}`}
              placeholder={searchable.placeholder ?? "Search"}
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(0);
              }}
              className="w-full sm:w-64"
            />
          ) : null}
          {(filters ?? []).map((filter) => (
            <div key={filter.id} className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-36">
              <Select
                aria-label={filter.label}
                value={filterValues[filter.id] ?? ""}
                onChange={(event) => {
                  setFilterValues((current) => ({ ...current, [filter.id]: event.target.value }));
                  setPage(0);
                }}
              >
                <option value="">{filter.label}: all</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ))}
          {filtering ? (
            <Button variant="ghost" size="sm" icon="x" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
          {toolbarExtra ? <div className="ml-auto flex items-center gap-2">{toolbarExtra}</div> : null}
        </div>
      ) : null}

      {selectable && selectedRows.length > 0 && bulkActions ? (
        <div className="flex flex-wrap items-center gap-2 rounded-control border border-accent/30 bg-accent-soft px-3 py-2" role="region" aria-label="Bulk actions">
          <span className="tnum text-[13px] font-medium text-accent-text">{selectedRows.length} selected</span>
          <div className="flex flex-wrap items-center gap-1.5">{bulkActions(selectedRows, () => setSelected(new Set()))}</div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            Deselect
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="ui-scroll overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-[13px] sm:min-w-0">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr className="border-b border-line bg-surface-2/70">
                {selectable ? (
                  <th scope="col" className="w-10 px-3.5 py-2.5">
                    <Checkbox checked={allOnPage} onChange={togglePage} aria-label="Select all rows on this page" />
                  </th>
                ) : null}
                {columns.map((column) => {
                  const sorted = sort?.column === column.id ? sort.dir : null;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={column.sort ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined}
                      className={cn(
                        "px-3.5 py-2.5 text-xs font-medium text-fg-muted",
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
                          className={cn("-mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:text-fg", column.align === "right" && "flex-row-reverse")}
                        >
                          {column.header}
                          <Icon name={sorted === "asc" ? "chevron-up" : sorted === "desc" ? "chevron-down" : "chevrons-up-down"} size={13} className={sorted ? "text-accent-text" : "text-fg-subtle"} />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const key = rowKey(row);
                const isSelected = selected.has(key);
                return (
                  <tr
                    key={key}
                    onClick={
                      onRowClick
                        ? (event) => {
                            if ((event.target as HTMLElement).closest("a,button,input,select,textarea,label,[role=menu],[role=menuitem]")) return;
                            onRowClick(row);
                          }
                        : undefined
                    }
                    className={cn(
                      "border-b border-line last:border-0 transition-colors duration-[var(--dur-fast)]",
                      onRowClick && "cursor-pointer",
                      isSelected ? "bg-accent-soft/60" : "hover:bg-surface-2/60",
                    )}
                  >
                    {selectable ? (
                      <td className="w-10 px-3.5 py-2.5" onClick={(event) => event.stopPropagation()}>
                        <Checkbox checked={isSelected} onChange={() => toggleRow(key)} aria-label="Select row" />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td key={column.id} className={cn(cellPad, "align-middle text-fg", alignClass[column.align ?? "left"], column.hideBelow && hideClass[column.hideBelow])}>
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pageRows.length === 0 ? (
          <div className="p-4">
            {filtering ? (
              <EmptyState icon="filter" title="No matches" description="Nothing fits these filters." action={<Button size="sm" onClick={clearFilters}>Clear filters</Button>} />
            ) : (
              (empty ?? <EmptyState icon="list" title="Nothing here yet" />)
            )}
          </div>
        ) : null}
        {rows.length > 10 ? (
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
      </div>
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
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  if (total <= 10 && pageCount <= 1 && !onPageSize) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3.5 py-2">
      <p className="tnum text-xs text-fg-muted" aria-live="polite">
        {from}–{to} of {total}
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
