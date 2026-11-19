"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Segmented, Select, Switch } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TIMEZONES } from "@/features/stores/options";
import type { DigestFrequency, NotificationEvent, NotificationPrefs } from "@/types/settings";

import { NotificationMatrixTable } from "./notification-matrix";

function validateWebhook(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? null : "Webhook addresses must use https.";
  } catch {
    return "Enter a full address, e.g. https://hooks.example.com/rankvora.";
  }
}

export function NotificationsForm({ events, initial, orgTimezone }: { events: NotificationEvent[]; initial: NotificationPrefs; orgTimezone: string }) {
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [prefs, setPrefs] = useState(initial);
  const [webhookTouched, setWebhookTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(saved) !== JSON.stringify(prefs);
  const webhookError = validateWebhook(prefs.webhookUrl);
  const webhookReady = prefs.webhookUrl.trim() !== "" && !webhookError;
  const timezones = TIMEZONES.includes(prefs.quietHours.timezone) ? TIMEZONES : [prefs.quietHours.timezone, ...TIMEZONES];

  const setWebhook = (webhookUrl: string) => {
    // Removing the address also clears the webhook channel so nothing is silently dropped.
    const clear = webhookUrl.trim() === "";
    setPrefs((current) => ({
      ...current,
      webhookUrl,
      matrix: clear ? (Object.fromEntries(Object.entries(current.matrix).map(([id, list]) => [id, list.filter((c) => c !== "webhook")])) as NotificationPrefs["matrix"]) : current.matrix,
    }));
  };

  const save = () => {
    setWebhookTouched(true);
    if (webhookError) return;
    setSaving(true);
    window.setTimeout(() => {
      setSaved(prefs);
      setSaving(false);
      toast.push({ title: "Notification settings saved", description: "Demo: nothing was changed on a server." });
    }, 500);
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Events and channels" subtitle="Defaults for every store" />
        <div className="mt-3">
          <NotificationMatrixTable events={events} value={prefs.matrix} onChange={(matrix) => setPrefs({ ...prefs, matrix })} webhookReady={webhookReady} />
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Delivery" />
          <CardBody className="flex flex-col gap-4">
            <Field label="Webhook address" error={webhookTouched ? (webhookError ?? undefined) : undefined} hint="Optional. Enables the Webhook channel.">
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="url" inputMode="url" autoComplete="off" aria-describedby={describedBy} invalid={invalid} value={prefs.webhookUrl} placeholder="https://" onChange={(e) => setWebhook(e.target.value)} onBlur={() => setWebhookTouched(true)} />
              )}
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-fg">Digest</span>
              <Segmented<DigestFrequency>
                label="Digest frequency"
                value={prefs.digest}
                onChange={(digest) => setPrefs({ ...prefs, digest })}
                options={[
                  { value: "off", label: "Off" },
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                ]}
              />
              <span className="text-xs text-fg-subtle">One email summarising non-critical events.</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Quiet hours" actions={<Switch label="Quiet hours" checked={prefs.quietHours.enabled} onChange={(enabled) => setPrefs({ ...prefs, quietHours: { ...prefs.quietHours, enabled } })} />} />
          <CardBody className="flex flex-col gap-4">
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
              <Field label="From">
                {({ id }) => <Input id={id} type="time" disabled={!prefs.quietHours.enabled} value={prefs.quietHours.from} onChange={(e) => setPrefs({ ...prefs, quietHours: { ...prefs.quietHours, from: e.target.value } })} />}
              </Field>
              <Field label="To">
                {({ id }) => <Input id={id} type="time" disabled={!prefs.quietHours.enabled} value={prefs.quietHours.to} onChange={(e) => setPrefs({ ...prefs, quietHours: { ...prefs.quietHours, to: e.target.value } })} />}
              </Field>
            </div>
            <Field label="Time zone" hint={prefs.quietHours.timezone === orgTimezone ? "Organization default" : undefined}>
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} disabled={!prefs.quietHours.enabled} value={prefs.quietHours.timezone} onChange={(e) => setPrefs({ ...prefs, quietHours: { ...prefs.quietHours, timezone: e.target.value } })}>
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Checkbox
              label="Still deliver critical alerts"
              disabled={!prefs.quietHours.enabled}
              checked={prefs.quietHours.allowCritical}
              onChange={(e) => setPrefs({ ...prefs, quietHours: { ...prefs.quietHours, allowCritical: e.target.checked } })}
            />
          </CardBody>
        </Card>
      </div>

      {prefs.digest === "off" && Object.values(prefs.matrix).every((channels) => channels.length === 0) ? (
        <Callout tone="warning" title="Nothing will be delivered" />
      ) : null}

      <div className="flex items-center gap-2">
        <Button variant="primary" loading={saving} disabled={!dirty} onClick={save}>Save changes</Button>
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => setPrefs(saved)}>Reset</Button>
        {!dirty ? <span className="text-xs text-fg-subtle">No changes</span> : null}
      </div>
    </div>
  );
}
