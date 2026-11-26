"use client";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import type { IconName } from "@/components/ui/icon";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { simulatedToast } from "@/demo-state";
import { formatDate } from "@/lib/format";
import type { Tone } from "@/lib/status";
import type { BillingInvoice, InvoiceStatus } from "@/types/settings";

import { INVOICE_STATUS_LABEL, formatUsd } from "./billing-model";
import { downloadFile, invoiceHtml, invoicesCsv } from "./invoice-files";
import type { Billing } from "./use-billing";

const STATUS_STYLE: Record<InvoiceStatus, { tone: Tone; icon: IconName }> = {
  paid: { tone: "success", icon: "check-circle" },
  open: { tone: "info", icon: "clock" },
  failed: { tone: "danger", icon: "x-circle" },
  refunded: { tone: "neutral", icon: "undo" },
};

export function InvoicesTab({ b }: { b: Billing }) {
  const toast = useToast();
  const downloadHtml = (inv: BillingInvoice) => {
    downloadFile(`${inv.id}.html`, "text/html", invoiceHtml(inv, { organization: b.organization }));
    toast.push(simulatedToast(`Invoice ${inv.id} prepared`, "info"));
  };
  const downloadCsv = (list: BillingInvoice[], name: string) => {
    downloadFile(name, "text/csv", invoicesCsv(list));
    toast.push(simulatedToast(`${list.length === 1 ? "Invoice" : "Invoices"} CSV prepared`, "info"));
  };

  const columns: Column<BillingInvoice>[] = [
    {
      id: "id",
      header: "Invoice",
      sort: (r) => r.id,
      cell: (r) => (
        <div className="min-w-0">
          <p className="tnum font-medium text-fg">{r.id}</p>
          <p className="truncate text-helper text-fg-subtle" title={r.note ?? r.description}>{r.description}{r.note ? ` · ${r.note}` : ""}</p>
        </div>
      ),
    },
    { id: "date", header: "Date", sort: (r) => r.issuedOn, cell: (r) => <span className="tnum whitespace-nowrap text-fg-muted">{formatDate(r.issuedOn)}</span> },
    { id: "period", header: "Period", hideBelow: "md", sort: (r) => r.issuedOn, cell: (r) => <span className="whitespace-nowrap text-fg-muted">{r.period}</span> },
    { id: "amount", header: "Amount", align: "right", sort: (r) => r.amountUsd, cell: (r) => <span className="tnum">{formatUsd(r.amountUsd)}</span> },
    {
      id: "status",
      header: "Status",
      sort: (r) => r.status,
      cell: (r) => (
        <Badge tone={STATUS_STYLE[r.status].tone} icon={STATUS_STYLE[r.status].icon}>
          {INVOICE_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (r) => {
        const items: MenuItem[] = [
          { label: "Download printable HTML", icon: "download", onSelect: () => downloadHtml(r) },
          { label: "Download CSV", icon: "file-text", onSelect: () => downloadCsv([r], `${r.id}.csv`) },
        ];
        if (r.status === "open" || r.status === "failed") {
          items.push({ type: "separator" }, { label: "Pay now (simulated)", icon: "credit-card", onSelect: () => b.actions.payInvoice(r.id) });
        }
        return (
          <div className="flex justify-end">
            <Menu label={`Actions for ${r.id}`} trigger={<IconButton icon="more" label={`Actions for ${r.id}`} size="sm" />} items={items} width={240} />
          </div>
        );
      },
    },
  ];

  return (
    <DataTable<BillingInvoice>
      label="Invoices"
      data={b.invoices}
      columns={columns}
      rowKey={(r) => r.id}
      searchable={{ placeholder: "Search invoices", text: (r) => `${r.id} ${r.description} ${r.period} ${INVOICE_STATUS_LABEL[r.status]}` }}
      filters={[{ id: "status", label: "Status", options: (Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[]).map((value) => ({ value, label: INVOICE_STATUS_LABEL[value] })), value: (r) => r.status }]}
      defaultSort={{ column: "date", dir: "desc" }}
      toolbarExtra={
        <Button variant="secondary" icon="download" onClick={() => downloadCsv(b.invoices, "rankvora-demo-invoices.csv")}>
          Export CSV
        </Button>
      }
    />
  );
}
