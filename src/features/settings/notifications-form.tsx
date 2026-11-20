"use client";

import { useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Segmented, Select, Switch } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { simulatedToast, useDemoCollection, useDemoSettings } from "@/demo-state";
import type { Store } from "@/types/core";
import type { DigestFrequency, NotificationEvent, NotificationMatrix, NotificationPrefs, StoreNotificationOverride } from "@/types/settings";

import { NotificationMatrixTable } from "./notification-matrix";
import { PRESET_LABEL, activeEventCount, detectPreset, presetMatrix, type PresetId } from "./notification-presets";
import { TIMEZONES, validateHttpsUrl, withCurrent } from "./options";
import { sameJson, useSyncedDraft } from "./use-draft";

type Overrides = Record<string, StoreNotificationOverride>;

type Props = {
  events: NotificationEvent[];
  initial: NotificationPrefs;
  orgTimezone: string;
  websites: Store[];
  overrides: StoreNotificationOverride[];
};

export function NotificationsForm({ events, initial, orgTimezone, websites: baseWebsites, overrides: baseOverrides }: Props) {
  const toast = useToast();
  const { value: saved, save } = useDemoSettings<NotificationPrefs>("org.notifications", initial);
  const [prefs, setPrefs] = useSyncedDraft<NotificationPrefs>(saved);
  const [webhookTouched, setWebhookTouched] = useState(false);
  const websites = useDemoCollection<Store>("websites", baseWebsites).rows.filter((w) => w.status !== "archived");
  const baseMap: Overrides = Object.fromEntries(baseOverrides.map((o) => [o.storeId, o]));
  const overrides = useDemoSettings<Overrides>("org.notifications.overrides", baseMap);
  const [editing, setEditing] = useState<string | null>(null);

  const dirty = !sameJson(saved, prefs);
  const webhookError = validateHttpsUrl(prefs.webhookUrl);
  const webhookReady = prefs.webhookUrl.trim() !== "" && !webhookError;
  const timezones = withCurrent(TIMEZONES, prefs.quietHours.timezone);
  const preset = detectPreset(prefs.matrix, events);

  const setWebhook = (webhookUrl: string) => {
    const clear = webhookUrl.trim() === "";
    setPrefs((current) => ({
      ...current,
      webhookUrl,
      matrix: clear ? (Object.fromEntries(Object.entries(current.matrix).map(([id, list]) => [id, list.filter((c) => c !== "webhook")])) as NotificationMatrix) : current.matrix,
    }));
  };

  const applyPreset = (id: PresetId) => {
    setPrefs((current) => ({ ...current, matrix: presetMatrix(id, events), digest: id === "digest" && current.digest === "off" ? "weekly" : current.digest }));
  };

  const onSave = () => {
    setWebhookTouched(true);
    if (webhookError) return;
    save(prefs, { kind: "settings.saved", label: "Notification settings saved" });
    toast.push(simulatedToast("Notification settings saved"));
  };

  const nothing = prefs.digest === "off" && activeEventCount(prefs.matrix) === 0;
  const editingSite = websites.find((w) => w.id === editing) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <HeaderAction>
        <Button variant="primary" disabled={!dirty} onClick={onSave}>Save changes</Button>
      </HeaderAction>

      <Card>
        <CardHeader title="Events and channels" actions={dirty ? <Button variant="ghost" size="sm" onClick={() => setPrefs(saved)}>Discard changes</Button> : null} />
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented<PresetId>
              label="Preset"
              value={(preset === "custom" ? "" : preset) as PresetId}
              onChange={applyPreset}
              options={(Object.keys(PRESET_LABEL) as PresetId[]).map((id) => ({ value: id, label: PRESET_LABEL[id] }))}
            />
            {preset === "custom" ? <Badge tone="neutral">Custom</Badge> : null}
            <span className="tnum text-helper text-fg-subtle">{activeEventCount(prefs.matrix)} of {events.length} events on</span>
          </div>
          <details className="group rounded-control border border-line">
            <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-control px-3.5 py-2.5 text-body font-medium text-fg focus-visible:outline-2 focus-visible:outline-ring">
              Customise by event
              <Icon name="chevron-down" size={16} className="text-fg-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <div className="border-t border-line">
              <NotificationMatrixTable events={events} value={prefs.matrix} onChange={(matrix) => setPrefs({ ...prefs, matrix })} webhookReady={webhookReady} />
            </div>
          </details>
        </CardBody>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Delivery" />
          <CardBody className="flex flex-col gap-4">
            <Field label="Webhook address" error={webhookTouched ? (webhookError ?? undefined) : undefined} hint="Optional. Turns on the Webhook channel.">
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="url" inputMode="url" autoComplete="off" aria-describedby={describedBy} invalid={invalid} value={prefs.webhookUrl} placeholder="https://" onChange={(e) => setWebhook(e.target.value)} onBlur={() => setWebhookTouched(true)} />
              )}
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-fg">Digest email</span>
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
            <Checkbox label="Still deliver critical alerts" disabled={!prefs.quietHours.enabled} checked={prefs.quietHours.allowCritical} onChange={(e) => setPrefs({ ...prefs, quietHours: { ...prefs.quietHours, allowCritical: e.target.checked } })} />
          </CardBody>
        </Card>
      </div>

      {nothing ? <Callout tone="warning" title="Nothing will be delivered" /> : null}

      <Card>
        <CardHeader title="Websites" />
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {websites.map((w) => {
            const o = overrides.value[w.id];
            const custom = o?.mode === "override";
            return (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-card py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{w.name}</p>
                  <p className="text-helper text-fg-subtle">{custom ? `${activeEventCount(o.matrix)} of ${events.length} events on` : "Follows organization"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={custom ? "accent" : "neutral"}>{custom ? "Custom" : "Default"}</Badge>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(w.id)}>Customise</Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <OverrideDrawer
        key={editingSite?.id ?? "none"}
        site={editingSite}
        events={events}
        current={editingSite ? overrides.value[editingSite.id] : undefined}
        orgMatrix={saved.matrix}
        webhookReady={webhookReady}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          overrides.patch({ [next.storeId]: next }, { kind: "settings.saved", label: `Notification overrides saved for ${editingSite?.name ?? next.storeId}` });
          toast.push(simulatedToast("Website notifications saved"));
          setEditing(null);
        }}
      />
    </div>
  );
}

function OverrideDrawer({
  site,
  events,
  current,
  orgMatrix,
  webhookReady,
  onClose,
  onSave,
}: {
  site: Store | null;
  events: NotificationEvent[];
  current: StoreNotificationOverride | undefined;
  orgMatrix: NotificationMatrix;
  webhookReady: boolean;
  onClose: () => void;
  onSave: (next: StoreNotificationOverride) => void;
}) {
  const [custom, setCustom] = useState(current?.mode === "override");
  const [matrix, setMatrix] = useState<NotificationMatrix>(current?.matrix ?? orgMatrix);
  const dirty = site ? custom !== (current?.mode === "override") || (custom && !sameJson(matrix, current?.matrix ?? orgMatrix)) : false;
  return (
    <Drawer
      open={site !== null}
      onClose={onClose}
      title={site ? `Notifications: ${site.name}` : "Notifications"}
      size="lg"
      dirty={dirty}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!site || !dirty} onClick={() => site && onSave({ storeId: site.id, mode: custom ? "override" : "inherit", matrix: custom ? matrix : orgMatrix })}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-body font-medium text-fg">Customise this website</span>
          <Switch label="Customise this website" checked={custom} onChange={setCustom} />
        </div>
        <div className="-mx-5 border-y border-line">
          <NotificationMatrixTable events={events} value={custom ? matrix : orgMatrix} onChange={setMatrix} disabled={!custom} webhookReady={webhookReady} />
        </div>
        {!custom ? <p className="text-helper text-fg-subtle">Following the organization settings.</p> : null}
      </div>
    </Drawer>
  );
}
