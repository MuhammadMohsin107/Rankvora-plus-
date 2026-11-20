import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { BreadcrumbLabel } from "./page-chrome";

type PageHeaderProps = {
  title: string;
  /** One short line, never a paragraph. */
  subtitle?: string;
  /** Deprecated and ignored: the global header derives breadcrumbs from the URL. Kept so existing pages compile. */
  breadcrumb?: { label: string; href?: string }[];
  /** Status badges / meta next to the title. */
  meta?: ReactNode;
  /**
   * Actions shown beside the title. The page's ONE primary action belongs in the global header instead:
   * render `<HeaderAction>` from "@/components/shell/page-chrome". Secondary actions may stay here.
   */
  actions?: ReactNode;
  /** Route tabs rendered under the header. */
  tabs?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, meta, actions, tabs, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4", className)}>
      {/* Gives a trailing record id in the breadcrumb a real name (no effect on static routes). */}
      <BreadcrumbLabel>{title}</BreadcrumbLabel>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="rv-page-title [text-wrap:balance]">{title}</h1>
            {meta}
          </div>
          {subtitle ? <p className="mt-1 text-body-sm text-fg-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs}
    </header>
  );
}

/** Two-column layout used by detail pages: main content + a narrower side panel. */
export function SplitLayout({ main, aside, className }: { main: ReactNode; aside: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]", className)}>
      <div className="flex min-w-0 flex-col gap-6">{main}</div>
      <div className="flex min-w-0 flex-col gap-6">{aside}</div>
    </div>
  );
}
