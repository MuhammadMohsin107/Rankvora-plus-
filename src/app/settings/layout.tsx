import type { ReactNode } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { LinkTabs } from "@/components/ui/tabs";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        title="Organization settings"
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
