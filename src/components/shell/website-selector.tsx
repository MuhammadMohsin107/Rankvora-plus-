"use client";

import Link from "next/link";
import { useState } from "react";

import { WebsiteAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SearchField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { STATUS } from "@/lib/status";
import type { Store } from "@/types/core";

import { switchWebsiteHref } from "./nav";

type Props = {
  websites: Store[];
  active: Store | null;
  pathname: string;
};

const SEARCH_THRESHOLD = 5;

function WebsiteList({ websites, active, pathname, close }: Props & { close: () => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = q ? websites.filter((w) => `${w.name} ${w.domain} ${w.brandName}`.toLowerCase().includes(q)) : websites;
  return (
    <div className="-m-1 flex flex-col gap-2">
      {websites.length > SEARCH_THRESHOLD ? <SearchField value={query} onChange={setQuery} label="Find a website" placeholder="Find a website" /> : null}
      <p className="px-1 text-helper font-semibold text-fg-muted">Websites</p>
      {visible.length === 0 ? (
        <p className="px-2 py-3 text-center text-body-sm text-fg-muted">No website matches “{query.trim()}”.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {visible.map((website) => {
            const isActive = website.id === active?.id;
            const status = STATUS.store[website.status];
            return (
              <li key={website.id}>
                <Link
                  href={switchWebsiteHref(pathname, website.id)}
                  aria-current={isActive ? "true" : undefined}
                  onClick={close}
                  className={cn(
                    "flex min-h-12 items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 pointer-coarse:min-h-14",
                    isActive && "bg-accent-soft hover:bg-accent-soft",
                  )}
                >
                  <WebsiteAvatar name={website.name} size="md" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-sm font-medium text-fg">{website.name}</span>
                    <span className="truncate text-helper text-fg-muted">{website.domain} · {website.market}</span>
                  </span>
                  {website.status !== "active" ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                  {isActive ? <Icon name="check" size={16} className="shrink-0 text-accent-text" label="Current website" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div className="-mx-4 -mb-4 mt-1 flex flex-col gap-0.5 border-t border-line p-2">
        <Link href="/stores" onClick={close} className="flex min-h-9 items-center gap-2 rounded-control px-2 text-body-sm text-fg hover:bg-surface-2 pointer-coarse:min-h-11">
          <Icon name="globe" size={16} className="text-fg-subtle" /> All websites
        </Link>
        <Link href="/stores/new" onClick={close} className="flex min-h-9 items-center gap-2 rounded-control px-2 text-body-sm font-medium text-accent-text hover:bg-accent-soft pointer-coarse:min-h-11">
          <Icon name="plus" size={16} /> Add website
        </Link>
      </div>
    </div>
  );
}

/** Header website selector: the website name as a breadcrumb step. The list shows domain and market. Switching keeps the current section. */
export function WebsiteSelector({ websites, active, pathname }: Props) {
  return (
    <Popover
      label="Select website"
      align="start"
      width={360}
      trigger={
        <button
          type="button"
          className="flex h-9 min-w-0 max-w-[14rem] cursor-pointer items-center gap-1.5 rounded-control px-2 text-left text-body-sm font-semibold text-fg transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 aria-expanded:bg-surface-2 sm:max-w-[18rem]"
        >
          <span className="truncate">{active ? active.name : "Select website"}</span>
          <Icon name="chevrons-up-down" size={14} className="shrink-0 text-fg-subtle" />
          <span className="sr-only">Change website</span>
        </button>
      }
    >
      {({ close }) => <WebsiteList websites={websites} active={active} pathname={pathname} close={close} />}
    </Popover>
  );
}
