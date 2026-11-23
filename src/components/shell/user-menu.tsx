"use client";

import { useState, useSyncExternalStore } from "react";

import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { demoStore, simulatedToast, useDemoReset } from "@/demo-state";
import { downloadFile } from "@/features/settings/invoice-files";
import type { Member } from "@/types/core";

const ROLE_LABEL = { owner: "Owner", admin: "Admin", editor: "Editor", auditor: "Auditor", viewer: "Viewer" } as const;

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

/** Account menu: theme, demo data export and the one confirmed reset. Navigation lives in the sidebar. */
export function UserMenu({ user }: { user: Member }) {
  const [theme, toggleTheme] = useTheme();
  const reset = useDemoReset();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  const items: MenuItem[] = [
    { label: theme === "dark" ? "Light theme" : "Dark theme", icon: theme === "dark" ? "sun" : "moon", onSelect: toggleTheme },
    { type: "separator" },
    {
      label: "Export demo data",
      icon: "download",
      onSelect: () => {
        downloadFile("rankvora-demo-data.json", "application/json", `${JSON.stringify(demoStore.getSnapshot(), null, 2)}\n`);
        toast.push(simulatedToast("Demo data file prepared", "info"));
      },
    },
    { label: "Reset demo data", icon: "undo", tone: "danger", onSelect: () => setConfirming(true) },
  ];

  return (
    <>
      <Menu
        align="end"
        width={256}
        label="Account"
        header={
          <div className="min-w-0">
            <p className="truncate text-body-sm font-semibold text-fg">{user.name}</p>
            <p className="truncate text-helper text-fg-muted">{user.email}</p>
            <Badge tone="accent" className="mt-1.5">{ROLE_LABEL[user.role]}</Badge>
          </div>
        }
        items={items}
        trigger={
          <button
            type="button"
            aria-label={`Account menu, ${user.name}`}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity duration-[var(--dur-fast)] hover:opacity-85 pointer-coarse:size-11"
          >
            <UserAvatar name={user.name} size="md" />
          </button>
        }
      />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          reset();
          setConfirming(false);
        }}
        title="Reset demo data?"
        confirmLabel="Reset demo data"
      >
        Websites, prompts, tasks and other changes you made in this browser are removed. The built-in demo data stays.
      </ConfirmDialog>
    </>
  );
}
