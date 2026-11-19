import { Tooltip } from "@/components/ui/tooltip";
import { formatDateTime, formatTime } from "@/lib/format";

const utcText = (iso: string, tz: string) => (tz === "UTC" ? "UTC" : `${formatTime(iso)} UTC`);

/**
 * A moment in the store time zone. The UTC time sits in a tooltip so it is not repeated on every row;
 * pass `detail` to print it underneath instead (single headline moments). Safe on server and client.
 */
export function When({ iso, tz, className, detail }: { iso: string | null; tz: string; className?: string; detail?: boolean }) {
  if (!iso) return <span className="text-fg-subtle">—</span>;
  if (detail) {
    return (
      <span className={className}>
        <span className="tnum block whitespace-nowrap text-[13px] text-fg">{formatDateTime(iso, tz)}</span>
        <span className="tnum block whitespace-nowrap text-xs text-fg-subtle">{utcText(iso, tz)}</span>
      </span>
    );
  }
  return (
    <Tooltip content={tz === "UTC" ? "UTC" : `${formatTime(iso)} UTC · ${tz}`} className={className}>
      <span className="tnum cursor-help whitespace-nowrap text-[13px] text-fg" tabIndex={0}>{formatDateTime(iso, tz)}</span>
    </Tooltip>
  );
}

/** Single-line version: "17 Nov, 09:00 (04:00 UTC)". */
export function whenText(iso: string, tz: string): string {
  return tz === "UTC" ? `${formatDateTime(iso)} UTC` : `${formatDateTime(iso, tz)} (${formatTime(iso)} UTC)`;
}
