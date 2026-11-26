"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type Theme = "light" | "dark";

const STORAGE_KEY = "rv-theme";

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

/** Light is the default; only a theme chosen here is stored. */
export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);

  // The script in the root layout sets the theme before first paint. In development React can clear it
  // again when it remounts, so apply the saved choice once more (does nothing in production).
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable: the theme still applies for this session */
    }
  };
  return [theme, toggle];
}

/**
 * Header switch between the light and dark theme. The icon shows the theme you would switch to; CSS picks it
 * (.rv-moon / .rv-sun), so it is already right before React loads. Below `sm` it is hidden, because it would
 * squeeze the website name out of the header; the account menu offers the same choice there.
 */
export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <IconButton label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="pointer-coarse:size-11 max-sm:hidden" onClick={toggle}>
      <Icon name="moon" size={18} className="rv-moon" />
      <Icon name="sun" size={18} className="rv-sun" />
    </IconButton>
  );
}
