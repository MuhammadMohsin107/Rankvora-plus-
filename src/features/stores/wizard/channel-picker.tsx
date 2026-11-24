"use client";

import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Checkbox, RadioCards } from "@/components/ui/form";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { SEARCH_MODE_LABEL } from "@/lib/labels";
import type { AiChannel } from "@/types/core";

import type { TrackingMode } from "./model";

type ChannelPickerProps = {
  channels: AiChannel[];
  selected: string[];
  onChange: (next: string[]) => void;
  trackingMode: TrackingMode;
  onTrackingModeChange: (next: TrackingMode) => void;
  error?: string;
  disabled?: boolean;
  /** Hide the "AI channels" label when the surrounding card already has that title. */
  hideHeading?: boolean;
};

/** AI channels (provider API · model · search mode) plus the tracking mode. Used by Add store and Store settings. */
export function ChannelPicker({ channels, selected, onChange, trackingMode, onTrackingModeChange, error, disabled, hideHeading }: ChannelPickerProps) {
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((item) => item !== id));

  return (
    <div className="flex flex-col gap-4">
      <div data-field="channels" tabIndex={-1} className="flex flex-col gap-2 outline-none">
        <div className={cn("flex items-center gap-2", hideHeading ? "justify-end" : "justify-between")}>
          {hideHeading ? null : <p className="text-[13px] font-medium text-fg">AI channels</p>}
          <span className="tnum text-xs text-fg-subtle">{selected.length} of {channels.length} selected</span>
        </div>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {channels.map((channel, index) => {
            const checked = selected.includes(channel.id);
            return (
              <li
                key={channel.id}
                className={cn("flex items-start justify-between gap-3 rounded-control border p-3", checked ? "border-accent bg-accent-soft" : "border-line-strong bg-surface")}
              >
                <Checkbox
                  name={index === 0 ? "channels" : undefined}
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => toggle(channel.id, event.target.checked)}
                  label={`${channel.providerLabel} · ${channel.model}`}
                  description={`${channel.apiLabel} · ${SEARCH_MODE_LABEL[channel.searchMode]}`}
                />
                {channel.supportsCitations ? <Badge tone="neutral" icon="link" className="mt-0.5">Citations</Badge> : <Badge tone="neutral" className="mt-0.5">No citations</Badge>}
              </li>
            );
          })}
          <li className="flex items-start justify-between gap-3 rounded-control border border-line bg-surface-2/50 p-3 opacity-70">
            <Checkbox disabled label="Claude" description="Messages API · web search" />
            <Badge tone="neutral" className="mt-0.5">Later</Badge>
          </li>
        </ul>
        <Tooltip className="self-start" content="Consumer apps such as Copilot are not tracked. Results are API answer samples.">
          <span tabIndex={0} className="flex cursor-help items-center gap-1.5 text-xs text-fg-subtle">
            <Icon name="info" size={13} />
            Copilot is not offered
          </span>
        </Tooltip>
        {error ? (
          <p role="alert" className="flex items-center gap-1 text-xs text-danger">
            <Icon name="alert-circle" size={13} />
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-fg">Tracking mode</p>
        <RadioCards<TrackingMode>
          label="Tracking mode"
          value={trackingMode}
          onChange={onTrackingModeChange}
          columns={3}
          options={[
            { value: "model_only", label: "Model-only", description: "Model knowledge, no web search.", disabled },
            { value: "web_grounded", label: "Web-grounded", description: "Provider web search on.", disabled },
            { value: "both", label: "Both", description: "Each prompt runs twice per channel.", disabled },
          ]}
        />
        {trackingMode === "model_only" ? (
          <Callout tone="warning" title="No citations in model-only mode">Owned citation rate will show N/A.</Callout>
        ) : null}
      </div>
    </div>
  );
}
