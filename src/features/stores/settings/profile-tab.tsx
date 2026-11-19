"use client";

import { useState } from "react";

import { Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { PLATFORM_LABEL } from "@/lib/labels";
import type { AiChannel, StorePlatform, StoreStatus } from "@/types/core";

import { TIMEZONES, PLATFORM_ORDER } from "../options";
import { ALLOWED_TRANSITIONS, transitionCopy } from "../status-transitions";
import { validateRequired } from "../validation";
import { ChannelPicker } from "../wizard/channel-picker";
import type { TrackingMode } from "../wizard/model";

export type ProfileValues = { name: string; platform: StorePlatform; timezone: string };

type Props = {
  storeName: string;
  domain: string;
  status: StoreStatus;
  readOnly: boolean;
  profile: ProfileValues;
  savedProfile: ProfileValues;
  onProfile: (next: ProfileValues) => void;
  onSaveProfile: () => void;
  platformLocked: boolean;
  blockedTransitions: Partial<Record<StoreStatus, string>>;
  onStatus: (to: StoreStatus) => void;
  channels: AiChannel[];
  channelIds: string[];
  savedChannelIds: string[];
  trackingMode: TrackingMode;
  onChannels: (ids: string[]) => void;
  onTracking: (mode: TrackingMode) => void;
  onSaveChannels: () => void;
  goTab: (id: "domains") => void;
};

export function ProfileTab({
  storeName,
  domain,
  status,
  readOnly,
  profile,
  savedProfile,
  onProfile,
  onSaveProfile,
  platformLocked,
  blockedTransitions,
  onStatus,
  channels,
  channelIds,
  savedChannelIds,
  trackingMode,
  onChannels,
  onTracking,
  onSaveChannels,
  goTab,
}: Props) {
  const [touched, setTouched] = useState(false);
  const nameError = validateRequired(profile.name, "Store name", 2, 80);
  const dirty = profile.name !== savedProfile.name || profile.platform !== savedProfile.platform || profile.timezone !== savedProfile.timezone;
  const channelsDirty = [...channelIds].sort().join() !== [...savedChannelIds].sort().join();
  const channelError = channelIds.length === 0 ? "Choose at least one AI channel." : undefined;
  const transitions = ALLOWED_TRANSITIONS[status];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setTouched(true);
                if (!nameError) onSaveProfile();
              }}
            >
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
                <Field label="Store name" required error={touched ? (nameError ?? undefined) : undefined}>
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} aria-describedby={describedBy} invalid={invalid} value={profile.name} disabled={readOnly} onChange={(e) => onProfile({ ...profile, name: e.target.value })} onBlur={() => setTouched(true)} />
                  )}
                </Field>
                <Field label="Website" hint="Managed in Domains">
                  {({ id, describedBy }) => (
                    <div className="flex gap-2">
                      <Input id={id} aria-describedby={describedBy} value={domain} readOnly />
                      <Button variant="secondary" onClick={() => goTab("domains")}>Domains</Button>
                    </div>
                  )}
                </Field>
                <Field label="Platform" hint={platformLocked ? "Disconnect the integration to change the platform" : undefined}>
                  {({ id, describedBy }) => (
                    <Select id={id} aria-describedby={describedBy} value={profile.platform} disabled={readOnly || platformLocked} onChange={(e) => onProfile({ ...profile, platform: e.target.value as StorePlatform })}>
                      {PLATFORM_ORDER.map((value) => (
                        <option key={value} value={value}>{PLATFORM_LABEL[value]}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Time zone" hint="Used for schedules and reports">
                  {({ id, describedBy }) => (
                    <Select id={id} aria-describedby={describedBy} value={profile.timezone} disabled={readOnly} onChange={(e) => onProfile({ ...profile, timezone: e.target.value })}>
                      {(TIMEZONES.includes(profile.timezone) ? TIMEZONES : [profile.timezone, ...TIMEZONES]).map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" variant="primary" disabled={readOnly || !dirty}>Save profile</Button>
                <Button variant="ghost" disabled={readOnly || !dirty} onClick={() => { onProfile(savedProfile); setTouched(false); }}>Reset</Button>
                {!dirty ? <span className="text-xs text-fg-subtle">No changes</span> : null}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="AI channels and tracking" subtitle={`${storeName} · API answer samples`} />
          <CardBody className="flex flex-col gap-4">
            <ChannelPicker channels={channels} selected={channelIds} onChange={onChannels} trackingMode={trackingMode} onTrackingModeChange={onTracking} error={channelsDirty ? channelError : undefined} disabled={readOnly} />
            <div className="flex items-center gap-2">
              <Button variant="primary" disabled={readOnly || !channelsDirty || channelIds.length === 0} onClick={onSaveChannels}>Save channels</Button>
              {channelIds.length === 0 ? <span className="text-xs text-fg-subtle">Choose at least one channel</span> : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader title="Status" info="Draft: setup incomplete. Ready: setup complete, not tracking. Active: scheduled tracking on. Paused and archived stop scheduled runs." />
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Status kind="store" value={status} />
          </div>
          {transitions.length === 0 ? (
            <p className="text-[13px] text-fg-muted">No changes available.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {transitions.map((to) => {
                const copy = transitionCopy(status, to, storeName);
                const blocked = blockedTransitions[to];
                return (
                  <li key={to} className="flex flex-col gap-1">
                    <Button
                      variant={copy.tone === "danger" ? "danger-ghost" : "secondary"}
                      icon={copy.icon}
                      className="justify-start"
                      disabled={Boolean(blocked)}
                      onClick={() => onStatus(to)}
                    >
                      {copy.label}
                    </Button>
                    {blocked ? (
                      <p className="flex items-center gap-1 text-xs text-fg-subtle"><Icon name="info" size={12} />{blocked}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
