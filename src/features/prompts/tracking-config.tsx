import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { INTENT_LABEL, SCOPE_LABEL, SOURCE_LABEL } from "@/lib/labels";
import type { ProductService, PromptGroup } from "@/types/core";
import type { ChannelOption, PromptScheduleInfo, StoredPrompt } from "@/types/prompts";

import { PromptKind } from "./parts";

type Props = {
  prompt: StoredPrompt;
  brand: string;
  groups: PromptGroup[];
  products: ProductService[];
  channels: ChannelOption[];
  schedules: PromptScheduleInfo[];
  storeId: string;
  onEdit: () => void;
};

/** How the prompt is tracked: brand, intent, market, frequency, providers. Editing opens a dialog. */
export function TrackingConfig({ prompt, brand, groups, products, channels, schedules, storeId, onEdit }: Props) {
  const group = groups.find((g) => g.id === prompt.groupId);
  const linked = products.filter((p) => prompt.productIds.includes(p.id));
  const active = prompt.status === "active";
  return (
    <Card as="section">
      <CardHeader
        title="Tracking"
        actions={
          <Button size="sm" icon="pencil" onClick={onEdit}>
            Edit
          </Button>
        }
      />
      <CardBody>
        <KeyValue
          columns={1}
          items={[
            { label: "Brand", value: <span className="flex flex-wrap items-center gap-2">{brand || "Not set"}<PromptKind mentionsBrand={prompt.mentionsBrand} /></span> },
            { label: "Intent · topic", value: `${INTENT_LABEL[prompt.intent]}${prompt.topic ? ` · ${prompt.topic}` : ""}` },
            { label: "Market · language", value: <span className="tnum">{prompt.market || "N/A"} · {prompt.language.toUpperCase()}</span> },
            {
              label: "Frequency",
              value:
                schedules.length === 0 ? (
                  <span className="text-fg-muted">{prompt.scope === "audit" ? "Audits only" : "Not on a schedule"}</span>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {schedules.map((s) => (
                      <li key={s.id} className="text-body-sm">
                        <Link href={`/stores/${storeId}/monitoring/schedules/${s.id}`} className="text-accent-text hover:underline">{s.frequency}</Link>
                        {s.status !== "active" ? <span className="text-fg-muted"> · {s.status.replace(/_/g, " ")}</span> : null}
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              label: active ? "Providers" : "Will run on",
              value:
                channels.length === 0 ? (
                  <span className="text-body-sm text-fg-muted">
                    None selected.{" "}
                    <Link href={`/stores/${storeId}/settings`} className="font-medium text-accent-text hover:underline">
                      Choose providers
                    </Link>
                  </span>
                ) : (
                  <span className="flex flex-wrap gap-1" title={channels.map((c) => c.label).join("\n")}>
                    {channels.map((c) => (
                      <Badge key={c.id} tone="neutral" title={c.label}>{c.providerLabel}</Badge>
                    ))}
                  </span>
                ),
            },
            { label: "Runs in", value: SCOPE_LABEL[prompt.scope] },
            { label: "Group", value: group?.name ?? <span className="text-fg-muted">Ungrouped</span> },
            { label: "Core set", value: prompt.isCore ? "Yes" : <span className="text-fg-muted">No</span> },
            ...(linked.length > 0 ? [{ label: "Offerings", value: <ul className="flex flex-col gap-0.5">{linked.map((p) => <li key={p.id}>{p.title}</li>)}</ul> }] : []),
            { label: "Created", value: <span className="tnum">{formatDate(prompt.createdAt)} · {prompt.createdBy} · {SOURCE_LABEL[prompt.source]}</span> },
          ]}
        />
      </CardBody>
    </Card>
  );
}
