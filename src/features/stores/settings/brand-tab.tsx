"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ChipInput } from "@/components/ui/chip-input";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { DiffView, Timeline } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import type { BrandVersion } from "@/types/settings";

import { INDUSTRIES } from "../options";
import { validateRequired } from "../validation";

export type BrandDraft = { brandName: string; category: string; description: string; aliases: string[]; differentiators: string[] };

export const draftFromVersion = (v: BrandVersion | undefined, fallbackCategory = ""): BrandDraft => ({
  brandName: v?.brandName ?? "",
  category: v?.category ?? fallbackCategory,
  description: v?.description ?? "",
  aliases: v?.aliases ?? [],
  differentiators: v?.differentiators ?? [],
});

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item, index) => item === b[index]);

function listChange(label: string, before: string[], after: string[]) {
  const added = after.filter((x) => !before.includes(x));
  const removed = before.filter((x) => !after.includes(x));
  if (added.length === 0 && removed.length === 0) return null;
  return (
    <p key={label} className="text-[13px] text-fg-muted">
      <span className="font-medium text-fg">{label}:</span> {added.length ? `added ${added.join(", ")}` : ""}
      {added.length && removed.length ? "; " : ""}
      {removed.length ? `removed ${removed.join(", ")}` : ""}
    </p>
  );
}

type Props = {
  versions: BrandVersion[];
  draft: BrandDraft;
  onDraft: (next: BrandDraft) => void;
  readOnly: boolean;
  onSaveVersion: (note: string) => void;
  timezone: string;
  /** Category used when a version has none (the website's current category). */
  fallbackCategory: string;
};

export function BrandTab({ versions, draft, onDraft, readOnly, onSaveVersion, timezone, fallbackCategory }: Props) {
  const current = versions[0];
  const [touched, setTouched] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [note, setNote] = useState("");
  const [viewing, setViewing] = useState<BrandVersion | null>(null);

  const base = draftFromVersion(current, fallbackCategory);
  const dirty = draft.brandName !== base.brandName || draft.category !== base.category || draft.description !== base.description || !sameList(draft.aliases, base.aliases) || !sameList(draft.differentiators, base.differentiators);
  const nameError = validateRequired(draft.brandName, "Brand name", 2, 80);
  const descriptionError = draft.description.length > 400 ? "Keep the description to 400 characters." : null;
  const noteError = note.length > 120 ? "Keep the note to 120 characters." : null;

  const closeSave = () => {
    setSaveOpen(false);
    setNote("");
  };
  const requestSave = () => {
    setTouched(true);
    if (nameError || descriptionError) return;
    setSaveOpen(true);
  };
  const confirmSave = () => {
    if (noteError) return;
    onSaveVersion(note.trim() || "Edited brand profile");
    closeSave();
    setTouched(false);
  };

  const viewIndex = viewing ? versions.findIndex((v) => v.version === viewing.version) : -1;
  const previous = viewIndex >= 0 ? versions[viewIndex + 1] : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <Card className="min-w-0">
        <CardHeader title="Brand profile" />
        <CardBody>
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              requestSave();
            }}
          >
            <Field label="Brand name" required error={touched ? (nameError ?? undefined) : undefined}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} invalid={invalid} value={draft.brandName} disabled={readOnly} onChange={(e) => onDraft({ ...draft, brandName: e.target.value })} onBlur={() => setTouched(true)} />
              )}
            </Field>
            <Field label="Category">
              {({ id }) => (
                <Select id={id} value={draft.category} disabled={readOnly} onChange={(e) => onDraft({ ...draft, category: e.target.value })}>
                  {(INDUSTRIES.includes(draft.category) || !draft.category ? INDUSTRIES : [draft.category, ...INDUSTRIES]).map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </Select>
              )}
            </Field>
            <ChipInput label="Aliases" hint="Press Enter to add" values={draft.aliases} disabled={readOnly} onChange={(aliases) => onDraft({ ...draft, aliases })} />
            <Field label="Description" error={touched ? (descriptionError ?? undefined) : undefined} hint={`${draft.description.length} / 400`}>
              {({ id, describedBy, invalid }) => (
                <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={3} value={draft.description} disabled={readOnly} placeholder="What the brand offers and who for" onChange={(e) => onDraft({ ...draft, description: e.target.value })} onBlur={() => setTouched(true)} />
              )}
            </Field>
            <ChipInput label="Differentiators" hint="Press Enter to add" values={draft.differentiators} disabled={readOnly} onChange={(differentiators) => onDraft({ ...draft, differentiators })} />
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" disabled={readOnly || !dirty}>Save as new version</Button>
              <Button variant="ghost" disabled={readOnly || !dirty} onClick={() => { onDraft(base); setTouched(false); }}>Reset</Button>
              {!dirty ? <span className="text-helper text-fg-muted">No changes</span> : null}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="min-w-0 self-start">
        <CardHeader title="Version history" />
        <CardBody>
          {versions.length === 0 ? (
            <p className="text-[13px] text-fg-muted">No versions yet.</p>
          ) : (
            <Timeline
              items={versions.map((v, index) => ({
                id: String(v.version),
                icon: index === 0 ? "check-circle" : "history",
                tone: index === 0 ? "accent" : "neutral",
                title: (
                  <span className="flex items-center gap-2">
                    v{v.version}
                    {index === 0 ? <Badge tone="accent">Current</Badge> : null}
                  </span>
                ),
                time: formatDateTime(v.createdAt, timezone),
                meta: (
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span>{v.note} · {v.createdBy}</span>
                    <button type="button" onClick={() => setViewing(v)} className="cursor-pointer rounded text-accent-text hover:underline">Changes</button>
                  </span>
                ),
              }))}
            />
          )}
        </CardBody>
      </Card>

      <Dialog
        open={saveOpen}
        onClose={closeSave}
        title={`Save as v${(current?.version ?? 0) + 1}`}
        description="Earlier audits and runs keep the version they used."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeSave}>Cancel</Button>
            <Button variant="primary" onClick={confirmSave}>Save version</Button>
          </>
        }
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            confirmSave();
          }}
        >
          <Field label="What changed" hint="Optional" error={noteError ?? undefined}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={note} placeholder="Added spelling variants" onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </form>
      </Dialog>

      <Dialog open={viewing !== null} onClose={() => setViewing(null)} title={viewing ? `Changes in v${viewing.version}` : ""} description={previous ? undefined : "First version"} size="lg">
        {viewing ? (
          <div className="flex flex-col gap-3">
            <DiffView before={previous?.description ?? ""} after={viewing.description} beforeLabel={previous ? `v${previous.version} description` : "Before"} afterLabel={`v${viewing.version} description`} />
            {listChange("Aliases", previous?.aliases ?? [], viewing.aliases)}
            {listChange("Differentiators", previous?.differentiators ?? [], viewing.differentiators)}
            {previous && (previous.category ?? "") !== (viewing.category ?? "") ? <p className="text-[13px] text-fg-muted"><span className="font-medium text-fg">Category:</span> {previous.category || "None"} to {viewing.category || "None"}</p> : null}
            {previous && previous.brandName !== viewing.brandName ? <p className="text-[13px] text-fg-muted"><span className="font-medium text-fg">Brand name:</span> {previous.brandName} to {viewing.brandName}</p> : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
