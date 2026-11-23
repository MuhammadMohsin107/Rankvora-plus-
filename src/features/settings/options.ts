import { COUNTRIES as SITE_COUNTRIES } from "@/features/stores/options";

/** Option lists for organization forms. One source: the website setup lists in `@/features/stores/options`. */
export const COUNTRIES: { value: string; label: string }[] = SITE_COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

export function validateText(value: string, label: string, min = 1, max = 120): string | null {
  const text = value.trim();
  if (!text) return `${label} is required.`;
  if (text.length < min) return `${label} must be at least ${min} characters.`;
  if (text.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

export function validateEmailAddress(value: string): string | null {
  const text = value.trim();
  if (!text) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) return "Enter a valid email address.";
  return null;
}
