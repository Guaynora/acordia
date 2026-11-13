"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, type Locale } from "@/i18n/config";

/** ES / EN toggle that keeps the current page. */
export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  return (
    <div className="segmented" role="group" aria-label={label}>
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          href={pathname.replace(/^\/(es|en)(?=\/|$)/, `/${locale}`)}
          hrefLang={locale}
          aria-pressed={locale === current}
          className="segmented-item"
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
