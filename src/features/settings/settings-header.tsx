import type { ReactNode } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { LinkTabs } from "@/components/ui/tabs";

const ITEMS = [
  { href: "/settings/members", label: "Team" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/notifications", label: "Notifications" },
];

/** Organization hub header: title plus the shared sub-navigation. Every organization page uses it. */
export function SettingsHeader({ title, subtitle, meta }: { title: string; subtitle?: string; meta?: ReactNode }) {
  return <PageHeader title={title} subtitle={subtitle} meta={meta} tabs={<LinkTabs label="Organization" items={ITEMS} />} />;
}
