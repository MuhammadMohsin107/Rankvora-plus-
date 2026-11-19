"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TIMEZONES } from "@/features/stores/options";
import { validateRequired } from "@/features/stores/validation";

type Values = { name: string; timezone: string };

export function GeneralForm({ initial }: { initial: Values }) {
  const toast = useToast();
  const [saved, setSaved] = useState<Values>(initial);
  const [values, setValues] = useState<Values>(initial);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = values.name !== saved.name || values.timezone !== saved.timezone;
  const nameError = validateRequired(values.name, "Organization name", 2, 80);
  const timezones = TIMEZONES.includes(values.timezone) ? TIMEZONES : [values.timezone, ...TIMEZONES];

  const save = () => {
    setTouched(true);
    if (nameError) return;
    setSaving(true);
    window.setTimeout(() => {
      setSaved(values);
      setSaving(false);
      toast.push({ title: "Settings saved", description: "Demo: nothing was changed on a server." });
    }, 500);
  };

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field label="Organization name" required error={touched ? (nameError ?? undefined) : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} value={values.name} autoComplete="organization" onChange={(e) => setValues({ ...values, name: e.target.value })} onBlur={() => setTouched(true)} />
            )}
          </Field>
          <Field label="Default time zone" hint="Used for new stores and schedules">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={values.timezone} onChange={(e) => setValues({ ...values, timezone: e.target.value })}>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>Save changes</Button>
            <Button
              variant="ghost"
              disabled={!dirty || saving}
              onClick={() => {
                setValues(saved);
                setTouched(false);
              }}
            >
              Reset
            </Button>
            {!dirty ? <span className="text-xs text-fg-subtle">No changes</span> : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
