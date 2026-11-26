/** Pathname Next.js reports on the server for any URL that matches no route (the 404 page). */
export const NOT_FOUND_PATH = "/_not-found";

export type Crumb = {
  label: string;
  /** Absent on the last crumb and on levels that have no page of their own. */
  href?: string;
  /** True when the label is a record id that a page may replace with a real title. */
  dynamic?: boolean;
};

/** Static route segments below /stores/[id]. */
const SEGMENT: Record<string, string> = {
  prompts: "Prompt Library",
  audits: "Audit",
  fixes: "Fixes",
  monitoring: "Monitoring",
  comparisons: "Comparison",
  reports: "Reports",
  settings: "Website settings",
  new: "New",
  edit: "Edit",
  findings: "Findings",
  tasks: "Tasks",
  alerts: "Alerts",
  observations: "Observations",
  runs: "Runs",
  schedules: "Schedules",
  usage: "Usage",
  "ai-visibility": "AI visibility",
  website: "Website readiness",
  report: "Report",
  export: "Export",
  quality: "Data quality",
  breakdowns: "Breakdowns",
  history: "History",
};

/** Label for a record id that follows one of these segments. */
const ID_LABEL: Record<string, string> = {
  prompts: "Prompt",
  audits: "Audit",
  findings: "Finding",
  tasks: "Task",
  runs: "Run",
  schedules: "Schedule",
  reports: "Report",
  comparisons: "Comparison",
};

/** Levels with no page of their own: shown as text, never as a link. */
const NO_PAGE = new Set(["fixes/findings"]);

/** Pages for signing in and joining, drawn without the app frame. */
const ACCOUNT_ROUTES: Record<string, Crumb[]> = {
  "/sign-in": [{ label: "Sign in" }],
  "/sign-up": [{ label: "Create account" }],
  "/forgot-password": [{ label: "Reset password" }],
  "/reset-password": [{ label: "New password" }],
  "/verified": [{ label: "Email confirmed" }],
  "/welcome": [{ label: "Create organization" }],
  "/invitations/accept": [{ label: "Invitation" }],
};

export const isAccountRoute = (pathname: string) => Object.hasOwn(ACCOUNT_ROUTES, pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

/** Organization-level routes, fully described. */
const ORG_CRUMBS: Record<string, Crumb[]> = {
  ...ACCOUNT_ROUTES,
  "/stores": [{ label: "Websites & Brands" }],
  "/stores/new": [{ label: "Websites & Brands", href: "/stores" }, { label: "Add website" }],
  "/settings/billing": [{ label: "Billing" }],
  "/integrations": [{ label: "Integrations" }],
  "/help": [{ label: "Help & Support" }],
  [NOT_FOUND_PATH]: [{ label: "Page not found" }],
};

/**
 * Breadcrumb trail for the header. The website itself is shown by the website selector, so website
 * routes start at the section ("Fixes / Tasks / Task"). `titleOverride` replaces a trailing record id
 * with the page's real title (see BreadcrumbLabel in page-chrome).
 */
export function buildCrumbs(pathname: string, titleOverride?: string | null): Crumb[] {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (Object.hasOwn(ORG_CRUMBS, clean)) return ORG_CRUMBS[clean];

  const match = clean.match(/^\/stores\/([^/]+)(?:\/(.*))?$/);
  if (match) {
    const base = `/stores/${match[1]}`;
    const segments = match[2] ? match[2].split("/") : [];
    if (segments.length === 0) return [{ label: "Dashboard" }];
    const crumbs: Crumb[] = [];
    segments.forEach((segment, index) => {
      const parent = index > 0 ? segments[index - 1] : "";
      const isId = index > 0 && Object.hasOwn(ID_LABEL, parent) && segment !== "new";
      const rel = segments.slice(0, index + 1).join("/");
      const href = !NO_PAGE.has(rel) && index < segments.length - 1 ? `${base}/${rel}` : undefined;
      if (isId) crumbs.push({ label: ID_LABEL[parent] ?? segment, href, dynamic: true });
      else crumbs.push({ label: (Object.hasOwn(SEGMENT, segment) ? SEGMENT[segment] : undefined) ?? segment, href });
    });
    const last = crumbs[crumbs.length - 1];
    if (last?.dynamic && titleOverride) last.label = titleOverride;
    return crumbs;
  }

  const first = clean.split("/").filter(Boolean)[0];
  return [{ label: first ? first.charAt(0).toUpperCase() + first.slice(1) : "Websites & Brands" }];
}

/** Every page that exists below /stores/[id] (the part after the website id). Keep in step with src/app/stores/[storeId]. */
const STORE_ROUTES: readonly RegExp[] = [
  /^$/,
  /^settings$/,
  /^prompts(\/new)?$/,
  /^audits(\/new)?$/,
  /^fixes(\/(history|tasks))?$/,
  /^monitoring(\/(alerts|observations|usage|runs))?$/,
  /^monitoring\/schedules(\/new)?$/,
  /^comparisons(\/new)?$/,
  /^reports$/,
];

/**
 * The pathname the shell should draw from. On the server a 404 page reports `/_not-found`, while the browser
 * reports the URL that was typed, so drawing from the raw value gives different server and client HTML (a
 * hydration mismatch). Any URL that is not a known route maps to `/_not-found` on both sides.
 */
export function normalizeRoute(pathname: string): string {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (Object.hasOwn(ORG_CRUMBS, clean)) return pathname;
  const match = clean.match(/^\/stores\/([^/]+)(?:\/(.*))?$/);
  if (!match) return NOT_FOUND_PATH;
  return STORE_ROUTES.some((route) => route.test(match[2] ?? "")) ? pathname : NOT_FOUND_PATH;
}
