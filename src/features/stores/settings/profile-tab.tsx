"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { PLATFORM_LABEL } from "@/lib/labels";
import type { AiChannel, StorePlatform } from "@/types/core";

import { TIMEZONES, PLATFORM_ORDER } from "../options";
import { validateRequired } from "../validation";
import { ChannelPicker } from "../wizard/channel-picker";
import type { TrackingMode } from "../wizard/model";

export type ProfileValues = { name: string; platform: StorePlatform; timezone: string };

type Props = {
  domain: string;
  readOnly: boolean;
  profile: ProfileValues;
  savedProfile: ProfileValues;
  onProfile: (next: ProfileValues) => void;
  onSaveProfile: () => void;
  platformLocked: boolean;
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
  domain,
  readOnly,
  profile,
  savedProfile,
  onProfile,
  onSaveProfile,
  platformLocked,
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

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
      <Card>
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
        <CardBody className="flex flex-col gap-4">
          <ChannelPicker channels={channels} selected={channelIds} onChange={onChannels} trackingMode={trackingMode} onTrackingModeChange={onTracking} error={channelsDirty ? channelError : undefined} disabled={readOnly} />
          <div className="flex items-center gap-2">
            <Button variant="primary" disabled={readOnly || !channelsDirty || channelIds.length === 0} onClick={onSaveChannels}>Save channels</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
