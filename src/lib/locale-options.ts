/** Fixed choices for forms. The server accepts any real country, language and IANA time zone. */

export const MARKETS: { code: string; language: string; timezone: string }[] = [
  { code: "PK", language: "en", timezone: "Asia/Karachi" },
  { code: "AE", language: "en", timezone: "Asia/Dubai" },
  { code: "SA", language: "ar", timezone: "Asia/Riyadh" },
  { code: "QA", language: "ar", timezone: "Asia/Qatar" },
  { code: "GB", language: "en", timezone: "Europe/London" },
  { code: "US", language: "en", timezone: "America/New_York" },
  { code: "CA", language: "en", timezone: "America/Toronto" },
  { code: "DE", language: "de", timezone: "Europe/Berlin" },
  { code: "FR", language: "fr", timezone: "Europe/Paris" },
  { code: "ES", language: "es", timezone: "Europe/Madrid" },
  { code: "IL", language: "he", timezone: "Asia/Jerusalem" },
  { code: "IN", language: "en", timezone: "Asia/Kolkata" },
  { code: "SG", language: "en", timezone: "Asia/Singapore" },
  { code: "AU", language: "en", timezone: "Australia/Sydney" },
];

export const LANGUAGE_CODES = ["en", "ur", "ar", "de", "fr", "es", "he", "hi"] as const;

const regions = new Intl.DisplayNames(["en"], { type: "region" });
const languages = new Intl.DisplayNames(["en"], { type: "language" });

export const countryName = (code: string) => regions.of(code) ?? code;
export const languageName = (tag: string) => languages.of(tag) ?? tag;
