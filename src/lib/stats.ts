/** Wilson score interval for a proportion, returned as percentages [low, high]. Null when d = 0. */
export function wilsonInterval(numerator: number, denominator: number, z = 1.96): [number, number] | null {
  if (denominator <= 0) return null;
  const p = numerator / denominator;
  const z2 = z * z;
  const centre = p + z2 / (2 * denominator);
  const margin = z * Math.sqrt((p * (1 - p)) / denominator + z2 / (4 * denominator * denominator));
  const base = 1 + z2 / denominator;
  return [Math.max(0, ((centre - margin) / base) * 100), Math.min(100, ((centre + margin) / base) * 100)];
}

/** Policy from the Comparison spec: headline trends need ≥ 20 matched pairs. */
export const MIN_MATCHED_PAIRS = 20;

export function sampleStatus(matchedPairs: number): "ok" | "directional" | "insufficient" {
  if (matchedPairs <= 0) return "insufficient";
  return matchedPairs >= MIN_MATCHED_PAIRS ? "ok" : "directional";
}

/** Percentage-point change; null if either side has no denominator. */
export function pointChange(base: { n: number; d: number }, current: { n: number; d: number }): number | null {
  if (base.d <= 0 || current.d <= 0) return null;
  return (current.n / current.d) * 100 - (base.n / base.d) * 100;
}

/** Relative change in %, undefined ("new from zero") when the baseline rate is 0. */
export function relativeChange(base: { n: number; d: number }, current: { n: number; d: number }): number | null {
  if (base.d <= 0 || current.d <= 0) return null;
  const b = base.n / base.d;
  if (b === 0) return null;
  return ((current.n / current.d - b) / b) * 100;
}
