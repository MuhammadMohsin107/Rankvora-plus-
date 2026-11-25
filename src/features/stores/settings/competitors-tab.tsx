"use client";

import { useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipInput } from "@/components/ui/chip-input";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { simulatedToast } from "@/demo-state";
import type { Competitor } from "@/types/core";

import { normalizeWebsite, validateRequired } from "../validation";
import { nextId } from "./util";

type Props = {
  storeId: string;
  competitors: Competitor[];
  market: string;
  marketName: string;
  readOnly: boolean;
  onChange: (next: Competitor[], logTitle: string) => void;
};

const STATUS_ORDER = { confirmed: 0, suggested: 1, archived: 2 } as const;

export function CompetitorsTab({ storeId, competitors, market, marketName, readOnly, onChange }: Props) {
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [scope, setScope] = useState<"all" | "market">("market");
  const [touched, setTouched] = useState(false);
  const [archiving, setArchiving] = useState<Competitor | null>(null);

  const nameError = validateRequired(name, "Name", 2, 80);
  const site = normalizeWebsite(domain);
  const duplicate = site.host ? competitors.some((c) => c.domains.includes(site.host)) : false;
  const domainError = site.error ?? (duplicate ? "This competitor is already listed." : null);

  const closeAdd = () => {
    setAddOpen(false);
    setName("");
    setDomain("");
    setAliases([]);
    setScope("market");
    setTouched(false);
  };

  const add = () => {
    setTouched(true);
    if (nameError || domainError || !site.host) return;
    const next: Competitor = { id: nextId("local-comp", competitors.map((c) => c.id)), storeId, name: name.trim(), domains: [site.host], aliases, status: "confirmed", market: scope === "market" ? market : null };
    onChange([...competitors, next], `Competitor added: ${next.name}`);
    toast.push(simulatedToast(`Competitor added: ${next.name}`));
    closeAdd();
  };

  const setStatus = (c: Competitor, status: Competitor["status"], verb: string) => {
    onChange(competitors.map((x) => (x.id === c.id ? { ...x, status } : x)), `Competitor ${verb}: ${c.name}`);
    toast.push(simulatedToast(`Competitor ${verb}: ${c.name}`));
  };

  const columns: Column<Competitor>[] = [
    {
      id: "name",
      header: "Competitor",
      sort: (c) => c.name.toLowerCase(),
      cell: (c) => (
        <div className="min-w-0">
          <p className="font-medium text-fg">{c.name}</p>
          <p className="truncate text-helper text-fg-muted">{c.domains.join(", ") || "No domain"}</p>
        </div>
      ),
    },
    { id: "aliases", header: "Aliases", hideBelow: "md", cell: (c) => (c.aliases.length ? c.aliases.join(", ") : <span className="text-fg-muted">None</span>) },
    { id: "market", header: "Market", hideBelow: "sm", sort: (c) => c.market ?? "", cell: (c) => (c.market ? `${c.market}` : <span className="text-fg-muted">All markets</span>) },
    { id: "status", header: "Status", sort: (c) => STATUS_ORDER[c.status], cell: (c) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Status kind="competitor" value={c.status} />
          {c.status === "suggested" ? <Badge tone="neutral" icon="sparkles">Demo suggestion</Badge> : null}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      cell: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          {c.status === "suggested" ? (
            <>
              <Button size="sm" variant="secondary" icon="check" disabled={readOnly} onClick={() => setStatus(c, "confirmed", "confirmed")}>Confirm</Button>
              <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setStatus(c, "archived", "dismissed")}>Dismiss</Button>
            </>
          ) : null}
          {c.status === "confirmed" ? <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setArchiving(c)}>Archive</Button> : null}
          {c.status === "archived" ? <Button size="sm" variant="ghost" icon="undo" disabled={readOnly} onClick={() => setStatus(c, "confirmed", "restored")}>Restore</Button> : null}
        </div>
      ),
    },
  ];

  const addButton = <Button variant="primary" icon="plus" disabled={readOnly} onClick={() => setAddOpen(true)}>Add competitor</Button>;

  return (
    <>
      <DataTable<Competitor>
        label="Competitors"
        data={competitors}
        columns={columns}
        rowKey={(c) => c.id}
        searchable={{ placeholder: "Search competitors", text: (c) => `${c.name} ${c.domains.join(" ")} ${c.aliases.join(" ")}` }}
        filters={[
          {
            id: "status",
            label: "Status",
            options: [
              { value: "confirmed", label: "Confirmed" },
              { value: "suggested", label: "Suggested" },
              { value: "archived", label: "Archived" },
            ],
            value: (c) => c.status,
          },
        ]}
        defaultSort={{ column: "status", dir: "asc" }}
        toolbarExtra={addButton}
        empty={<EmptyState icon="users" title="No competitors yet" />}
      />

      <Dialog
        open={addOpen}
        onClose={closeAdd}
        title="Add competitor"
        description="Added competitors are confirmed immediately."
        footer={
          <>
            <Button variant="secondary" onClick={closeAdd}>Cancel</Button>
            <Button variant="primary" onClick={add}>Add</Button>
          </>
        }
      >
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <Field label="Name" required error={touched ? (nameError ?? undefined) : undefined}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} />}
          </Field>
          <Field label="Website" required error={touched ? (domainError ?? undefined) : undefined} hint={site.host ? `Saved as ${site.host}` : undefined}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="url" value={domain} placeholder="competitor.com" onChange={(e) => setDomain(e.target.value)} onBlur={() => setTouched(true)} />}
          </Field>
          <ChipInput label="Aliases" hint="Press Enter to add" values={aliases} onChange={setAliases} />
          <Field label="Applies to">
            {({ id }) => (
              <Select id={id} value={scope} onChange={(e) => setScope(e.target.value as "all" | "market")}>
                <option value="market">{market} · {marketName}</option>
                <option value="all">All markets</option>
              </Select>
            )}
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving) setStatus(archiving, "archived", "archived");
          setArchiving(null);
        }}
        title={archiving ? `Archive ${archiving.name}?` : ""}
        confirmLabel="Archive competitor"
      >
        Future runs stop counting this competitor. Past results keep it. You can restore it later.
      </ConfirmDialog>
    </>
  );
}
