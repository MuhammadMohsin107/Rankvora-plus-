import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { INTENT_LABEL, SCOPE_LABEL, SOURCE_LABEL } from "@/lib/labels";
import type { ProductService, PromptGroup } from "@/types/core";
import type { ChannelOption, PromptRecord } from "@/types/prompts";

type Props = {
  prompt: PromptRecord;
  groups: PromptGroup[];
  products: ProductService[];
  channels: ChannelOption[];
  onEdit: () => void;
};

/** Read-only summary of how the prompt is tracked. Editing opens a dialog. */
export function TrackingConfig({ prompt, groups, products, channels, onEdit }: Props) {
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
            { label: "Scope", value: SCOPE_LABEL[prompt.scope] },
            { label: "Market · language", value: <span className="tnum">{prompt.market} · {prompt.language.toUpperCase()}</span> },
            {
              label: active ? "Runs on" : "Will run on",
              value:
                channels.length === 0 ? (
                  <span className="text-fg-muted">No AI channels for this store.</span>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {channels.map((c) => (
                      <li key={c.id} className="text-[13px] text-fg-muted">{c.label}</li>
                    ))}
                  </ul>
                ),
            },
            { label: "Core prompt", value: prompt.isCore ? "Yes" : <span className="text-fg-muted">No</span> },
            { label: "Group", value: group?.name ?? <span className="text-fg-muted">Ungrouped</span> },
            { label: "Intent", value: INTENT_LABEL[prompt.intent] },
            { label: "Topic", value: prompt.topic || <span className="text-fg-muted">None</span> },
            {
              label: "Type",
              value: prompt.mentionsBrand ? <Badge tone="neutral" icon="store">Names brand</Badge> : <Badge tone="info" icon="search">Neutral</Badge>,
            },
            {
              label: "Linked products",
              value:
                linked.length === 0 ? (
                  <span className="text-fg-muted">None</span>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {linked.map((p) => (
                      <li key={p.id}>{p.title}</li>
                    ))}
                  </ul>
                ),
            },
            { label: "Source", value: SOURCE_LABEL[prompt.source] },
            { label: "Created", value: <span className="tnum">{formatDate(prompt.createdAt)} · {prompt.createdBy}</span> },
          ]}
        />
      </CardBody>
    </Card>
  );
}
