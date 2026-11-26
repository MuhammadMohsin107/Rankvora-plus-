import { DEMO_NOW, formatShortDate } from "@/lib/format";
import type { Role } from "@/types/core";
import type { CmsState, ExecutionMode, TaskStatus } from "@/types/fixes";
import type { FindingCategory } from "@/types/shared-records";

import { isTaskOpen } from "./fixes-logic";

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
  cms_staged: "Staged website draft",
  approved_apply: "Approved apply / publish",
};

export const MODE_HINT: Record<ExecutionMode, string> = {
  guidance: "Steps for a person. Nothing is written.",
  ai_draft: "AI drafts the change. A person applies it.",
  cms_staged: "Written as an unpublished draft. Simulated here.",
  approved_apply: "Written live after owner or admin approval. Simulated here.",
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

export { isTaskOpen };

export function dueInfo(dueAt: string | null, status: TaskStatus): { text: string; overdue: boolean } {
  if (!dueAt) return { text: "No due date", overdue: false };
  const overdue = isTaskOpen(status) && status !== "verification_pending" && Date.parse(dueAt) < Date.parse(DEMO_NOW);
  return { text: formatShortDate(dueAt), overdue };
}
