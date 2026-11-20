"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/form";
import { NotificationMatrixTable } from "@/features/settings/notification-matrix";
import type { NotificationEvent, NotificationMatrix } from "@/types/settings";

export type StoreNotifState = { mode: "inherit" | "override"; matrix: NotificationMatrix };

type Props = {
  events: NotificationEvent[];
  orgMatrix: NotificationMatrix;
  webhookReady: boolean;
  saved: StoreNotifState;
  draft: StoreNotifState;
  onDraft: (next: StoreNotifState) => void;
  onSave: () => void;
  readOnly: boolean;
};

/** This website follows the organization defaults or customises them. Saved under `org.notifications.overrides`. */
export function NotificationsTab({ events, orgMatrix, webhookReady, saved, draft, onDraft, onSave, readOnly }: Props) {
  const dirty = saved.mode !== draft.mode || (draft.mode === "override" && JSON.stringify(saved.matrix) !== JSON.stringify(draft.matrix));
  const inherit = draft.mode === "inherit";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex justify-end px-card pt-card">
          <Segmented<StoreNotifState["mode"]>
            label="Notification source"
            value={draft.mode}
            onChange={(mode) => onDraft({ ...draft, mode, matrix: mode === "override" && saved.mode === "inherit" ? orgMatrix : draft.matrix })}
            options={[
              { value: "inherit", label: "Organization defaults" },
              { value: "override", label: "Customise" },
            ]}
          />
        </div>
        <div className="mt-3">
          <NotificationMatrixTable events={events} value={inherit ? orgMatrix : draft.matrix} onChange={(matrix) => onDraft({ ...draft, matrix })} disabled={readOnly || inherit} webhookReady={webhookReady} />
        </div>
      </Card>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={readOnly || !dirty} onClick={onSave}>Save notifications</Button>
        <Button variant="ghost" disabled={readOnly || !dirty} onClick={() => onDraft(saved)}>Reset</Button>
        {!dirty ? <span className="text-helper text-fg-muted">No changes</span> : null}
      </div>
    </div>
  );
}
