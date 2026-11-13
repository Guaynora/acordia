export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

export function hasLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Picks the first supported language from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return { language: tag.toLowerCase().split("-")[0] ?? "", weight: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.weight - a.weight);
  for (const { language } of preferred) {
    if (hasLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
}
