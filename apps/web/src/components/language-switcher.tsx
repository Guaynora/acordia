"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";

/** Links to the same page in the other language. */
export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const target: Locale = current === "es" ? "en" : "es";
  const href = pathname.replace(/^\/(es|en)(?=\/|$)/, `/${target}`);
  return (
    <Link href={href} hrefLang={target} className="text-sm text-muted hover:text-foreground">
      {label}
    </Link>
  );
}
