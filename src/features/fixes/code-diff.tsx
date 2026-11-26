import { cn } from "@/lib/cn";

type Row = { kind: "same" | "added" | "removed"; text: string; oldNo: number | null; newNo: number | null };

/** Line-level diff (longest common subsequence). Small inputs only (a JSON-LD block, a snippet). */
function diffLines(before: string, after: string): Row[] {
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const rows: Row[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ kind: "same", text: a[i], oldNo: oldNo++, newNo: newNo++ });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      rows.push({ kind: "removed", text: a[i], oldNo: oldNo++, newNo: null });
      i += 1;
    } else {
      rows.push({ kind: "added", text: b[j], oldNo: null, newNo: newNo++ });
      j += 1;
    }
  }
  while (i < a.length) rows.push({ kind: "removed", text: a[i++], oldNo: oldNo++, newNo: null });
  while (j < b.length) rows.push({ kind: "added", text: b[j++], oldNo: null, newNo: newNo++ });
  return rows;
}

const rowTone = {
  same: "text-fg-muted",
  added: "bg-success-soft text-success-text",
  removed: "bg-danger-soft text-danger-text",
};
const marker = { same: " ", added: "+", removed: "−" };

/** Unified code diff with line numbers and +/− markers (never colour alone). */
export function CodeDiff({ before, after, label }: { before: string; after: string; label: string }) {
  const rows = diffLines(before, after);
  const added = rows.filter((r) => r.kind === "added").length;
  const removed = rows.filter((r) => r.kind === "removed").length;
  return (
    <figure className="min-w-0 overflow-hidden rounded-control border border-line bg-surface">
      <figcaption className="flex items-center justify-between gap-2 border-b border-line bg-surface-2/70 px-3 py-1.5 text-xs font-medium text-fg-muted">
        <span className="truncate">{label}</span>
        <span className="tnum shrink-0">
          <span className="text-success-text">+{added}</span> <span className="text-danger-text">−{removed}</span>
        </span>
      </figcaption>
      <div className="ui-scroll overflow-x-auto" tabIndex={0} role="group" aria-label={`${label}, scrollable table`}>
        <table className="w-full border-collapse font-mono text-xs leading-5">
          <caption className="sr-only">{label}</caption>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={cn(rowTone[row.kind])}>
                <td aria-hidden="true" className="tnum w-9 select-none border-r border-line px-2 text-right text-fg-subtle">{row.oldNo ?? ""}</td>
                <td aria-hidden="true" className="tnum w-9 select-none border-r border-line px-2 text-right text-fg-subtle">{row.newNo ?? ""}</td>
                <td className="w-5 select-none px-1.5 text-center" aria-label={row.kind === "added" ? "added" : row.kind === "removed" ? "removed" : "unchanged"}>{marker[row.kind]}</td>
                <td className="whitespace-pre px-2">{row.text || " "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
