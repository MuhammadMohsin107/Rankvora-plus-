"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { SITE_TYPE_ORDER, siteTypeLabel } from "@/lib/labels";
import type { AiChannel, StorePlatform } from "@/types/core";

import { COUNTRIES, LANGUAGES, TIMEZONES } from "../options";
import { validateRequired } from "../validation";
import { ChannelPicker } from "../wizard/channel-picker";
import type { TrackingMode } from "../wizard/model";

export type ProfileValues = { name: string; platform: StorePlatform; market: string; language: string; timezone: string };

type Props = {
  domain: string;
  readOnly: boolean;
  profile: ProfileValues;
  savedProfile: ProfileValues;
  onProfile: (next: ProfileValues) => void;
  onSaveProfile: () => void;
  channels: AiChannel[];
  channelIds: string[];
  savedChannelIds: string[];
  trackingMode: TrackingMode;
  onChannels: (ids: string[]) => void;
  onTracking: (mode: TrackingMode) => void;
  onSaveChannels: () => void;
  /** Domains and redirects, shown as a disclosure under the profile. */
  domains: ReactNode;
};

export function ProfileTab({ domain, readOnly, profile, savedProfile, onProfile, onSaveProfile, channels, channelIds, savedChannelIds, trackingMode, onChannels, onTracking, onSaveChannels, domains }: Props) {
  const [touched, setTouched] = useState(false);
  const nameError = validateRequired(profile.name, "Website name", 2, 80);
  const dirty = (Object.keys(profile) as (keyof ProfileValues)[]).some((key) => profile[key] !== savedProfile[key]);
  const channelsDirty = [...channelIds].sort().join() !== [...savedChannelIds].sort().join();
  const channelError = channelIds.length === 0 ? "Choose at least one AI channel." : undefined;
  const onMarket = (code: string) => {
    const country = COUNTRIES.find((c) => c.code === code);
    onProfile({ ...profile, market: code, ...(country ? { timezone: country.timezone } : {}) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="Website details" />
          <CardBody className="flex-1">
            <form
              noValidate
              className="flex h-full flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setTouched(true);
                if (!nameError) onSaveProfile();
              }}
            >
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-1">
                <Field label="Website name" required error={touched ? (nameError ?? undefined) : undefined}>
                  {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={profile.name} disabled={readOnly} onChange={(e) => onProfile({ ...profile, name: e.target.value })} onBlur={() => setTouched(true)} />}
                </Field>
                <Field label="Domain" hint="Change it under Domains below">
                  {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={domain} readOnly />}
                </Field>
                <Field label="Site type">
                  {({ id }) => (
                    <Select id={id} value={profile.platform} disabled={readOnly} onChange={(e) => onProfile({ ...profile, platform: e.target.value as StorePlatform })}>
                      {SITE_TYPE_ORDER.map((value) => (
                        <option key={value} value={value}>{siteTypeLabel(value)}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Market">
                  {({ id }) => (
                    <Select id={id} value={profile.market} disabled={readOnly} onChange={(e) => onMarket(e.target.value)}>
                      {(COUNTRIES.some((c) => c.code === profile.market) ? COUNTRIES : [{ code: profile.market, name: profile.market, timezone: "", language: "" }, ...COUNTRIES]).map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Language">
                  {({ id }) => (
                    <Select id={id} value={profile.language} disabled={readOnly} onChange={(e) => onProfile({ ...profile, language: e.target.value })}>
                      {(LANGUAGES.some((l) => l.code === profile.language) ? LANGUAGES : [{ code: profile.language, label: profile.language.toUpperCase() }, ...LANGUAGES]).map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
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
              <div className="mt-auto flex items-center gap-2">
                <Button type="submit" variant="primary" disabled={readOnly || !dirty}>Save details</Button>
                <Button variant="ghost" disabled={readOnly || !dirty} onClick={() => { onProfile(savedProfile); setTouched(false); }}>Reset</Button>
                {!dirty ? <span className="text-helper text-fg-muted">No changes</span> : null}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="AI channels" />
          <CardBody className="flex flex-1 flex-col gap-4">
            <ChannelPicker channels={channels} selected={channelIds} onChange={onChannels} trackingMode={trackingMode} onTrackingModeChange={onTracking} error={channelsDirty ? channelError : undefined} disabled={readOnly} hideHeading />
            <div className="mt-auto flex items-center gap-2">
              <Button variant="primary" disabled={readOnly || !channelsDirty || channelIds.length === 0} onClick={onSaveChannels}>Save channels</Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <details className="group rounded-card border border-line bg-surface shadow-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-card text-card-title font-semibold text-fg [&::-webkit-details-marker]:hidden">
          Domains and redirects
          <Icon name="chevron-down" size={16} className="text-fg-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="border-t border-line p-card">{domains}</div>
      </details>
    </div>
  );
}
