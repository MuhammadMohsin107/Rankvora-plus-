import type { ReactNode } from "react";

/** Each organization page renders its own SettingsHeader (title plus sub-navigation). */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
