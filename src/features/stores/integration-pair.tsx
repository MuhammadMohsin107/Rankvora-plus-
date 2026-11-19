import { Status } from "@/components/ui/badge";
import type { Store } from "@/types/core";

/** Commerce + Search Console integration state, each with icon + text. */
export function IntegrationPair({ integrations }: { integrations: Store["integrations"] }) {
  return (
    <dl className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <dt className="w-24 shrink-0 text-xs text-fg-subtle">Commerce</dt>
        <dd><Status kind="integration" value={integrations.commerce} /></dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="w-24 shrink-0 text-xs text-fg-subtle">Search Console</dt>
        <dd><Status kind="integration" value={integrations.searchConsole} /></dd>
      </div>
    </dl>
  );
}
