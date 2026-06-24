import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canUsePremiumFeature,
  defaultStage2FeatureFlags,
  isPremiumFeatureFlagEnabled,
} from "./premiumFeatures.server";
import { premiumFeatureKeys } from "../types/stage2";

describe("premium Stage 2 feature gates", () => {
  beforeEach(() => {
    vi.stubEnv("PROMO_PULSE_DEV_PLAN", "");
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
      canUsePremiumFeature({ plan: "FREE" }, "AB_TESTING", {
        AB_TESTING: true,
      }),
    ).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
  });

  it("reserves auto-winner for Pro", () => {
    expect(
      canUsePremiumFeature({ plan: "GROWTH" }, "AUTO_WINNER", {
        AUTO_WINNER: true,
      }),
    ).toMatchObject({
      allowed: false,
      enabled: true,
      requiredPlan: "PRO",
    });
    expect(
      canUsePremiumFeature({ plan: "PRO" }, "AUTO_WINNER", {
        AUTO_WINNER: true,
      }),
    ).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
  });

  it("blocks AI, advanced reports, and auto-winner on Free", () => {
    expect(
      canUsePremiumFeature({ plan: "FREE" }, "AI_CAMPAIGN_BUILDER"),
    ).toMatchObject({
      allowed: false,
      requiredPlan: "GROWTH",
    });
    expect(
      canUsePremiumFeature({ plan: "FREE" }, "ADVANCED_REPORTING"),
    ).toMatchObject({
      allowed: false,
      requiredPlan: "GROWTH",
    });
    expect(canUsePremiumFeature({ plan: "FREE" }, "AUTO_WINNER"))
      .toMatchObject({
        allowed: false,
        requiredPlan: "PRO",
      });
  });

  it("allows every premium feature on Pro", () => {
    for (const featureKey of premiumFeatureKeys) {
      expect(canUsePremiumFeature({ plan: "PRO" }, featureKey)).toMatchObject({
        allowed: true,
        enabled: true,
      });
    }
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

  it("unlocks optimization features on Growth", () => {
    expect(
      canUsePremiumFeature({ plan: "GROWTH" }, "ADVANCED_REPORTING"),
    ).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
    expect(canUsePremiumFeature({ plan: "GROWTH" }, "AI_CAMPAIGN_BUILDER"))
      .toMatchObject({
        allowed: true,
        enabled: true,
      });
  });

  it("reserves multi-store workspace tools for Pro", () => {
    expect(
      canUsePremiumFeature({ plan: "GROWTH" }, "AGENCY_DASHBOARD"),
    ).toMatchObject({
      allowed: false,
      enabled: true,
      requiredPlan: "PRO",
    });
    expect(
      canUsePremiumFeature({ plan: "PRO" }, "AGENCY_DASHBOARD"),
    ).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
  });

  it("treats local development as Pro for premium feature gates", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(canUsePremiumFeature({ plan: "FREE" }, "AGENCY_DASHBOARD")).toEqual({
      allowed: true,
      enabled: true,
      reason: "",
    });
  });
});
