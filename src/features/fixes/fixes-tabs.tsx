import { LinkTabs } from "@/components/ui/tabs";

/** Findings inbox / Tasks switcher shown under the page header. */
export function FixesTabs({ storeId, findings, tasks }: { storeId: string; findings: number; tasks: number }) {
  const base = `/stores/${storeId}/fixes`;
  return (
    <LinkTabs
      label="Fixes sections"
      items={[
        { href: base, label: "Findings", count: findings, exact: true },
        { href: `${base}/tasks`, label: "Tasks", count: tasks },
      ]}
    />
  );
}
