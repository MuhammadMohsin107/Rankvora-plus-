import type { IconName } from "@/components/ui/icon";

export type NavItem = { label: string; href: string; icon: IconName; exact?: boolean; badgeKey?: "pendingTasks" | "openAlerts" };

export const ORG_NAV: NavItem[] = [
  { label: "Portfolio", href: "/", icon: "dashboard", exact: true },
  { label: "Stores", href: "/stores", icon: "store", exact: true },
  { label: "Organization settings", href: "/settings", icon: "settings" },
];

export function storeNav(storeId: string): NavItem[] {
  const base = `/stores/${storeId}`;
  return [
    { label: "Dashboard", href: base, icon: "dashboard", exact: true },
    { label: "Prompts", href: `${base}/prompts`, icon: "prompts" },
    { label: "Audit", href: `${base}/audits`, icon: "audit" },
    { label: "Fixes", href: `${base}/fixes`, icon: "fixes", badgeKey: "pendingTasks" },
    { label: "Monitoring", href: `${base}/monitoring`, icon: "monitoring", badgeKey: "openAlerts" },
    { label: "Comparison", href: `${base}/comparisons`, icon: "compare" },
    { label: "Reports", href: `${base}/reports`, icon: "reports" },
    { label: "Store settings", href: `${base}/settings`, icon: "settings" },
  ];
}

/** Active store id from the URL, or null in the organization area. */
export function storeIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/stores\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

/** Where to go when switching to another store: same section root, never a nested id. */
export function switchStoreHref(pathname: string, nextId: string): string {
  const match = pathname.match(/^\/stores\/[^/]+(\/[^/]+)?/);
  const section = match?.[1];
  return section ? `/stores/${nextId}${section}` : `/stores/${nextId}`;
}
