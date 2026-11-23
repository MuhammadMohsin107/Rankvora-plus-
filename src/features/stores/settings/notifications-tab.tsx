"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NotificationMatrixTable } from "@/features/settings/notification-matrix";
import type { NotificationEvent, NotificationMatrix } from "@/types/settings";

/** Saved per website under `org.notifications.overrides` (the key keeps its old name). */
export type StoreNotifState = { mode: "inherit" | "override"; matrix: NotificationMatrix };

type Props = {
  events: NotificationEvent[];
  webhookReady: boolean;
  saved: StoreNotifState;
  draft: StoreNotifState;
  onDraft: (next: StoreNotifState) => void;
  onSave: () => void;
  readOnly: boolean;
};

/** Which events notify this website's team, and on which channels. This is the only place notifications are set. */
export function NotificationsTab({ events, webhookReady, saved, draft, onDraft, onSave, readOnly }: Props) {
  const dirty = JSON.stringify(saved.matrix) !== JSON.stringify(draft.matrix);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <NotificationMatrixTable events={events} value={draft.matrix} onChange={(matrix) => onDraft({ ...draft, mode: "override", matrix })} disabled={readOnly} webhookReady={webhookReady} />
      </Card>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={readOnly || !dirty} onClick={onSave}>Save notifications</Button>
        <Button variant="ghost" disabled={readOnly || !dirty} onClick={() => onDraft(saved)}>Reset</Button>
        {!dirty ? <span className="text-helper text-fg-muted">No changes</span> : null}
      </div>
    </div>
  );
}
