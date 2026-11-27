/** Next local id like "local-comp-3" from a list that may already contain such ids. No randomness. */
export function nextId(prefix: string, ids: string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const highest = ids.reduce((max, id) => {
    const match = id.match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${highest + 1}`;
}

export const TAB_IDS = ["profile", "brand", "competitors", "products", "integrations", "notifications", "activity", "danger"] as const;
export type TabId = (typeof TAB_IDS)[number];
