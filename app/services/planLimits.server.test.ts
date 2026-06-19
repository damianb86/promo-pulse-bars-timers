import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canUseFeature,
  evaluateCanActivateCampaign,
  getCampaignPlanViolations,
  getPlanLimits,
  isCampaignAllowedByPlan,
  validateCampaignPlanAccess,
} from "./planLimits.server";

describe("plan limits", () => {
  beforeEach(() => {
    vi.stubEnv("PROMO_PULSE_DEV_PLAN", "");
    vi.stubEnv("PROMOPILOT_DEV_PLAN", "");
    vi.stubEnv("COUNTERPULSE_DEV_PLAN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defines Free active campaign and impression limits", () => {
    expect(getPlanLimits("FREE")).toMatchObject({
      activeCampaignLimit: 1,
      monthlyImpressionLimit: 5000,
      monthlyPriceUsd: 0,
    });
  });

  it("unlocks custom CSS only on Pro", () => {
    expect(canUseFeature({ plan: "GROWTH" }, "custom_css")).toMatchObject({
      allowed: false,
      requiredPlan: "PRO",
    });
    expect(canUseFeature({ plan: "PRO" }, "custom_css")).toMatchObject({
      allowed: true,
    });
  });

  it("unlocks unique visitor discount codes only on Pro", () => {
    expect(
      canUseFeature({ plan: "GROWTH" }, "unique_discount_codes"),
    ).toMatchObject({
      allowed: false,
      requiredPlan: "PRO",
    });
    expect(
      canUseFeature({ plan: "PRO" }, "unique_discount_codes"),
    ).toMatchObject({
      allowed: true,
    });
  });

  it("blocks a second active campaign on Free", () => {
    expect(evaluateCanActivateCampaign("FREE", 1, false)).toMatchObject({
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

  it("treats local development as Pro when no override is configured", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(canUseFeature({ plan: "FREE" }, "product_badges")).toMatchObject({
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
    ).resolves.toEqual([
      "Scheduling requires the Starter plan.",
      "Product Badges requires the Pro plan.",
      "Cart Drawer requires the Growth plan.",
    ]);
  });

  it("reports storefront campaign violations for locked runtime features", () => {
    expect(
      getCampaignPlanViolations(
        { plan: "FREE" },
        {
          type: "PRODUCT_BADGE",
          placements: [{ enabled: true, placementType: "CART_DRAWER" }],
        },
        "CART_DRAWER",
      ),
    ).toEqual([
      "Product Badges requires the Pro plan.",
      "Cart Drawer requires the Growth plan.",
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

  it("blocks advanced targeting below Pro", () => {
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
    ).toEqual(["Advanced Targeting requires the Pro plan."]);
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
    ).toEqual(["Advanced Targeting requires the Pro plan."]);

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
