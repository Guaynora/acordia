/**
 * Feature flags, switched with environment variables so a feature can ship
 * dark and be turned on (or back off) per deployment without a code change.
 *
 * Flags are read on the server while rendering a request, so changing one
 * only needs a server restart, not a rebuild. They are not NEXT_PUBLIC_
 * variables: client components receive the resolved boolean as a prop.
 *
 * A flag is on for "true", "1", "on" or "yes" (any case); anything else,
 * including unset, leaves the feature off.
 */

const FLAGS = {
  /** Auto-scroll of the chord sheet, at the song's tempo or a manual speed. */
  autoScroll: "FEATURE_AUTO_SCROLL",
} as const;

export type Feature = keyof typeof FLAGS;

const ON = new Set(["true", "1", "on", "yes"]);

export function isFeatureEnabled(
  feature: Feature,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const value = env[FLAGS[feature]];
  return value !== undefined && ON.has(value.trim().toLowerCase());
}
