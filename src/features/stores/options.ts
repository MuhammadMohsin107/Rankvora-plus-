/** Static form options for store setup (UI constants, not demo data). */

export const COUNTRIES: { code: string; name: string; timezone: string; language: string }[] = [
  { code: "PK", name: "Pakistan", timezone: "Asia/Karachi", language: "en" },
  { code: "AE", name: "United Arab Emirates", timezone: "Asia/Dubai", language: "en" },
  { code: "GB", name: "United Kingdom", timezone: "Europe/London", language: "en" },
  { code: "US", name: "United States", timezone: "America/New_York", language: "en" },
  { code: "CA", name: "Canada", timezone: "America/Toronto", language: "en" },
  { code: "DE", name: "Germany", timezone: "Europe/Berlin", language: "de" },
  { code: "FR", name: "France", timezone: "Europe/Paris", language: "fr" },
  { code: "ES", name: "Spain", timezone: "Europe/Madrid", language: "es" },
  { code: "SA", name: "Saudi Arabia", timezone: "Asia/Riyadh", language: "ar" },
  { code: "IN", name: "India", timezone: "Asia/Kolkata", language: "en" },
  { code: "SG", name: "Singapore", timezone: "Asia/Singapore", language: "en" },
  { code: "AU", name: "Australia", timezone: "Australia/Sydney", language: "en" },
];

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "ur", label: "Urdu" },
];

export const TIMEZONES: string[] = [
  "UTC",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "America/New_York",
  "America/Toronto",
  "America/Chicago",
  "America/Los_Angeles",
];

export const INDUSTRIES: string[] = [
  "Running footwear",
  "Home fitness equipment",
  "Fashion and apparel",
  "Beauty and personal care",
  "Consumer electronics",
  "Home and garden",
  "Food and beverage",
  "Health and wellness",
  "Sports and outdoors",
  "Software",
  "Professional services",
  "Other",
];

/** Platforms offered in the Add store form, in display order. */
export const PLATFORM_ORDER = ["shopify", "woocommerce", "wordpress", "webflow", "custom", "manual"] as const;
