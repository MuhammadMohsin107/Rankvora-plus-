/**
 * Deterministic formatters (fixed locale, UTC unless a time zone is given) so
 * server and client render identical text — no hydration mismatches.
 */

const LOCALE = "en-GB";

const nf = new Intl.NumberFormat(LOCALE);

export const formatNumber = (value: number) => nf.format(value);

/** numerator/denominator as a percentage with one decimal; null when d = 0. */
export function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(digits)}%`;
}

export function formatRate(numerator: number, denominator: number, digits = 1): string {
  return formatPercent(ratePercent(numerator, denominator), digits);
}

/** "+12.5 pp" / "−3.0 pp" */
export function formatPoints(value: number | null, digits = 1): string {
  if (value === null) return "N/A";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)} pp`;
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency, maximumFractionDigits: value < 100 ? 2 : 0 }).format(value);
}

type DateInput = string | number | Date;

export function formatDate(input: DateInput, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(input));
}

export function formatShortDate(input: DateInput, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone }).format(new Date(input));
}

export function formatDateTime(input: DateInput, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(input));
}

export function formatTime(input: DateInput, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(input));
}

/** Fixed "now" for demo data. Real data will use request time. */
export const DEMO_NOW = "2026-11-19T09:00:00Z";

/** Relative text against DEMO_NOW (or a supplied reference). */
export function formatRelative(input: DateInput, reference: DateInput = DEMO_NOW): string {
  const diff = new Date(input).getTime() - new Date(reference).getTime();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  let text: string;
  if (abs < minute) text = "just now";
  else if (abs < hour) text = `${Math.round(abs / minute)} min`;
  else if (abs < day) text = `${Math.round(abs / hour)} h`;
  else text = `${Math.round(abs / day)} d`;
  if (text === "just now") return text;
  return diff < 0 ? `${text} ago` : `in ${text}`;
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export const pluralize = (count: number, one: string, many = `${one}s`) =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;
