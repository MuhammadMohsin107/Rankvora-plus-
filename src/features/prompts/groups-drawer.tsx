"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { ConfirmDialog, Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { pluralize } from "@/lib/format";
import type { PromptGroup } from "@/types/core";

type Props = {
  open: boolean;
  onClose: () => void;
  groups: PromptGroup[];
  /** Prompts per group id. */
  counts: Record<string, number>;
  ungrouped: number;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

/** Create, rename and delete prompt groups. Deleting a group leaves its prompts ungrouped. */
export function GroupsDrawer({ open, onClose, groups, counts, ungrouped, onCreate, onRename, onDelete }: Props) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [editError, setEditError] = useState<string | undefined>();
  const [removing, setRemoving] = useState<PromptGroup | null>(null);

  const clash = (value: string, ignoreId?: string) => groups.some((g) => g.id !== ignoreId && g.name.toLowerCase() === value.trim().toLowerCase());

  const create = () => {
    const value = name.trim();
    if (!value) return setError("Enter a group name.");
    if (clash(value)) return setError("A group with this name exists.");
    onCreate(value);
    setName("");
    setError(undefined);
    toast.push({ title: "Group created", description: value });
  };

  const saveRename = () => {
    if (!editing) return;
    const value = editing.value.trim();
    if (!value) return setEditError("Enter a group name.");
    if (clash(value, editing.id)) return setEditError("A group with this name exists.");
    onRename(editing.id, value);
    setEditing(null);
    setEditError(undefined);
    toast.push({ title: "Group renamed", description: value });
  };

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Manage groups" description="Groups organise the library and audit scope." size="md">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <Field label="New group" error={error} className="min-w-0 flex-1">
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} value={name} maxLength={40} placeholder="e.g. Seasonal" onChange={(event) => setName(event.target.value)} />
            )}
          </Field>
          <Button type="submit" variant="primary" icon="plus" className={error ? "mb-[22px]" : undefined}>Add</Button>
        </form>

        <ul className="mt-5 divide-y divide-line rounded-control border border-line">
          {groups.length === 0 ? <li className="px-3 py-4 text-[13px] text-fg-muted">No groups yet.</li> : null}
          {groups.map((group) => {
            const isEditing = editing?.id === group.id;
            return (
              <li key={group.id} className="flex items-start gap-2 px-3 py-2.5">
                {isEditing ? (
                  <form
                    className="flex min-w-0 flex-1 items-start gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveRename();
                    }}
                  >
                    <Field label={`Rename ${group.name}`} error={editError} className="min-w-0 flex-1">
                      {({ id, describedBy, invalid }) => (
                        <Input id={id} aria-describedby={describedBy} invalid={invalid} value={editing.value} maxLength={40} autoFocus onChange={(event) => setEditing({ id: group.id, value: event.target.value })} />
                      )}
                    </Field>
                    <div className="mt-[26px] flex gap-1">
                      <Button type="submit" size="sm" variant="primary">Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setEditError(undefined); }}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1 self-center">
                      <p className="truncate text-[13px] font-medium text-fg">{group.name}</p>
                    </div>
                    <Badge tone="neutral" className="self-center">{pluralize(counts[group.id] ?? 0, "prompt")}</Badge>
                    <IconButton icon="pencil" label={`Rename ${group.name}`} size="sm" onClick={() => setEditing({ id: group.id, value: group.name })} />
                    <IconButton icon="trash" label={`Delete ${group.name}`} size="sm" onClick={() => setRemoving(group)} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-fg-subtle"><span className="tnum">{pluralize(ungrouped, "prompt")}</span> ungrouped</p>
      </Drawer>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Delete “${removing?.name ?? ""}”?`}
        confirmLabel="Delete group"
        onConfirm={() => {
          if (!removing) return;
          const count = counts[removing.id] ?? 0;
          onDelete(removing.id);
          toast.push({ title: "Group deleted", description: count ? `${pluralize(count, "prompt")} now ungrouped.` : undefined });
          setRemoving(null);
        }}
      >
        {(counts[removing?.id ?? ""] ?? 0) > 0 ? `${pluralize(counts[removing?.id ?? ""] ?? 0, "prompt")} become ungrouped. The prompts themselves are not deleted.` : "This group has no prompts."}
      </ConfirmDialog>
    </>
  );
}
