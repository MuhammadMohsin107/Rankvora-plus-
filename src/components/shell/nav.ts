import type { IconName } from "@/components/ui/icon";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  isActive: (pathname: string) => boolean;
};

export type NavGroup = {
  id: "organization" | "website" | "support";
  label: string;
  items: NavItem[];
};

const exact = (href: string) => (pathname: string) => pathname === href;
const prefix = (href: string) => (pathname: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Sidebar structure. ORGANIZATION holds everything shared by all websites (websites, integrations, billing). WEBSITE holds the selected website's workspace, including its own settings. SUPPORT is help.
 * `websiteId` is the website in context (from the URL, else the last one used). Without one the website group is left out.
 */
export function navGroups(websiteId: string | null): NavGroup[] {
  const base = websiteId ? `/stores/${websiteId}` : null;
  const groups: NavGroup[] = [
    {
      id: "organization",
      label: "Organization",
      items: [
        { id: "websites", label: "Websites & Brands", href: "/stores", icon: "globe", isActive: (p) => p === "/stores" || p === "/stores/new" },
        { id: "integrations", label: "Integrations", href: "/integrations", icon: "plug", isActive: prefix("/integrations") },
        { id: "billing", label: "Billing", href: "/settings/billing", icon: "credit-card", isActive: prefix("/settings/billing") },
      ],
    },
  ];

  if (base) {
    groups.push({
      id: "website",
      label: "Website",
      items: [
        { id: "dashboard", label: "Dashboard", href: base, icon: "dashboard", isActive: exact(base) },
        { id: "prompts", label: "Prompt Library", href: `${base}/prompts`, icon: "prompts", isActive: prefix(`${base}/prompts`) },
        { id: "audit", label: "Audit", href: `${base}/audits`, icon: "audit", isActive: prefix(`${base}/audits`) },
        { id: "fixes", label: "Fixes", href: `${base}/fixes`, icon: "fixes", isActive: prefix(`${base}/fixes`) },
        { id: "monitoring", label: "Monitoring", href: `${base}/monitoring`, icon: "monitoring", isActive: prefix(`${base}/monitoring`) },
        { id: "comparison", label: "Comparison", href: `${base}/comparisons`, icon: "compare", isActive: prefix(`${base}/comparisons`) },
        { id: "reports", label: "Reports", href: `${base}/reports`, icon: "reports", isActive: prefix(`${base}/reports`) },
        { id: "website-settings", label: "Website settings", href: `${base}/settings`, icon: "settings", isActive: prefix(`${base}/settings`) },
      ],
    });
  }

  groups.push({ id: "support", label: "Support", items: [{ id: "help", label: "Help & Support", href: "/help", icon: "help", isActive: prefix("/help") }] });
  return groups;
}

/** Website id in the URL, or null in the organization area. */
export function storeIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/stores\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

/** Where to go when switching website: the same section root (never a nested id), else the dashboard. */
export function switchWebsiteHref(pathname: string, nextId: string): string {
  const match = pathname.match(/^\/stores\/(?!new(?:\/|$))[^/]+(\/[^/]+)?/);
  const section = match?.[1];
  return section ? `/stores/${nextId}${section}` : `/stores/${nextId}`;
}
