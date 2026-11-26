"use client";

import { useSyncExternalStore } from "react";

import { initialsOf, UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Menu, type MenuItem } from "@/components/ui/menu";
import type { Organization, Role, SessionUser } from "@/features/session/session";

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", manager: "Manager", member: "Member", viewer: "Viewer" };

type Theme = "light" | "dark";

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

/** Light is the default; only a theme chosen here is stored. */
function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("rv-theme", next);
    } catch {
      /* storage unavailable: the theme still applies for this session */
    }
  };
  return [theme, toggle];
}

type Props = {
  user: SessionUser;
  organization: Organization;
  organizations: Organization[];
  onSelectOrganization: (id: string) => void;
  onSignOut: () => void;
};

/** Account menu: who is signed in, which organization, theme and sign out. Navigation lives in the sidebar. */
export function UserMenu({ user, organization, organizations, onSelectOrganization, onSignOut }: Props) {
  const [theme, toggleTheme] = useTheme();
  const switcher: MenuItem[] =
    organizations.length > 1
      ? [
          ...organizations.map((item): MenuItem => ({ label: item.name, icon: item.id === organization.id ? "check" : "building", onSelect: () => onSelectOrganization(item.id) })),
          { type: "separator" },
        ]
      : [];
  const items: MenuItem[] = [
    ...switcher,
    { label: theme === "dark" ? "Light theme" : "Dark theme", icon: theme === "dark" ? "sun" : "moon", onSelect: toggleTheme },
    { type: "separator" },
    { label: "Sign out", icon: "logout", onSelect: onSignOut },
  ];

  return (
    <Menu
      align="end"
      width={256}
      label="Account"
      header={
        <div className="min-w-0">
          <p className="truncate text-body-sm font-semibold text-fg">{user.name}</p>
          <p className="truncate text-helper text-fg-muted">{user.email}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="truncate text-helper text-fg-muted">{organization.name}</span>
            <Badge tone="accent">{ROLE_LABEL[organization.role]}</Badge>
          </p>
        </div>
      }
      items={items}
      trigger={
        <button
          type="button"
          aria-label={`Account menu, ${user.name}, ${initialsOf(user.name)}`}
          className="flex size-btn shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity duration-[var(--dur-fast)] hover:opacity-85 pointer-coarse:size-11"
        >
          <UserAvatar name={user.name} size="md" />
        </button>
      }
    />
  );
}
