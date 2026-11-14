/**
 * A script that runs during HTML parsing on a full page load. On the client
 * React renders it as inert text/plain, which avoids React's "script tag
 * while rendering" warning on client navigations; the work it does (such as
 * the theme attribute on <html>) has already happened by then.
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
