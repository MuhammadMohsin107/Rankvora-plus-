import { formatDateTime, formatTime } from "@/lib/format";

/** A moment in the store time zone with the UTC time underneath. Safe on server and client. */
export function When({ iso, tz, className }: { iso: string | null; tz: string; className?: string }) {
  if (!iso) return <span className="text-fg-subtle">—</span>;
  return (
    <span className={className}>
      <span className="tnum block whitespace-nowrap text-[13px] text-fg">{formatDateTime(iso, tz)}</span>
      <span className="tnum block whitespace-nowrap text-xs text-fg-subtle">{tz === "UTC" ? "UTC" : `${formatTime(iso)} UTC`}</span>
    </span>
  );
}

/** Single-line version: "17 Nov, 09:00 (04:00 UTC)". */
export function whenText(iso: string, tz: string): string {
  return tz === "UTC" ? `${formatDateTime(iso)} UTC` : `${formatDateTime(iso, tz)} (${formatTime(iso)} UTC)`;
}
