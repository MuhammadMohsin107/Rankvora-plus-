"use client";

import { useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { demoStore, simulatedToast, useDemoMeta, useDemoSettings } from "@/demo-state";
import type { OrgGeneral } from "@/types/settings";

import { downloadFile } from "./invoice-files";
import { COUNTRIES, LANGUAGES, TIMEZONES, validateText, withCurrent } from "./options";
import { sameJson, useSyncedDraft } from "./use-draft";

/** Organization profile and defaults. Saved under demo-state key `org.general`. */
export function GeneralForm({ initial }: { initial: OrgGeneral }) {
  const toast = useToast();
  const { value: saved, save } = useDemoSettings<OrgGeneral>("org.general", initial);
  const [values, setValues] = useSyncedDraft<OrgGeneral>(saved);
  const [touched, setTouched] = useState(false);
  const meta = useDemoMeta();

  const dirty = !sameJson(saved, values);
  const nameError = validateText(values.name, "Organization name", 2, 80);
  const timezones = withCurrent(TIMEZONES, values.timezone);

  const onSave = () => {
    setTouched(true);
    if (nameError) return;
    save({ ...values, name: values.name.trim() }, { kind: "settings.saved", label: "Organization settings saved" });
    toast.push(simulatedToast("Organization settings saved"));
  };

  const exportData = () => {
    downloadFile("rankvora-demo-data.json", "application/json", `${JSON.stringify(demoStore.getSnapshot(), null, 2)}\n`);
    toast.push(simulatedToast("Demo data file prepared", "info"));
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <HeaderAction>
        <Button variant="primary" disabled={!dirty} onClick={onSave}>Save changes</Button>
      </HeaderAction>

      <Card>
        <CardHeader title="Profile" actions={dirty ? <Button variant="ghost" size="sm" onClick={() => { setValues(saved); setTouched(false); }}>Discard changes</Button> : null} />
        <CardBody>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <Field label="Organization name" required error={touched ? (nameError ?? undefined) : undefined}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} invalid={invalid} value={values.name} autoComplete="organization" onChange={(e) => setValues({ ...values, name: e.target.value })} onBlur={() => setTouched(true)} />
              )}
            </Field>
            <Field label="Time zone" hint="Used for new websites and schedules.">
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} value={values.timezone} onChange={(e) => setValues({ ...values, timezone: e.target.value })}>
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
              <Field label="Default market">
                {({ id }) => (
                  <Select id={id} value={values.market} onChange={(e) => setValues({ ...values, market: e.target.value })}>
                    {COUNTRIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Default language">
                {({ id }) => (
                  <Select id={id} value={values.language} onChange={(e) => setValues({ ...values, language: e.target.value })}>
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Demo data" />
        <CardBody className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon="download" onClick={exportData}>Export as JSON</Button>
          <span className="tnum text-helper text-fg-subtle">{meta.hasChanges ? `${meta.changeCount} local changes` : "No local changes"}</span>
        </CardBody>
      </Card>
    </div>
  );
}
