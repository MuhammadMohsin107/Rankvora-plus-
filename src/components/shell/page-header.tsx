import type { ReactNode } from "react";

import { Breadcrumb } from "@/components/ui/misc";
import { cn } from "@/lib/cn";

type PageHeaderProps = {
  title: string;
  /** One short line — never a paragraph. */
  subtitle?: string;
  breadcrumb?: { label: string; href?: string }[];
  /** Status badges / meta next to the title. */
  meta?: ReactNode;
  /** One primary action, optionally with secondary ones. */
  actions?: ReactNode;
  /** Route tabs rendered under the header. */
  tabs?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, breadcrumb, meta, actions, tabs, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-5 flex flex-col gap-3", className)}>
      {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-fg [text-wrap:balance]">{title}</h1>
            {meta}
          </div>
          {subtitle ? <p className="mt-1 text-[13px] text-fg-muted">{subtitle}</p> : null}
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
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_320px]", className)}>
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      <div className="flex min-w-0 flex-col gap-5">{aside}</div>
    </div>
  );
}
