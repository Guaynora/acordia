import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LOCALES, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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

  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-3xl items-center gap-5 px-4 py-3">
            <Link href={`/${lang}`} className="mr-auto text-lg font-bold tracking-tight">
              {dict.site.name}
            </Link>
            <Link href={`/${lang}`} className="text-sm text-muted hover:text-foreground">
              {dict.nav.home}
            </Link>
            <Link href={`/${lang}/songs/new`} className="btn-primary text-sm">
              {dict.nav.upload}
            </Link>
            <Suspense
              fallback={
                <Link href={`/${lang === "es" ? "en" : "es"}`} className="text-sm text-muted hover:text-foreground">
                  {dict.nav.switchLanguage}
                </Link>
              }
            >
              <LanguageSwitcher current={lang} label={dict.nav.switchLanguage} />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
