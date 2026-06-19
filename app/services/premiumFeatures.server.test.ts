import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canUsePremiumFeature,
  defaultStage2FeatureFlags,
  isPremiumFeatureFlagEnabled,
} from "./premiumFeatures.server";

describe("premium Stage 2 feature gates", () => {
  beforeEach(() => {
    vi.stubEnv("PROMO_PULSE_DEV_PLAN", "");
    vi.stubEnv("PROMOPILOT_DEV_PLAN", "");
    vi.stubEnv("COUNTERPULSE_DEV_PLAN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables implemented Stage 2 flags and keeps future flags disabled", () => {
    expect(defaultStage2FeatureFlags.UNIQUE_CODES).toBe(true);
    expect(defaultStage2FeatureFlags.AB_TESTING).toBe(true);
    expect(defaultStage2FeatureFlags.ADVANCED_DISCOUNTS).toBe(true);
    expect(defaultStage2FeatureFlags.CHECKOUT_EXTENSIONS).toBe(true);
    expect(defaultStage2FeatureFlags.AI_CAMPAIGN_BUILDER).toBe(true);
    expect(defaultStage2FeatureFlags.AUTO_WINNER).toBe(true);
    expect(isPremiumFeatureFlagEnabled("AB_TESTING")).toBe(true);
    expect(isPremiumFeatureFlagEnabled("ADVANCED_DISCOUNTS")).toBe(true);
    expect(isPremiumFeatureFlagEnabled("CHECKOUT_EXTENSIONS")).toBe(true);
    expect(isPremiumFeatureFlagEnabled("AI_CAMPAIGN_BUILDER")).toBe(true);
    expect(isPremiumFeatureFlagEnabled("AUTO_WINNER")).toBe(true);
  });

  it("requires the configured plan after a flag is enabled", () => {
    expect(
      canUsePremiumFeature({ plan: "PRO" }, "AB_TESTING", {
        AB_TESTING: true,
      }),
    ).toMatchObject({
      allowed: false,
      enabled: true,
      requiredPlan: "PREMIUM",
    });
    expect(
      canUsePremiumFeature({ plan: "PREMIUM" }, "AB_TESTING", {
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
      canUsePremiumFeature({ plan: "STARTER" }, "CAMPAIGN_LIBRARY"),
    ).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
  });

  it("allows checkout extensions on Pro and blocks Growth", () => {
    expect(
      canUsePremiumFeature({ plan: "GROWTH" }, "CHECKOUT_EXTENSIONS"),
    ).toMatchObject({
      allowed: false,
      enabled: true,
      requiredPlan: "PRO",
    });
    expect(
      canUsePremiumFeature({ plan: "PRO" }, "CHECKOUT_EXTENSIONS"),
    ).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
  });

  it("reserves agency dashboard for Agency plans", () => {
    expect(
      canUsePremiumFeature({ plan: "PREMIUM" }, "AGENCY_DASHBOARD"),
    ).toMatchObject({
      allowed: false,
      enabled: true,
      requiredPlan: "AGENCY",
    });
    expect(
      canUsePremiumFeature({ plan: "AGENCY" }, "AGENCY_DASHBOARD"),
    ).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
  });

  it("supports PROMOPILOT_DEV_PLAN=PREMIUM for premium feature gates", () => {
    vi.stubEnv("PROMOPILOT_DEV_PLAN", "PREMIUM");

    expect(canUsePremiumFeature({ plan: "FREE" }, "AB_TESTING")).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
  });
});
