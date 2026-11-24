"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { demoStore, simulatedToast, useDemoCollection } from "@/demo-state";
import type { Store } from "@/types/core";

import { WEBSITE_SETTING_PARTS, settingKey } from "./settings/keys";

const NO_WEBSITES: Store[] = [];

/**
 * Deletes a website from this browser's demo data: the row is removed (a built-in demo website is hidden,
 * a website created here is dropped) and its saved settings are cleared. Then it goes back to the list.
 */
export function useDeleteWebsite() {
  const router = useRouter();
  const toast = useToast();
  const { remove } = useDemoCollection<Store>("websites", NO_WEBSITES);
  return (site: { id: string; name: string }) => {
    remove(site.id, { kind: "website.updated", label: `Website deleted: ${site.name}`, refs: { websiteId: site.id } });
    for (const part of WEBSITE_SETTING_PARTS) demoStore.clearSetting(settingKey(site.id, part));
    toast.push(simulatedToast(`${site.name} deleted`, "warning"));
    router.push("/stores");
  };
}

/** Asks the person to type the website name before it is deleted. Give it a `key` of the website id so the field resets. */
export function DeleteWebsiteDialog({ website, onClose, onConfirm }: { website: { name: string } | null; onClose: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState("");
  const name = website?.name ?? "";
  const matches = name !== "" && typed.trim().toLowerCase() === name.trim().toLowerCase();
  return (
    <Dialog
      open={website !== null}
      onClose={onClose}
      title={name ? `Delete ${name}?` : "Delete website?"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" icon="trash" disabled={!matches} onClick={onConfirm}>Delete website</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-fg-muted">
          This removes the website and its prompts, results, tasks and settings from this browser. It cannot be undone. Nothing real is deleted: this is a demo.
        </p>
        <Field label={`Type "${name}" to confirm`}>
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}
