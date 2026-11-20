"use client";

import Link from "next/link";

import { Icon } from "@/components/ui/icon";

import { useBreadcrumbLabel } from "./page-chrome";
import { buildCrumbs } from "./route-titles";

/** One-line breadcrumb for the header. Long titles truncate; the last crumb is the current page. */
export function Breadcrumbs({ pathname }: { pathname: string }) {
  const override = useBreadcrumbLabel(pathname);
  const crumbs = buildCrumbs(pathname, override);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 overflow-hidden @min-[11rem]:block">
      {/* Container query: when the header leaves too little room the trail is hidden instead of drawn as clipped fragments (the page title below names the page). */}
      <ol className="flex min-w-0 items-center gap-1 text-body-sm text-fg-muted">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${index}-${crumb.label}`} className={last ? "flex min-w-[5rem] flex-1 items-center gap-1" : "flex min-w-0 max-w-[40%] shrink items-center gap-1"}>
              {crumb.href && !last ? (
                <Link href={crumb.href} title={crumb.label} className="min-w-0 truncate rounded px-0.5 hover:text-fg hover:underline">{crumb.label}</Link>
              ) : (
                <span aria-current={last ? "page" : undefined} title={crumb.label} className={last ? "truncate font-medium text-fg" : undefined}>{crumb.label}</span>
              )}
              {!last ? <Icon name="chevron-right" size={14} className="shrink-0 text-fg-faint" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
