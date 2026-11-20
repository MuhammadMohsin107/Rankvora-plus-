/** Short option lists for organization forms. */

export const TIMEZONES: string[] = [
  "UTC",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
];

export const COUNTRIES: { value: string; label: string }[] = [
  { value: "PK", label: "Pakistan" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "IN", label: "India" },
  { value: "GB", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "US", label: "United States" },
  { value: "AU", label: "Australia" },
  { value: "SG", label: "Singapore" },
];

export const LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "ur", label: "Urdu" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

export function withCurrent<T extends string>(list: string[], current: T): string[] {
  return list.includes(current) ? list : [current, ...list];
}

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

/** Optional https address. */
export function validateHttpsUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? null : "Webhook addresses must use https.";
  } catch {
    return "Enter a full address, e.g. https://hooks.example.com/rankvora.";
  }
}
