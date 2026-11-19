import type { ReactNode } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { getOrganization } from "@/services/core";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const org = await getOrganization();
  return (
    <>
      <PageHeader
        title="Organization settings"
        subtitle={org.name}
        tabs={
          <LinkTabs
            label="Organization settings"
            items={[
              { href: "/settings", label: "General", exact: true },
              { href: "/settings/members", label: "Members and roles" },
              { href: "/settings/ai-platforms", label: "AI platforms" },
              { href: "/settings/notifications", label: "Notifications" },
              { href: "/settings/billing", label: "Usage and billing" },
            ]}
          />
        }
      />
      {children}
    </>
  );
}
