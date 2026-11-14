import { describe, expect, it } from "vitest";
import { isFeatureEnabled } from "@/config/features";

describe("feature flags", () => {
  it("is off when the variable is unset or empty", () => {
    expect(isFeatureEnabled("autoScroll", {})).toBe(false);
    expect(isFeatureEnabled("autoScroll", { FEATURE_AUTO_SCROLL: "" })).toBe(false);
  });

  it.each(["true", "1", "on", "yes", " TRUE ", "On"])("is on for %j", (value) => {
    expect(isFeatureEnabled("autoScroll", { FEATURE_AUTO_SCROLL: value })).toBe(true);
  });

  it.each(["false", "0", "off", "no", "enabled?"])("is off for %j", (value) => {
    expect(isFeatureEnabled("autoScroll", { FEATURE_AUTO_SCROLL: value })).toBe(false);
  });
});
