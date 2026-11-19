import { Icon } from "@/components/ui/icon";
import { DEMO_NOW, formatShortDate } from "@/lib/format";
import type { Role } from "@/types/core";
import type { CmsState, ExecutionMode, TaskStatus } from "@/types/fixes";
import type { FindingCategory } from "@/types/shared-records";

export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  technical: "Technical",
  content: "Content",
  entity: "Entity",
  schema: "Schema",
  ai_visibility: "AI visibility",
  product: "Product",
};

export const MODE_LABEL: Record<ExecutionMode, string> = {
  guidance: "Guidance only",
  ai_draft: "AI draft / patch",
  cms_staged: "CMS staged draft",
  approved_apply: "Approved apply / publish",
};

export const MODE_HINT: Record<ExecutionMode, string> = {
  guidance: "Steps for a person. Nothing is written.",
  ai_draft: "AI drafts the change. A person applies it.",
  cms_staged: "Written to the CMS as an unpublished draft.",
  approved_apply: "Written live after owner or admin approval.",
};

export const CMS_STATE_LABEL: Record<CmsState, string> = {
  guidance: "Guidance",
  draft: "Draft",
  staged: "Staged",
  applied: "Applied",
  published: "Published",
};

export const APPROVER_REASON = "Only an owner or admin can approve.";

/** Approval is not editing: only owners and admins may approve. */
export function canApprove(role: Role): boolean {
  return role === "owner" || role === "admin";
}

const DONE: ReadonlySet<TaskStatus> = new Set(["verified_success", "rolled_back", "rejected", "superseded", "failed", "partially_verified"]);

export function isTaskOpen(status: TaskStatus): boolean {
  return !DONE.has(status);
}

export function dueInfo(dueAt: string | null, status: TaskStatus): { text: string; overdue: boolean } {
  if (!dueAt) return { text: "No due date", overdue: false };
  const overdue = isTaskOpen(status) && status !== "verification_pending" && Date.parse(dueAt) < Date.parse(DEMO_NOW);
  return { text: formatShortDate(dueAt), overdue };
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Person({ name, muted }: { name: string | null; muted?: boolean }) {
  if (!name) {
    return (
      <span className="inline-flex items-center gap-1.5 text-fg-subtle">
        <Icon name="user" size={14} />
        Unassigned
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-text">
        {initialsOf(name)}
      </span>
      <span className={muted ? "truncate text-fg-muted" : "truncate"}>{name}</span>
    </span>
  );
}
