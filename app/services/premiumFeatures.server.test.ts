import { describe, expect, it } from "vitest";

import {
  canUsePremiumFeature,
  defaultStage2FeatureFlags,
  isPremiumFeatureFlagEnabled,
} from "./premiumFeatures.server";

describe("premium Stage 2 feature gates", () => {
  it("enables implemented Stage 2 flags and keeps future flags disabled", () => {
    expect(defaultStage2FeatureFlags.UNIQUE_CODES).toBe(true);
    expect(defaultStage2FeatureFlags.AB_TESTING).toBe(true);
    expect(defaultStage2FeatureFlags.ADVANCED_DISCOUNTS).toBe(true);
    expect(defaultStage2FeatureFlags.AUTO_WINNER).toBe(false);
    expect(isPremiumFeatureFlagEnabled("AB_TESTING")).toBe(true);
    expect(isPremiumFeatureFlagEnabled("ADVANCED_DISCOUNTS")).toBe(true);
    expect(isPremiumFeatureFlagEnabled("AUTO_WINNER")).toBe(false);
  });

  it("requires the configured plan after a flag is enabled", () => {
    expect(
      canUsePremiumFeature({ plan: "GROWTH" }, "AB_TESTING", {
        AB_TESTING: true,
      }),
    ).toMatchObject({
      allowed: false,
      enabled: true,
      requiredPlan: "PRO",
    });
    expect(
      canUsePremiumFeature({ plan: "PRO" }, "AB_TESTING", {
        AB_TESTING: true,
      }),
    ).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
  });

  it("allows unflagged planning-only premium features by plan", () => {
    expect(
      canUsePremiumFeature({ plan: "GROWTH" }, "CAMPAIGN_LIBRARY"),
    ).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
  });
});
