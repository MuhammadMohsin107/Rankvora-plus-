"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/overlay";
import type { BillingContact, PaymentMethod } from "@/types/settings";

import { demoCardBrand, digitsOnly, parseExpiry, validateCvc, validateDemoCard, validateExpiry } from "./billing-model";
import { COUNTRIES, validateEmailAddress, validateText } from "./options";
import type { Billing } from "./use-billing";
import { useSyncedDraft } from "./use-draft";

export function PaymentTab({ b }: { b: Billing }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2">
      <PaymentMethodCard b={b} />
      <ContactCard b={b} />
    </div>
  );
}

function PaymentMethodCard({ b }: { b: Billing }) {
  const [open, setOpen] = useState(false);
  const m = b.state.paymentMethod;
  return (
    <Card>
      <CardHeader title="Payment method" />
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-control border border-line bg-surface-2 p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface text-fg-muted">
            <Icon name="credit-card" size={20} />
          </span>
          <div className="min-w-0">
            <p className="tnum font-medium text-fg">{m.brand} ending {m.last4} (demo)</p>
            <p className="tnum text-helper text-fg-subtle">Expires {String(m.expMonth).padStart(2, "0")}/{m.expYear} · {m.holder}</p>
          </div>
          <Badge tone="accent" icon="flask" className="ml-auto">Demo</Badge>
        </div>
        <div>
          <Button variant="secondary" icon="pencil" onClick={() => setOpen(true)}>
            Update card
          </Button>
        </div>
      </CardBody>
      <UpdateCardDialog open={open} onClose={() => setOpen(false)} onSave={(method) => b.actions.updatePaymentMethod(method)} holder={m.holder} />
    </Card>
  );
}

function formatCardNumber(value: string): string {
  const digits = digitsOnly(value).slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

/** Validates a demo test card. Only the brand and last 4 digits leave this component; the number and code are discarded. */
function UpdateCardDialog({ open, onClose, onSave, holder: initialHolder }: { open: boolean; onClose: () => void; onSave: (method: PaymentMethod) => void; holder: string }) {
  const [holder, setHolder] = useState(initialHolder);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const brand = demoCardBrand(number);
  const errors = {
    holder: validateText(holder, "Cardholder name", 2, 80),
    number: validateDemoCard(number),
    expiry: validateExpiry(expiry),
    cvc: validateCvc(cvc, brand),
  };
  const touch = (key: string) => setTouched((t) => ({ ...t, [key]: true }));
  const show = (key: keyof typeof errors) => (touched[key] ? (errors[key] ?? undefined) : undefined);
  const dirty = number !== "" || expiry !== "" || cvc !== "";

  const reset = () => {
    setNumber("");
    setExpiry("");
    setCvc("");
    setTouched({});
  };
  const close = () => {
    reset();
    onClose();
  };
  const submit = () => {
    setTouched({ holder: true, number: true, expiry: true, cvc: true });
    if (Object.values(errors).some(Boolean) || !brand) return;
    const { month, year } = parseExpiry(expiry);
    onSave({ brand, last4: digitsOnly(number).slice(-4), expMonth: month, expYear: year, holder: holder.trim() });
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Update card"
      description="Demo only: use 4242 4242 4242 4242. Nothing is charged or saved."
      size="sm"
      dirty={dirty}
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={submit}>Update card</Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Cardholder name" required error={show("holder")}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={holder} autoComplete="off" onChange={(e) => setHolder(e.target.value)} onBlur={() => touch("holder")} />}
        </Field>
        <Field label="Demo card number" required error={show("number")} hint={brand ? `${brand} demo card` : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              value={number}
              onChange={(e) => setNumber(formatCardNumber(e.target.value))}
              onBlur={() => touch("number")}
            />
          )}
        </Field>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
          <Field label="Expiry" required error={show("expiry")}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="numeric" autoComplete="off" placeholder="MM/YY" maxLength={5} value={expiry} onChange={(e) => setExpiry(e.target.value)} onBlur={() => touch("expiry")} />}
          </Field>
          <Field label="Security code" required error={show("cvc")}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="numeric" autoComplete="off" placeholder="123" maxLength={4} value={cvc} onChange={(e) => setCvc(digitsOnly(e.target.value))} onBlur={() => touch("cvc")} />}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

function ContactCard({ b }: { b: Billing }) {
  const saved = b.state.contact;
  const [values, setValues] = useSyncedDraft<BillingContact>(saved);
  const [touched, setTouched] = useState(false);
  const dirty = (Object.keys(saved) as (keyof BillingContact)[]).some((key) => saved[key] !== values[key]);
  const errors = { name: validateText(values.name, "Name", 2, 80), email: validateEmailAddress(values.email) };
  const set = (key: keyof BillingContact) => (value: string) => setValues((v) => ({ ...v, [key]: value }));
  const save = () => {
    setTouched(true);
    if (errors.name || errors.email) return;
    b.actions.saveContact({ ...values, name: values.name.trim(), email: values.email.trim() });
    setTouched(false);
  };
  return (
    <Card>
      <CardHeader title="Billing contact" />
      <CardBody>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            <Field label="Name" required error={touched ? (errors.name ?? undefined) : undefined}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="name" value={values.name} onChange={(e) => set("name")(e.target.value)} />}
            </Field>
            <Field label="Billing email" required error={touched ? (errors.email ?? undefined) : undefined}>
              {({ id, describedBy, invalid }) => <Input id={id} type="email" aria-describedby={describedBy} invalid={invalid} autoComplete="email" value={values.email} onChange={(e) => set("email")(e.target.value)} />}
            </Field>
          </div>
          <details className="group rounded-control border border-line">
            <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-control px-3.5 py-2.5 text-body font-medium text-fg focus-visible:outline-2 focus-visible:outline-ring">
              Company and tax details
              <Icon name="chevron-down" size={16} className="text-fg-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 border-t border-line p-3.5 sm:grid-cols-2">
              <Field label="Company name" className="sm:col-span-2">
                {({ id }) => <Input id={id} autoComplete="organization" value={values.legalName} onChange={(e) => set("legalName")(e.target.value)} />}
              </Field>
              <Field label="Address" className="sm:col-span-2">
                {({ id }) => <Input id={id} autoComplete="street-address" value={values.addressLine} onChange={(e) => set("addressLine")(e.target.value)} />}
              </Field>
              <Field label="City">
                {({ id }) => <Input id={id} autoComplete="address-level2" value={values.city} onChange={(e) => set("city")(e.target.value)} />}
              </Field>
              <Field label="Postal code">
                {({ id }) => <Input id={id} autoComplete="postal-code" value={values.postalCode} onChange={(e) => set("postalCode")(e.target.value)} />}
              </Field>
              <Field label="Country">
                {({ id }) => (
                  <Select id={id} value={values.country} onChange={(e) => set("country")(e.target.value)}>
                    {COUNTRIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Tax ID" hint="Optional. VAT, GST or TRN.">
                {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} autoComplete="off" value={values.taxId} onChange={(e) => set("taxId")(e.target.value)} />}
              </Field>
            </div>
          </details>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="secondary" disabled={!dirty}>Save contact</Button>
            {!dirty ? <span className="text-helper text-fg-subtle">No changes</span> : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
