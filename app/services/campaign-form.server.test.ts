import { ShopPlan } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { parseBadgeSettingsFormData } from "./badge-settings-form.server";
import { parseCampaignDesignFormData } from "./campaign-design-form.server";
import { parseCampaignFormData } from "./campaign-form.server";
import { parseCampaignTranslationsFormData } from "./campaign-translations-form.server";
import { parseDeliveryCutoffSettingsFormData } from "./delivery-cutoff-settings-form.server";
import { parseDiscountSettingsFormData } from "./discount-settings-form.server";
import { parseFreeShippingSettingsFormData } from "./free-shipping-settings-form.server";
import { parseLowStockSettingsFormData } from "./low-stock-settings-form.server";

describe("campaign form parsing and validation", () => {
  it("validates required campaign fields, active campaign rules, dates, and CTA URLs", () => {
    const parsed = parseCampaignFormData(
      formData({
        ctaUrl: "ftp://example.com",
        endsAt: "2026-06-17T10:00",
        headline: "",
        name: "",
        placementType: "TOP_BAR",
        startsAt: "2026-06-18T10:00",
        status: "ACTIVE",
        timezone: "",
        type: "COUNTDOWN_BAR",
      }),
    );

    expect(parsed.errors).toMatchObject({
      ctaUrl: "CTA URL must be a valid absolute URL or storefront path.",
      endsAt: "End date must be after start date.",
      headline: "An active campaign needs a basic headline translation.",
      name: "Campaign name is required.",
    });
    expect(parsed.values.status).toBe("ACTIVE");
    expect(parsed.values.timezone).toBe("UTC");
  });

  it("does not allow inactive create statuses unless edit mode is enabled", () => {
    expect(
      parseCampaignFormData(
        formData({
          name: "Paused create attempt",
          status: "PAUSED",
        }),
      ).values.status,
    ).toBe("DRAFT");

    expect(
      parseCampaignFormData(
        formData({
          name: "Paused edit",
          status: "PAUSED",
        }),
        { allowInactiveStatuses: true },
      ).values.status,
    ).toBe("PAUSED");
  });

  it("validates design colors, ranges, contrast, and Pro-only custom CSS", () => {
    const parsed = parseCampaignDesignFormData(
      formData({
        accentColor: "#FFFFFF",
        backgroundColor: "#FFFFFF",
        borderRadius: "99",
        buttonColor: "#FFFFFF",
        buttonTextColor: "#FFFFFF",
        customCss: ".pp-bar { opacity: .9; }",
        fontSize: "9",
        icon: "FIRE",
        templateKey: "clean-minimal",
        textColor: "#FFFFFF",
      }),
      ShopPlan.FREE,
    );

    expect(parsed.values.customCss).toBe("");
    expect(parsed.errors).toMatchObject({
      borderRadius: "Border radius must be between 0 and 24.",
      buttonTextColor:
        "Button text color needs stronger contrast with button color.",
      customCss: "Custom CSS requires the Pro plan.",
      fontSize: "Font size must be between 10 and 24.",
      textColor: "Text color needs stronger contrast with background.",
    });
  });

  it("sanitizes custom CSS for Pro campaigns", () => {
    const parsed = parseCampaignDesignFormData(
      formData({
        accentColor: "#2563EB",
        backgroundColor: "#FFFFFF",
        buttonColor: "#111827",
        buttonTextColor: "#FFFFFF",
        customCss:
          "<style>@import url('x'); .x { background: url(javascript:alert(1)); color: red; }</style>",
        fontSize: "14",
        icon: "NONE",
        templateKey: "clean-minimal",
        textColor: "#111827",
      }),
      ShopPlan.PRO,
    );

    expect(parsed.errors.customCss).toBeUndefined();
    expect(parsed.values.customCss).not.toContain("<style>");
    expect(parsed.values.customCss).not.toContain("@import");
    expect(parsed.values.customCss).not.toContain("javascript:");
  });

  it("parses translations and rejects overly long localized copy", () => {
    const parsed = parseCampaignTranslationsFormData(
      formData({
        "translation.en.headline": "English headline",
        "translation.es.headline": "x".repeat(501),
      }),
    );

    expect(parsed.translations).toHaveLength(5);
    expect(parsed.values.en.headline).toBe("English headline");
    expect(parsed.errors.locales?.es?.headline).toBe(
      "Keep headline under 500 characters.",
    );
  });
});

describe("advanced campaign settings form parsing", () => {
  it("validates free shipping thresholds, currencies, and JSON rules", () => {
    const invalid = parseFreeShippingSettingsFormData(
      formData({
        currencyCode: "US",
        thresholdAmount: "0",
        thresholdRulesJson: "[]",
      }),
    );

    expect(invalid.errors).toMatchObject({
      currencyCode: "Currency code must use a 3-letter ISO code.",
      thresholdAmount: "Threshold amount must be greater than 0.",
      thresholdRulesJson: "Threshold rules must be a JSON object.",
    });

    const valid = parseFreeShippingSettingsFormData(
      formData({
        currencyCode: "usd",
        includeDiscountedSubtotal: "on",
        thresholdAmount: "75",
        thresholdRulesJson: '{"AR":120}',
      }),
    );

    expect(valid.errors).toEqual({});
    expect(valid.thresholdAmount).toBe("75.00");
    expect(valid.values.currencyCode).toBe("USD");
    expect(valid.values.includeDiscountedSubtotal).toBe(true);
    expect(valid.thresholdRules).toEqual({ AR: 120 });
  });

  it("validates delivery cutoff windows, working days, holidays, and timezone", () => {
    const parsed = parseDeliveryCutoffSettingsFormData(
      formData({
        cutoffHour: "24",
        cutoffMinute: "60",
        holidaysJson: '["2026/01/01"]',
        maxDeliveryDays: "1",
        minDeliveryDays: "3",
        processingDays: "-1",
        timezone: "Mars/Base",
        workingDaysJson: "[0,8]",
      }),
    );

    expect(parsed.errors).toMatchObject({
      cutoffHour: "Cutoff hour must be between 0 and 23.",
      cutoffMinute: "Cutoff minute must be between 0 and 59.",
      holidaysJson: "Holidays must contain YYYY-MM-DD strings.",
      maxDeliveryDays:
        "Maximum delivery days must be greater than or equal to minimum delivery days.",
      processingDays: "Processing days must be 0 or greater.",
      timezone: "Enter a valid IANA timezone.",
      workingDaysJson: "Working days must contain numbers from 1 to 7.",
    });
  });

  it("validates low stock and badge settings", () => {
    expect(
      parseLowStockSettingsFormData(
        formData({
          fallbackMessage: "x".repeat(181),
          threshold: "0",
        }),
      ).errors,
    ).toMatchObject({
      fallbackMessage: "Keep fallback message under 180 characters.",
      threshold: "Threshold must be a whole number greater than 0.",
    });

    expect(
      parseBadgeSettingsFormData(
        formData({
          badgeText: "",
          badgeShape: "INVALID",
          badgePosition: "INVALID",
        }),
      ),
    ).toMatchObject({
      errors: { badgeText: "Badge text is required." },
      values: {
        badgePosition: "TOP_RIGHT",
        badgeShape: "PILL",
      },
    });
  });

  it("validates discount link/create modes and date order", () => {
    expect(
      parseDiscountSettingsFormData(
        formData({
          mode: "LINK_EXISTING",
        }),
      ).errors,
    ).toMatchObject({
      existingCodeOrId: "Enter or select a Shopify discount code or ID.",
    });

    expect(
      parseDiscountSettingsFormData(
        formData({
          discountCode: "!!",
          endsAt: "2026-06-17T10:00",
          mode: "CREATE_NEW",
          startsAt: "2026-06-18T10:00",
          title: "",
          value: "101",
          valueType: "PERCENTAGE",
        }),
      ).errors,
    ).toMatchObject({
      discountCode:
        "Use 3-40 characters: letters, numbers, dashes, or underscores.",
      endsAt: "End date must be after start date.",
      title: "Discount title is required.",
      value: "Percentage discount cannot exceed 100.",
    });

    expect(
      parseDiscountSettingsFormData(
        formData({
          mode: "UNIQUE_CODES",
          title: "VIP unique discount",
          uniqueCodePrefix: "vip sale!",
          uniqueCodeExpiresMinutes: "30",
          value: "15",
          valueType: "PERCENTAGE",
        }),
      ),
    ).toMatchObject({
      errors: {},
      uniqueCodeExpiresMinutes: 30,
      values: {
        mode: "UNIQUE_CODES",
        uniqueCodePrefix: "VIPSALE",
      },
    });

    expect(
      parseDiscountSettingsFormData(
        formData({
          mode: "UNIQUE_CODES",
          title: "",
          uniqueCodePrefix: "x",
          uniqueCodeExpiresMinutes: "2",
          value: "0",
          valueType: "PERCENTAGE",
        }),
      ).errors,
    ).toMatchObject({
      title: "Discount title is required.",
      uniqueCodeExpiresMinutes:
        "Unique code expiration must be between 5 minutes and 30 days.",
      uniqueCodePrefix:
        "Use 2-16 characters: letters, numbers, dashes, or underscores.",
      value: "Discount value must be greater than 0.",
    });
  });
});

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}
