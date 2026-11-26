"use client";

import { useState, type ReactNode } from "react";

import type { MenuItem } from "@/components/ui/menu";
import type { FindingRow, Recommendation } from "@/types/fixes";

import { CreateTaskDialog, ReasonDialog, REASONS } from "./fix-dialogs";
import { canCreateTask, findingReviewActions, isTaskOpen, REVIEW_LABEL, type FindingReviewAction } from "./fixes-logic";
import type { FixData } from "./use-fix-data";

type Dialog = { type: "false_positive" | "accept_risk" | "task"; finding: FindingRow; recommendation: Recommendation | null } | null;

const ICON: Record<FindingReviewAction, "check-circle" | "x-circle" | "shield" | "refresh"> = {
  confirm: "check-circle",
  false_positive: "x-circle",
  accept_risk: "shield",
  reopen: "refresh",
};

/**
 * Review actions on a finding (confirm, false positive, accept risk, reopen) and task creation, shared by the inbox
 * rows and the finding page. Returns the menu items for one finding and the dialogs to render once.
 */
export function useFindingActions(fix: FixData) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  const openCreate = (finding: FindingRow, recommendation: Recommendation | null = finding.context?.recommendation ?? null) => setDialog({ type: "task", finding, recommendation });

  const reviewItems = (finding: FindingRow): MenuItem[] =>
    findingReviewActions(finding.status).map((action) => ({
      label: REVIEW_LABEL[action],
      icon: ICON[action],
      onSelect: () => {
        if (action === "false_positive" || action === "accept_risk") setDialog({ type: action, finding, recommendation: null });
        else fix.reviewFinding(finding.id, action);
      },
    }));

  /** Menu items for a finding: review actions, then Create task. */
  const menuItems = (finding: FindingRow): MenuItem[] => {
    const items: MenuItem[] = reviewItems(finding);
    const eligible = canCreateTask(finding.status);
    if (items.length > 0) items.push({ type: "separator" });
    items.push({
      label: "Create task",
      icon: "plus",
      disabled: !eligible,
      disabledReason: "Finding is closed. Reopen it first.",
      onSelect: () => openCreate(finding),
    });
    return items;
  };

  const target = dialog?.finding;
  const ctx = target?.context;
  const dialogs: ReactNode = (
    <>
      <ReasonDialog
        open={dialog?.type === "false_positive"}
        onClose={close}
        title="Mark as false positive"
        description={target?.title}
        confirmLabel="Mark false positive"
        reasons={REASONS.falsePositive}
        onConfirm={(reason) => {
          if (target) fix.reviewFinding(target.id, "false_positive", { reason });
          close();
        }}
      />
      <ReasonDialog
        open={dialog?.type === "accept_risk"}
        onClose={close}
        title="Accept risk"
        description={target?.title}
        confirmLabel="Accept risk"
        tone="primary"
        expiry
        reasons={REASONS.acceptRisk}
        onConfirm={(reason, expiresAt) => {
          if (target) fix.reviewFinding(target.id, "accept_risk", { reason, expiresAt });
          close();
        }}
      />
      <CreateTaskDialog
        open={dialog?.type === "task"}
        onClose={close}
        recommendation={dialog?.recommendation ?? null}
        openTasks={(target?.tasks ?? []).filter((t) => isTaskOpen(t.status)).map((t) => ({ id: t.id, title: t.title }))}
        onCreate={({ mode, dueAt }) => {
          if (target) {
            fix.createTask({
              finding: {
                id: target.id,
                title: target.title,
                category: target.category,
                priority: target.priority,
                status: target.status,
                expected: ctx?.expected ?? "",
                actual: ctx?.actual ?? "",
                affectedUrls: ctx?.affectedUrls ?? [],
                verificationCriteria: ctx?.verificationCriteria ?? [],
              },
              recommendation: dialog?.recommendation ?? null,
              mode,
              assignee: null,
              dueAt,
            });
          }
          close();
        }}
      />
    </>
  );

  return { menuItems, reviewItems, openCreate, dialogs };
}
