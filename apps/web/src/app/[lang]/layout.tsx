import type { Metadata } from "next";
import { Epilogue, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { THEME_SCRIPT } from "@/components/theme-script";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { LOCALES, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import "../globals.css";

const display = Epilogue({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700"] });
const body = Hanken_Grotesk({ variable: "--font-body", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["500", "600", "700"] });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: { default: dict.site.name, template: `%s · ${dict.site.name}` },
    description: dict.site.tagline,
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const other = lang === "es" ? "en" : "es";

  return (
    // The head script sets data-theme before hydration, so React must accept it.
    <html
      lang={lang}
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
            <Link href={`/${lang}`} className="mr-auto flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <span aria-hidden="true" className="inline-block size-2.5 rounded-full bg-accent" />
              {dict.site.name}
            </Link>
            <Link
              href={`/${lang}`}
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface hover:text-foreground sm:inline-flex"
            >
              {dict.nav.home}
            </Link>
            <Link href={`/${lang}/songs/new`} className="btn-primary px-3 text-sm whitespace-nowrap sm:px-4">
              <span className="sm:hidden">{dict.nav.uploadShort}</span>
              <span className="hidden sm:inline">{dict.nav.upload}</span>
            </Link>
            <Suspense
              fallback={
                <Link href={`/${other}`} className="segmented-item">
                  {other.toUpperCase()}
                </Link>
              }
            >
              <LanguageSwitcher current={lang} label={dict.nav.switchLanguage} />
            </Suspense>
            <ThemeToggle toLight={dict.nav.themeToLight} toDark={dict.nav.themeToDark} />
            <Suspense fallback={<span aria-hidden="true" className="size-9" />}>
              <UserMenu lang={lang} labels={dict.nav} />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </body>
    </html>
  );
}
