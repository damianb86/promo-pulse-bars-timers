import { ShopPlan } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseBadgeSettingsFormData } from "./badge-settings-form.server";
import { parseCampaignDesignFormData } from "./campaign-design-form.server";
import { parseCampaignFormData } from "./campaign-form.server";
import {
  parseCampaignTranslationsFormData,
  syncBaseCampaignTranslationValues,
} from "./campaign-translations-form.server";
import { parseDeliveryCutoffSettingsFormData } from "./delivery-cutoff-settings-form.server";
import { parseDiscountSettingsFormData } from "./discount-settings-form.server";
import { parseFreeShippingSettingsFormData } from "./free-shipping-settings-form.server";
import {
  buildCampaignFreeShippingSettingsValues,
  buildCampaignTargetingValues,
  buildCampaignTimerSettingsValues,
} from "../types/campaign-form";
import { parseLowStockSettingsFormData } from "./low-stock-settings-form.server";

describe("campaign form parsing and validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("uses the visible expired title value when hidden message fields are duplicated", () => {
    const data = new FormData();

    data.set("name", "Expired title");
    data.set("timerExpiredBehavior", "SHOW_CUSTOM_TITLE");
    data.append("expiredText", "Hidden default title");
    data.append("expiredText", "Buyer-specific finished title");

    expect(parseCampaignFormData(data).values.expiredText).toBe(
      "Buyer-specific finished title",
    );
  });

  it("validates design colors, ranges, contrast, and Pro-only custom CSS", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PROMO_PULSE_DEV_PLAN", "");

    const parsed = parseCampaignDesignFormData(
      formData({
        accentColor: "#FFFFFF",
        backgroundColor: "#FFFFFF",
        borderRadius: "-1",
        buttonColor: "#FFFFFF",
        buttonTextColor: "#FFFFFF",
        customCss: ".pp-bar { opacity: .9; }",
        fontSize: "9",
        icon: "FIRE",
        iconSize: "99",
        templateKey: "clean-minimal",
        textColor: "#FFFFFF",
      }),
      ShopPlan.FREE,
    );

    expect(parsed.values.customCss).toBe("");
    expect(parsed.errors).toMatchObject({
      borderRadius: "Border radius must be 0 or greater.",
      buttonTextColor:
        "Button text color needs stronger contrast with button color.",
      customCss: "Custom CSS requires the Pro plan.",
      fontSize: "Font size must be between 10 and 24.",
      iconSize: "Icon size must be between 12 and 64.",
      textColor: "Text color needs stronger contrast with background.",
    });
  });

  it("parses valid design icon size", () => {
    const parsed = parseCampaignDesignFormData(
      formData({
        accentColor: "#2563EB",
        backgroundColor: "#FFFFFF",
        buttonColor: "#111827",
        buttonTextColor: "#FFFFFF",
        fontSize: "14",
        icon: "FIRE",
        iconSize: "36",
        templateKey: "clean-minimal",
        textColor: "#111827",
      }),
      ShopPlan.PRO,
    );

    expect(parsed.errors.iconSize).toBeUndefined();
    expect(parsed.values.iconSize).toBe(36);
  });

  it("parses modern design controls, media, timer labels, and motion settings", () => {
    const parsed = parseCampaignDesignFormData(
      formData({
        templateKey: "premium-dark",
        layout: "CTA_TOP",
        backgroundType: "IMAGE",
        backgroundImageUrl: "https://cdn.shopify.com/s/files/background.png",
        gradientStartColor: "#123456",
        gradientEndColor: "#ABCDEF",
        gradientAngle: "271",
        backgroundColor: "#FFFFFF",
        textColor: "#111827",
        accentColor: "#2563EB",
        buttonColor: "#111827",
        buttonTextColor: "#FFFFFF",
        closeButtonColor: "#F8FAFC",
        fontSize: "16",
        borderRadius: "0",
        borderSize: "2",
        borderColor: "#E5E7EB",
        fontFamily: "CASUAL",
        titleFontSize: "28",
        titleColor: "#111827",
        subheadingFontSize: "18",
        subheadingColor: "#4B5563",
        timerFontSize: "44",
        timerColor: "#111827",
        legendFontSize: "14",
        legendColor: "#6B7280",
        timerStyle: "BOXES",
        timerFormat: "COLON",
        timerShowLabels: "on",
        timerShowSeconds: "true",
        timerHideZeroDays: "on",
        timerDaysLabel: "D",
        timerHoursLabel: "Hr",
        timerMinutesLabel: "Min",
        timerSecondsLabel: "Sec",
        timerSurfaceColor: "#FFFFFF",
        timerSurfaceBorderColor: "#D1D5DB",
        timerSurfaceBorderSize: "1",
        timerSurfaceRadius: "10",
        paddingBlock: "12",
        paddingInline: "18",
        contentGap: "14",
        contentMaxWidth: "720",
        fullWidth: "on",
        positionMode: "OVERLAY",
        positionSticky: "on",
        entranceAnimation: "SLIDE",
        exitAnimation: "POP",
        animationDurationMs: "480",
        timerTickAnimation: "FLIP",
        mobileEnabled: "true",
        alignment: "RIGHT",
        showCloseButton: "on",
        showButton: "on",
        showProgressBar: "on",
        showIcon: "on",
        icon: "CUSTOM",
        iconSize: "48",
        customIconUrl: "data:image/png;base64,AAAA",
        customCss: ".pp-banner { opacity: .98; }",
      }),
      ShopPlan.PRO,
    );

    expect(parsed.errors).toEqual({});
    expect(parsed.values).toMatchObject({
      layout: "CTA_TOP",
      backgroundType: "IMAGE",
      backgroundImageUrl: "https://cdn.shopify.com/s/files/background.png",
      gradientAngle: 271,
      fontFamily: "CASUAL",
      timerStyle: "BOXES",
      timerFormat: "COLON",
      timerShowLabels: true,
      timerShowSeconds: true,
      timerHideZeroDays: true,
      timerDaysLabel: "D",
      timerHoursLabel: "Hr",
      timerMinutesLabel: "Min",
      timerSecondsLabel: "Sec",
      timerSurfaceRadius: 10,
      paddingBlock: 12,
      paddingInline: 18,
      contentGap: 14,
      contentMaxWidth: 720,
      fullWidth: true,
      positionMode: "OVERLAY",
      positionSticky: true,
      entranceAnimation: "SLIDE",
      exitAnimation: "POP",
      animationDurationMs: 480,
      timerTickAnimation: "FLIP",
      mobileEnabled: true,
      alignment: "RIGHT",
      showCloseButton: true,
      showButton: true,
      showProgressBar: true,
      showIcon: true,
      icon: "CUSTOM",
      iconSize: 48,
      customIconUrl: "data:image/png;base64,AAAA",
    });
    expect(parsed.values.customCss).toContain(".pp-banner");
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

  it("uses visible embedded translation values and syncs base campaign copy", () => {
    const data = new FormData();
    data.append("translation.en.headline", "Hidden English headline");
    data.append("translation.en.headline", "Visible English headline");
    data.set("translation.en.expiredText", "Old expired title");

    const parsed = parseCampaignTranslationsFormData(data);

    expect(parsed.values.en.headline).toBe("Visible English headline");

    const synced = syncBaseCampaignTranslationValues(parsed, {
      headline: "Current headline",
      subheadline: "Current subheadline",
      ctaText: "Current CTA",
      ctaUrl: "/collections/all",
      expiredText: "Timer finished for this buyer",
    });

    expect(synced.values.en).toMatchObject({
      headline: "Current headline",
      subheadline: "Current subheadline",
      ctaText: "Current CTA",
      ctaUrl: "/collections/all",
      expiredText: "Timer finished for this buyer",
    });
    expect(
      synced.translations.find((translation) => translation.locale === "en"),
    ).toMatchObject({
      headline: "Current headline",
      expiredText: "Timer finished for this buyer",
    });
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

  it("parses free shipping campaign settings, targeting, placements, and linked discount visibility", () => {
    const parsed = parseCampaignFormData(
      formData({
        goal: "FREE_SHIPPING",
        type: "FREE_SHIPPING_GOAL",
        name: "Free shipping push",
        headline: "Free shipping unlocked soon",
        placementTypes: "TOP_BAR",
        productSelection: "TAGS",
        productTags: "summer, vip",
        countrySelection: "SPECIFIC_COUNTRIES",
        countries: "us, ar",
        freeShippingThresholdAmount: "100",
        freeShippingCurrencyCode: "usd",
        freeShippingIncludeDiscountedSubtotal: "on",
        freeShippingProgressStyle: "CIRCULAR",
        freeShippingEmptyCartMessage: "Add {{amount}} more",
        freeShippingSuccessMessage: "Shipping is free",
        freeShippingAutoDiscount: "on",
        freeShippingExistingDiscount: "ship100",
        freeShippingDiscountTitle: "Free shipping over 100",
        freeShippingShowDiscountCode: "on",
      }),
    );

    expect(parsed.errors).toEqual({});
    expect(parsed.values).toMatchObject({
      goal: "FREE_SHIPPING",
      type: "FREE_SHIPPING_GOAL",
      placementTypes: ["TOP_BAR"],
      placementType: "TOP_BAR",
      productSelection: "TAGS",
      productTags: "summer, vip",
      countrySelection: "SPECIFIC_COUNTRIES",
      countries: "us, ar",
      freeShippingThresholdAmount: "100",
      freeShippingCurrencyCode: "USD",
      freeShippingProgressStyle: "CIRCULAR",
      freeShippingAutoDiscount: true,
      freeShippingExistingDiscount: "ship100",
      freeShippingShowDiscountCode: true,
    });
    expect(buildCampaignTargetingValues(parsed.values)).toMatchObject({
      productTags: ["summer", "vip"],
      countries: ["US", "AR"],
    });
    expect(
      buildCampaignFreeShippingSettingsValues(parsed.values),
    ).toMatchObject({
      thresholdAmount: "100",
      currencyCode: "USD",
      includeDiscountedSubtotal: true,
      progressStyle: "CIRCULAR",
      emptyCartMessage: "Add {{amount}} more",
      successMessage: "Shipping is free",
    });
  });

  it("validates goal-specific campaign settings", () => {
    expect(
      parseCampaignFormData(
        formData({
          goal: "FREE_SHIPPING",
          type: "FREE_SHIPPING_GOAL",
          name: "Bad free shipping",
          headline: "Free shipping",
          freeShippingThresholdAmount: "0",
          freeShippingCurrencyCode: "US",
          freeShippingAutoDiscount: "on",
          freeShippingExistingDiscount: "!!",
          freeShippingDiscountTitle: "",
        }),
      ).errors,
    ).toMatchObject({
      freeShippingThresholdAmount:
        "Enter a free shipping threshold greater than 0.",
      freeShippingCurrencyCode: "Currency code must use a 3-letter ISO code.",
      freeShippingExistingDiscount:
        "Use an existing Shopify discount ID or code.",
    });

    expect(
      parseCampaignFormData(
        formData({
          goal: "CART_RESCUE",
          type: "CART_TIMER",
          name: "Cart timer",
          cartTimerDurationMinutes: "0",
        }),
      ).errors,
    ).toMatchObject({
      cartTimerDurationMinutes:
        "Enter cart reservation minutes between 1 and 10080.",
    });

    expect(
      parseCampaignFormData(
        formData({
          goal: "DELIVERY_CUTOFF",
          type: "DELIVERY_CUTOFF",
          name: "Delivery cutoff",
          deliveryCutoffHour: "25",
          deliveryCutoffMinute: "99",
          deliveryProcessingDays: "-1",
          deliveryMinDays: "5",
          deliveryMaxDays: "3",
          deliveryWorkingDays: "0,8",
        }),
      ).errors,
    ).toMatchObject({
      deliveryCutoffHour: "Enter a cutoff hour from 0 to 23.",
      deliveryCutoffMinute: "Enter a cutoff minute from 0 to 59.",
      deliveryProcessingDays: "Enter processing days from 0 to 60.",
      deliveryMaxDays:
        "Maximum delivery days must be greater than or equal to minimum delivery days.",
      deliveryWorkingDays: "Choose at least one fulfillment day.",
    });

    expect(
      parseCampaignFormData(
        formData({
          goal: "LOW_STOCK_URGENCY",
          type: "LOW_STOCK",
          name: "Low stock",
          lowStockThreshold: "0",
          lowStockFallbackMessage: "x".repeat(181),
        }),
      ).errors,
    ).toMatchObject({
      lowStockThreshold: "Enter a low-stock threshold from 1 to 9999.",
      lowStockFallbackMessage:
        "Keep the fallback message under 180 characters.",
    });

    expect(
      parseCampaignFormData(
        formData({
          goal: "PRODUCT_BADGE",
          type: "PRODUCT_BADGE",
          name: "Badge",
          badgeText: "x".repeat(49),
        }),
      ).errors,
    ).toMatchObject({
      badgeText: "Keep badge text under 48 characters.",
    });
  });

  it("builds timer settings for fixed, evergreen, recurring, and cart-rescue modes", () => {
    const evergreen = parseCampaignFormData(
      formData({
        name: "Evergreen",
        timerMode: "EVERGREEN_SESSION",
        timerDurationMinutes: "90",
        timerExpiredBehavior: "REPEAT_COUNTDOWN",
        timerResetBehavior: "DAILY",
      }),
    ).values;

    expect(buildCampaignTimerSettingsValues(evergreen)).toMatchObject({
      mode: "EVERGREEN_SESSION",
      durationMinutes: 90,
      resetBehavior: "ON_SESSION_END",
      expiredBehavior: "REPEAT_COUNTDOWN",
    });

    const recurring = parseCampaignFormData(
      formData({
        name: "Recurring",
        timerMode: "RECURRING_DAILY",
        timerRecurringHour: "17",
        timerRecurringMinute: "45",
      }),
    ).values;

    expect(buildCampaignTimerSettingsValues(recurring)).toMatchObject({
      mode: "RECURRING_DAILY",
      durationMinutes: null,
      recurringDays: [{ cutoffHour: 17, cutoffMinute: 45 }],
    });

    const cart = parseCampaignFormData(
      formData({
        goal: "CART_RESCUE",
        type: "CART_TIMER",
        name: "Cart timer",
        timerMode: "EVERGREEN_SESSION",
        cartTimerDurationMinutes: "35",
        cartTimerResetBehavior: "WEEKLY",
      }),
    ).values;

    expect(buildCampaignTimerSettingsValues(cart)).toMatchObject({
      mode: "EVERGREEN_SESSION",
      durationMinutes: 35,
      resetBehavior: "WEEKLY",
    });
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
