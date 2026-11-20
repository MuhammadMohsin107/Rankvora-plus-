"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { Mono } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { simulatedToast } from "@/demo-state";
import { DEMO_NOW, formatDate } from "@/lib/format";
import type { DomainAlias, DomainRecord } from "@/types/settings";

import { normalizeWebsite } from "../validation";

type Props = {
  record: DomainRecord;
  readOnly: boolean;
  /** Date the current canonical domain became canonical (website creation when unknown). */
  since: string;
  onChange: (next: DomainRecord, logTitle: string, detail?: string) => void;
};

export function DomainsTab({ record, readOnly, since, onChange }: Props) {
  const toast = useToast();
  const [host, setHost] = useState("");
  const [kind, setKind] = useState<DomainAlias["kind"]>("redirect");
  const [hostError, setHostError] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [newCanonical, setNewCanonical] = useState("");
  const [canonicalError, setCanonicalError] = useState<string | null>(null);
  const [confirmCanonical, setConfirmCanonical] = useState<string | null>(null);

  const taken = (value: string) => value === record.canonical || record.aliases.some((a) => a.host === value) || record.former.some((f) => f.host === value);

  const addAlias = () => {
    const result = normalizeWebsite(host);
    if (result.host === undefined) return setHostError(result.error);
    if (taken(result.host)) return setHostError("This domain is already listed.");
    setHostError(null);
    onChange({ ...record, aliases: [...record.aliases, { host: result.host, kind }] }, `Domain ${kind} added: ${result.host}`, kind === "redirect" ? `Redirects to ${record.canonical}` : undefined);
    toast.push(simulatedToast(`Domain added: ${result.host}`));
    setHost("");
  };

  const removeAlias = (alias: DomainAlias) => {
    onChange({ ...record, aliases: record.aliases.filter((a) => a.host !== alias.host) }, `Domain ${alias.kind} removed: ${alias.host}`);
    toast.push(simulatedToast(`Domain removed: ${alias.host}`));
  };

  const closeChange = () => {
    setChangeOpen(false);
    setNewCanonical("");
    setCanonicalError(null);
  };
  const reviewChange = () => {
    const result = normalizeWebsite(newCanonical);
    if (result.host === undefined) return setCanonicalError(result.error);
    if (result.host === record.canonical) return setCanonicalError("This is already the canonical domain.");
    setCanonicalError(null);
    setConfirmCanonical(result.host);
    setChangeOpen(false);
  };
  const applyChange = () => {
    if (!confirmCanonical) return;
    onChange(
      {
        ...record,
        canonical: confirmCanonical,
        aliases: record.aliases.filter((a) => a.host !== confirmCanonical),
        former: [{ host: record.canonical, from: since, to: DEMO_NOW, reason: "Canonical domain changed" }, ...record.former],
      },
      `Canonical domain changed to ${confirmCanonical}`,
      `${record.canonical} moved to former domains`,
    );
    toast.push(simulatedToast(`Canonical domain changed to ${confirmCanonical}`));
    setConfirmCanonical(null);
    setNewCanonical("");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader title="Canonical domain" info="The main address this website is measured on. Results link to it." />
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] font-medium text-fg">{record.canonical}</p>
            <Button variant="secondary" disabled={readOnly} onClick={() => setChangeOpen(true)}>Change</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Aliases and redirects" />
          <CardBody className="flex flex-col gap-4">
            {record.aliases.length === 0 ? (
              <p className="text-[13px] text-fg-muted">No aliases yet.</p>
            ) : (
              <ul className="divide-y divide-line rounded-control border border-line">
                {record.aliases.map((alias) => (
                  <li key={alias.host} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] text-fg">{alias.host}</span>
                      <Badge tone={alias.kind === "redirect" ? "info" : "neutral"} icon={alias.kind === "redirect" ? "arrow-right" : "link"}>{alias.kind === "redirect" ? "Redirects" : "Alias"}</Badge>
                    </div>
                    <IconButton icon="trash" label={`Remove ${alias.host}`} size="sm" disabled={readOnly} onClick={() => removeAlias(alias)} />
                  </li>
                ))}
              </ul>
            )}
            <form
              noValidate
              className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_9rem_auto] md:items-start"
              onSubmit={(event) => {
                event.preventDefault();
                addAlias();
              }}
            >
              <Field label="Add domain" error={hostError ?? undefined}>
                {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="url" disabled={readOnly} value={host} placeholder="www.example.com" onChange={(e) => setHost(e.target.value)} />}
              </Field>
              <Field label="Type">
                {({ id }) => (
                  <Select id={id} disabled={readOnly} value={kind} onChange={(e) => setKind(e.target.value as DomainAlias["kind"])}>
                    <option value="redirect">Redirects</option>
                    <option value="alias">Alias</option>
                  </Select>
                )}
              </Field>
              <Button type="submit" variant="secondary" icon="plus" disabled={readOnly} className="md:mt-[26px]">Add</Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader title="Former domains" info="Past audits and runs keep the domain they were measured on." />
        <CardBody>
          {record.former.length === 0 ? (
            <p className="text-[13px] text-fg-muted">No former domains.</p>
          ) : (
            <ul className="divide-y divide-line">
              {record.former.map((f) => (
                <li key={`${f.host}-${f.to}`} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                  <Mono className="self-start">{f.host}</Mono>
                  <p className="tnum text-xs text-fg-muted">{formatDate(f.from)} to {formatDate(f.to)}</p>
                  <p className="text-xs text-fg-subtle">{f.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Dialog
        open={changeOpen}
        onClose={closeChange}
        title="Change canonical domain"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeChange}>Cancel</Button>
            <Button variant="primary" onClick={reviewChange}>Review change</Button>
          </>
        }
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            reviewChange();
          }}
        >
          <Field label="New domain" error={canonicalError ?? undefined} hint="Saved as the host name only">
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="url" value={newCanonical} placeholder="example.com" onChange={(e) => setNewCanonical(e.target.value)} />}
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmCanonical !== null}
        onClose={() => setConfirmCanonical(null)}
        onConfirm={applyChange}
        title={`Make ${confirmCanonical ?? ""} canonical?`}
        confirmLabel="Change domain"
        tone="primary"
      >
        <p>{record.canonical} moves to former domains.</p>
        <p className="mt-2">New runs measure {confirmCanonical}. Past audits and runs keep {record.canonical}, so before and after comparisons may be only partly comparable.</p>
      </ConfirmDialog>
    </div>
  );
}
