/** Keyset pagination on (created_at, id), newest first. Cursor: "<ms>_<id>". */

export function decodeCursor(cursor: string): { at: number; id: string } {
  const separator = cursor.indexOf("_");
  return { at: Number(cursor.slice(0, separator)), id: cursor.slice(separator + 1) };
}

/** Pass `limit + 1` rows; the extra one only says whether another page exists. */
export function toPage<T extends { id: string; createdAt: number }>(rows: T[], limit: number): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? `${last.createdAt}_${last.id}` : null };
}
