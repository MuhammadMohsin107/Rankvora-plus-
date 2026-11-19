"use client";

import { useState } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { ProductService } from "@/types/core";

import { validateOptionalUrl, validateRequired } from "../validation";
import { nextId } from "./util";

type Props = {
  storeId: string;
  products: ProductService[];
  readOnly: boolean;
  onChange: (next: ProductService[], logTitle: string) => void;
};

type Editing = { mode: "add" } | { mode: "edit"; product: ProductService };

export function ProductsTab({ storeId, products, readOnly, onChange }: Props) {
  const toast = useToast();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [removing, setRemoving] = useState<ProductService | null>(null);

  const titleError = validateRequired(title, "Name", 2, 120);
  const urlError = validateOptionalUrl(url);

  const open = (next: Editing) => {
    setEditing(next);
    setTitle(next.mode === "edit" ? next.product.title : "");
    setCategory(next.mode === "edit" ? next.product.category : "");
    setUrl(next.mode === "edit" ? next.product.url : "");
    setTouched(false);
  };
  const close = () => setEditing(null);

  const save = () => {
    setTouched(true);
    if (titleError || urlError || !editing) return;
    const values = { title: title.trim(), category: category.trim(), url: url.trim() };
    if (editing.mode === "add") {
      onChange([...products, { id: nextId("local-prod", products.map((p) => p.id)), storeId, ...values }], `Product added: ${values.title}`);
      toast.push({ title: `${values.title} added`, description: "Demo action: nothing was changed on a server." });
    } else {
      onChange(products.map((p) => (p.id === editing.product.id ? { ...p, ...values } : p)), `Product edited: ${values.title}`);
      toast.push({ title: `${values.title} updated`, description: "Demo action: nothing was changed on a server." });
    }
    close();
  };

  const columns: Column<ProductService>[] = [
    { id: "title", header: "Product or service", sort: (p) => p.title.toLowerCase(), cell: (p) => <span className="font-medium text-fg">{p.title}</span> },
    { id: "category", header: "Category", hideBelow: "sm", sort: (p) => p.category.toLowerCase(), cell: (p) => p.category || <span className="text-fg-subtle">None</span> },
    {
      id: "url",
      header: "Page",
      hideBelow: "md",
      cell: (p) =>
        p.url ? (
          <a href={p.url} target="_blank" rel="noreferrer" className="inline-block max-w-64 truncate rounded text-accent-text hover:underline">{p.url.replace(/^https?:\/\//, "")}</a>
        ) : (
          <span className="text-fg-subtle">None</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (p) => (
        <div className="flex justify-end">
          <Menu
            trigger={<IconButton icon="more" label={`Actions for ${p.title}`} size="sm" />}
            width={180}
            items={[
              { label: "Edit", icon: "pencil", disabled: readOnly, disabledReason: "Store is archived", onSelect: () => open({ mode: "edit", product: p }) },
              { label: "Remove", icon: "trash", tone: "danger", disabled: readOnly, disabledReason: "Store is archived", onSelect: () => setRemoving(p) },
            ]}
          />
        </div>
      ),
    },
  ];

  const addButton = <Button variant="primary" icon="plus" disabled={readOnly} onClick={() => open({ mode: "add" })}>Add product</Button>;

  return (
    <>
      <DataTable<ProductService>
        label="Products and services"
        data={products}
        columns={columns}
        rowKey={(p) => p.id}
        searchable={{ placeholder: "Search products", text: (p) => `${p.title} ${p.category}` }}
        defaultSort={{ column: "title", dir: "asc" }}
        toolbarExtra={addButton}
        empty={<EmptyState icon="store" title="No products yet" description="AI answers need products to associate with the brand." action={addButton} />}
      />

      <Dialog
        open={editing !== null}
        onClose={close}
        title={editing?.mode === "edit" ? "Edit product or service" : "Add product or service"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={save}>{editing?.mode === "edit" ? "Save changes" : "Add"}</Button>
          </>
        }
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field label="Name" required error={touched ? (titleError ?? undefined) : undefined}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => setTouched(true)} />}
          </Field>
          <Field label="Category">
            {({ id }) => <Input id={id} value={category} placeholder="Road running" onChange={(e) => setCategory(e.target.value)} />}
          </Field>
          <Field label="Page address" error={touched ? (urlError ?? undefined) : undefined}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="url" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} onBlur={() => setTouched(true)} />}
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            onChange(products.filter((p) => p.id !== removing.id), `Product removed: ${removing.title}`);
            toast.push({ title: `${removing.title} removed`, description: "Demo action: nothing was changed on a server." });
          }
          setRemoving(null);
        }}
        title={removing ? `Remove ${removing.title}?` : ""}
        confirmLabel="Remove"
      >
        It is no longer linked to prompts or used in future runs. Past results keep it.
      </ConfirmDialog>
    </>
  );
}
