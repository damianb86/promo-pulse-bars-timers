import { describe, expect, it } from "vitest";

import {
  evaluateBadgeRules,
  sortBadgesByPriority,
  type AdvancedBadgeRuleInput,
} from "./badgeRuleEngine";

const now = new Date("2026-06-18T12:00:00.000Z");

describe("advanced badge rule engine", () => {
  it("matches rules by product tag", () => {
    const badges = evaluateBadgeRules(
      { productTags: ["summer", "VIP"], locale: "en" },
      [
        rule({
          id: "tag-rule",
          conditions: { productTags: ["vip"] },
          design: { text: "VIP" },
        }),
      ],
      { now },
    );

    expect(badges).toMatchObject([{ id: "tag-rule", text: "VIP" }]);
  });

  it("matches inventory thresholds", () => {
    const badges = evaluateBadgeRules(
      { inventoryQuantity: 4, locale: "en" },
      [
        rule({
          id: "low-stock-rule",
          conditions: { inventoryBelow: 5 },
          design: { text: "Almost gone" },
        }),
        rule({
          id: "too-high-rule",
          conditions: { inventoryBelow: 3 },
          design: { text: "Hidden" },
        }),
      ],
      { now },
    );

    expect(badges.map((badge) => badge.id)).toEqual(["low-stock-rule"]);
  });

  it("matches metafield conditions from a mocked product context", () => {
    const badges = evaluateBadgeRules(
      {
        metafields: {
          "custom.badge_group": "premium",
        },
      },
      [
        rule({
          id: "metafield-rule",
          conditions: {
            metafields: [
              { namespace: "custom", key: "badge_group", value: "premium" },
            ],
          },
          design: { text: "Premium" },
        }),
      ],
      { now },
    );

    expect(badges).toHaveLength(1);
  });

  it("sorts by priority and removes duplicate badge labels", () => {
    const badges = sortBadgesByPriority([
      {
        id: "low-priority",
        campaignId: "campaign-1",
        priority: 1,
        text: "Sale",
        design: { position: "TOP_RIGHT" },
      },
      {
        id: "high-priority",
        campaignId: "campaign-1",
        priority: 20,
        text: "Sale",
        design: { position: "TOP_RIGHT" },
      },
      {
        id: "second",
        campaignId: "campaign-1",
        priority: 10,
        text: "New",
        design: { position: "TOP_LEFT" },
      },
    ]);

    expect(badges.map((badge) => badge.id)).toEqual([
      "high-priority",
      "second",
    ]);
  });

  it("respects scheduling windows", () => {
    const badges = evaluateBadgeRules(
      { productTags: ["sale"] },
      [
        rule({
          id: "active-window",
          conditions: {
            productTags: ["sale"],
            startsAt: "2026-06-18T11:00:00.000Z",
            endsAt: "2026-06-18T13:00:00.000Z",
          },
          design: { text: "Sale" },
        }),
        rule({
          id: "future-window",
          conditions: {
            productTags: ["sale"],
            startsAt: "2026-06-18T13:00:00.000Z",
          },
          design: { text: "Future" },
        }),
      ],
      { now },
    );

    expect(badges.map((badge) => badge.id)).toEqual(["active-window"]);
  });

  it("falls back from locale to language and then English text", () => {
    const [badge] = evaluateBadgeRules(
      { locale: "es-AR" },
      [
        rule({
          id: "locale-rule",
          conditions: { locales: ["es"] },
          design: {
            text: "Default",
            textByLocale: {
              en: "English",
              es: "Oferta",
            },
          },
        }),
      ],
      { now },
    );

    expect(badge?.text).toBe("Oferta");
  });

  it("matches compare_at price and active discount rules", () => {
    const badges = evaluateBadgeRules(
      {
        price: 80,
        compareAtPrice: 120,
        discountActive: true,
      },
      [
        rule({
          id: "discount-rule",
          conditions: {
            compareAtPriceRequired: true,
            discountActive: true,
          },
          design: { text: "Markdown" },
        }),
      ],
      { now },
    );

    expect(badges).toHaveLength(1);
  });
});

function rule(
  overrides: Partial<AdvancedBadgeRuleInput>,
): AdvancedBadgeRuleInput {
  return {
    id: "rule-1",
    campaignId: "campaign-1",
    priority: 0,
    status: "ACTIVE",
    conditions: {},
    design: { text: "Badge" },
    ...overrides,
  };
}
