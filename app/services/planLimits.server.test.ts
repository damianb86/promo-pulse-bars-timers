import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canUseFeature,
  evaluateCanActivateCampaign,
  getCampaignPlanViolations,
  getEffectiveShopPlan,
  getPlanLimits,
  isCampaignAllowedByPlan,
  normalizeShopPlan,
  publicPlanOrder,
  validateCampaignPlanAccess,
} from "./planLimits.server";

describe("plan limits", () => {
  beforeEach(() => {
    vi.stubEnv("PROMO_PULSE_DEV_PLAN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only exposes the four public plans", () => {
    expect(publicPlanOrder).toEqual(["FREE", "STARTER", "GROWTH", "PRO"]);
  });

  it("defines Free active campaign and impression limits", () => {
    expect(getPlanLimits("FREE")).toMatchObject({
      activeCampaignLimit: 2,
      activeAbTestLimit: 1,
      abTestVariantLimit: 2,
      analyticsRetentionDays: 7,
      monthlyImpressionLimit: 10_000,
      monthlyUniqueCodeLimit: 25,
      monthlyPriceUsd: 0,
    });
  });

  it("defines Starter, Growth, and Pro limits", () => {
    expect(getPlanLimits("STARTER")).toMatchObject({
      activeCampaignLimit: 5,
      activeAbTestLimit: 2,
      abTestVariantLimit: 2,
      analyticsRetentionDays: 30,
      discountSyncCampaignLimit: 3,
      monthlyImpressionLimit: 50_000,
      monthlyUniqueCodeLimit: 500,
      monthlyPriceUsd: 9,
    });
    expect(getPlanLimits("GROWTH")).toMatchObject({
      activeCampaignLimit: 25,
      activeAbTestLimit: 10,
      abTestVariantLimit: 3,
      analyticsRetentionDays: 90,
      discountSyncCampaignLimit: null,
      emailCountdownTimerLimit: 5,
      monthlyImpressionLimit: 250_000,
      monthlyUniqueCodeLimit: 5_000,
      monthlyPriceUsd: 19,
    });
    expect(getPlanLimits("PRO")).toMatchObject({
      activeCampaignLimit: null,
      activeAbTestLimit: null,
      analyticsRetentionDays: 365,
      emailCountdownTimerLimit: null,
      monthlyImpressionLimit: 1_500_000,
      monthlyUniqueCodeLimit: 50_000,
      monthlyPriceUsd: 39,
    });
  });

  it("unlocks custom CSS on Growth and Pro", () => {
    expect(canUseFeature({ plan: "STARTER" }, "custom_css")).toMatchObject({
      allowed: false,
      requiredPlan: "GROWTH",
    });
    expect(canUseFeature({ plan: "GROWTH" }, "custom_css")).toMatchObject({
      allowed: true,
    });
  });

  it("blocks custom CSS on Free", () => {
    expect(canUseFeature({ plan: "FREE" }, "custom_css")).toMatchObject({
      allowed: false,
      requiredPlan: "GROWTH",
    });
  });

  it("includes every plan-limit feature on Pro", () => {
    expect(Object.values(getPlanLimits("PRO").features).every(Boolean)).toBe(
      true,
    );
  });

  it("allows basic unique visitor discount codes on Free", () => {
    expect(
      canUseFeature({ plan: "FREE" }, "unique_discount_codes"),
    ).toMatchObject({
      allowed: true,
    });
  });

  it("blocks a second active campaign on Free", () => {
    expect(evaluateCanActivateCampaign("FREE", 2, false)).toMatchObject({
      allowed: false,
      requiredPlan: "STARTER",
    });
  });

  it("blocks activation after the monthly impression limit is reached", () => {
    expect(evaluateCanActivateCampaign("STARTER", 0, true)).toMatchObject({
      allowed: false,
      reason: "Monthly impression limit reached for the current plan.",
    });
  });

  it("allows high active campaign counts on Pro", () => {
    expect(evaluateCanActivateCampaign("PRO", 999, false)).toEqual({
      allowed: true,
      reason: "",
    });
  });

  it("supports development plan override", () => {
    vi.stubEnv("PROMO_PULSE_DEV_PLAN", " pro ");

    expect(canUseFeature({ plan: "FREE" }, "custom_css")).toMatchObject({
      allowed: true,
    });
  });

  it("maps old Premium and Agency plan values to Pro", () => {
    expect(normalizeShopPlan("PREMIUM")).toBe("PRO");
    expect(normalizeShopPlan("AGENCY")).toBe("PRO");
    expect(getPlanLimits("AGENCY")).toMatchObject({
      plan: "PRO",
      monthlyPriceUsd: 39,
    });
  });

  it("treats local development as Pro when no override is configured", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(getEffectiveShopPlan({ plan: "FREE" })).toBe("PRO");
    expect(canUseFeature({ plan: "FREE" }, "product_badges")).toMatchObject({
      allowed: true,
    });
    expect(
      canUseFeature({ plan: "FREE" }, "unique_discount_codes"),
    ).toMatchObject({
      allowed: true,
    });
  });

  it("reports campaign feature gates", async () => {
    await expect(
      validateCampaignPlanAccess(
        { id: "shop-1", plan: "FREE" },
        {
          placementType: "CART_DRAWER",
          startsAt: "2026-06-20T10:00",
          status: "DRAFT",
          type: "PRODUCT_BADGE",
        },
      ),
    ).resolves.toEqual(["Scheduling requires the Starter plan."]);
  });

  it("reports storefront campaign violations for locked runtime features", () => {
    expect(
      getCampaignPlanViolations(
        { plan: "FREE" },
        {
          type: "CART_TIMER",
          design: { customCss: ".pp-bar { letter-spacing: 0; }" },
          placements: [{ enabled: true, placementType: "TOP_BAR" }],
        },
        "TOP_BAR",
      ),
    ).toEqual([
      "Cart Timer requires the Starter plan.",
      "Custom CSS requires the Growth plan.",
    ]);
  });

  it("allows Pro storefront campaigns that use premium features", () => {
    expect(
      isCampaignAllowedByPlan(
        { plan: "PRO" },
        {
          type: "PRODUCT_BADGE",
          placements: [{ enabled: true, placementType: "CART_DRAWER" }],
          design: { customCss: ".pp-bar { letter-spacing: 0; }" },
          discountSync: { discountCode: "SAVE20", method: "UNIQUE_CODE" },
          targeting: { customerTags: ["vip"], countries: ["US"] },
          timerSettings: { mode: "RECURRING_DAILY" },
        },
        "CART_DRAWER",
      ),
    ).toBe(true);
  });

  it("allows Growth advanced targeting", () => {
    expect(
      getCampaignPlanViolations(
        { plan: "GROWTH" },
        {
          type: "COUNTDOWN_BAR",
          placements: [{ enabled: true, placementType: "TOP_BAR" }],
          targeting: { customerTags: ["vip"], utmSources: ["email"] },
        },
        "TOP_BAR",
      ),
    ).toEqual([]);
  });

  it("blocks active behavior targeting below Pro but ignores disabled rules", () => {
    expect(
      getCampaignPlanViolations(
        { plan: "GROWTH" },
        {
          type: "COUNTDOWN_BAR",
          placements: [{ enabled: true, placementType: "TOP_BAR" }],
          targeting: {
            behaviorRules: {
              enabled: true,
              segments: ["HIGH_INTENT"],
            },
          },
        },
        "TOP_BAR",
      ),
    ).toEqual(["Behavioral Targeting requires the Pro plan."]);

    expect(
      getCampaignPlanViolations(
        { plan: "GROWTH" },
        {
          type: "COUNTDOWN_BAR",
          placements: [{ enabled: true, placementType: "TOP_BAR" }],
          targeting: {
            behaviorRules: {
              enabled: false,
              segments: ["HIGH_INTENT"],
            },
          },
        },
        "TOP_BAR",
      ),
    ).toEqual([]);
  });
});
