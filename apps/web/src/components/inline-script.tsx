"use client";

/**
 * A script that runs during HTML parsing on a full page load. On the client
 * React renders it as inert text/plain, which avoids React's "script tag
 * while rendering" warning on client navigations (switching language renders
 * the root layout again); the work it does (such as the theme attribute on
 * <html>) has already happened by then. It must be a client component: in a
 * server component `window` is never defined, so the script would always
 * render as executable.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
