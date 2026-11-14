/**
 * Only same-site paths may be used as a post-login destination, so a crafted
 * link cannot bounce people to another site ("//evil.com", "https://…").
 */
export function safeReturnPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function loginPath(lang: string, next: string): string {
  return `/${lang}/login?next=${encodeURIComponent(next)}`;
}
