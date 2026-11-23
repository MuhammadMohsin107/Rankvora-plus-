"use client";

import type { ReactNode } from "react";

import { Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useDemoCollection } from "@/demo-state";
import { siteTypeLabel } from "@/lib/labels";
import type { Store } from "@/types/core";
import type { ProviderConnection } from "@/types/settings";

import { ProvidersView } from "./providers-view";

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-section font-semibold text-fg">{title}</h2>
        {hint ? <p className="text-helper text-fg-subtle">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ConnectionStatus({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-helper text-fg-subtle">{label}</span>
      {children}
    </div>
  );
}

/**
 * Organization-level Integrations. Owns the AI platform connections (shared by every website).
 * Website connections (publishing connector, Search Console) are managed per website in Website settings,
 * so this list only reads them; it never keeps a second copy of that state. Every connection is simulated.
 */
export function IntegrationsHub({ providers, websites: baseWebsites }: { providers: ProviderConnection[]; websites: Store[] }) {
  const websites = useDemoCollection<Store>("websites", baseWebsites).rows.filter((w) => w.status !== "archived");

  return (
    <div className="flex flex-col gap-8">
      <Group title="AI platforms" hint="">
        <ProvidersView providers={providers} />
      </Group>

      <Group title="Website connections" hint="Managed in each website's settings">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 2xl:grid-cols-4">
          {websites.map((w) => {
            const connector = w.integrations.commerce;
            return (
              <Card key={w.id} as="article" className="flex flex-col gap-4 p-card">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg-muted">
                    <Icon name="globe" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{w.name}</p>
                    <p className="truncate text-helper text-fg-subtle">{w.domain}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <ConnectionStatus label={connector === "manual" || connector === "not_connected" ? "Publishing" : siteTypeLabel(w.platform)}>
                    <Status kind="integration" value={connector} />
                  </ConnectionStatus>
                  <ConnectionStatus label="Search Console">
                    <Status kind="integration" value={w.integrations.searchConsole} />
                  </ConnectionStatus>
                </div>
                <ButtonLink href={`/stores/${w.id}/settings`} variant="secondary" trailingIcon="arrow-right" className="mt-auto self-start">
                  Manage
                </ButtonLink>
              </Card>
            );
          })}
        </div>
      </Group>
    </div>
  );
}
