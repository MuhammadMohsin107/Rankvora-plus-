"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/table";
import type { CompetitorRow } from "@/types/audit";

import { RateCell } from "./rate-cell";

/** Brand and competitors, each as mentioned ÷ successful responses. */
export function CompetitorTable({ rows }: { rows: CompetitorRow[] }) {
  const columns: Column<CompetitorRow>[] = [
    {
      id: "name",
      header: "Brand",
      sort: (r) => r.name,
      cell: (r) => (
        <span className="flex items-center gap-2 font-medium">
          {r.name}
          {r.isBrand ? <Badge tone="accent">Your brand</Badge> : null}
          {r.suggested ? <Badge tone="neutral" title="Suggested, not yet confirmed in store settings">Suggested</Badge> : null}
        </span>
      ),
    },
    {
      id: "rate",
      header: "Mentioned in",
      sort: (r) => (r.mentioned.d > 0 ? r.mentioned.n / r.mentioned.d : null),
      cell: (r) => <RateCell n={r.mentioned.n} d={r.mentioned.d} unit="responses" />,
    },
  ];
  return <DataTable label="Competitor mentions" data={rows} columns={columns} rowKey={(r) => r.id} defaultSort={{ column: "rate", dir: "desc" }} dense />;
}
