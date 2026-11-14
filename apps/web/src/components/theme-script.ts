export const THEME_STORAGE_KEY = "acordia-theme";

/**
 * Runs in <head> before the first paint: applies the saved theme, or the
 * system one when nothing is saved, so the page never flashes the wrong theme.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

/** The saved theme, or the system one when nothing is saved: what THEME_SCRIPT applies. */
export function preferredTheme(): "light" | "dark" {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage unavailable: fall back to the system theme.
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
