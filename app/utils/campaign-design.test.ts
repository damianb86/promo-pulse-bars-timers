import { describe, expect, it } from "vitest";

import {
  applyCampaignDesignTemplate,
  getContrastRatio,
  hasReadableContrast,
  isValidHexColor,
  sanitizeCustomCss,
  validateCampaignDesignValues,
} from "./campaign-design";
import {
  campaignDesignTemplates,
  defaultCampaignDesignValues,
  describeDesignSettingsForAi,
  designAlignmentOptions,
  designBannerAnimationOptions,
  designFontFamilyOptions,
  designIconOptions,
  designLayoutOptions,
  designOfferApplyBehaviorOptions,
  designOfferCodeLayoutOptions,
  designOfferCopyBehaviorOptions,
  designPositionModeOptions,
  designTimerFormatOptions,
  designTimerStyleOptions,
  designTimerTickAnimationOptions,
  isMobileDesignLayout,
} from "../types/campaign-design";

describe("campaign design validation", () => {
  it("accepts 6-digit hex colors", () => {
    expect(isValidHexColor("#111827")).toBe(true);
    expect(isValidHexColor("#fff")).toBe(false);
    expect(isValidHexColor("111827")).toBe(false);
  });

  it("validates design values", () => {
    expect(validateCampaignDesignValues(defaultCampaignDesignValues)).toEqual(
      {},
    );

    expect(
      validateCampaignDesignValues({
        ...defaultCampaignDesignValues,
        backgroundColor: "black",
        fontSize: 42,
        iconSize: 99,
      }),
    ).toMatchObject({
      backgroundColor: "Enter a valid 6-digit hex color.",
      fontSize: "Font size must be between 10 and 24.",
      iconSize: "Icon size must be between 12 and 64.",
    });

    expect(
      validateCampaignDesignValues({
        ...defaultCampaignDesignValues,
        backgroundColor: "#FFFFFF",
        textColor: "#F5F5F5",
        buttonColor: "#FFFFFF",
        buttonTextColor: "#F5F5F5",
      }),
    ).toMatchObject({
      textColor: "Text color needs stronger contrast with background.",
      buttonTextColor:
        "Button text color needs stronger contrast with button color.",
    });
  });

  it("keeps all exposed layout, font, timer, animation, alignment, and icon options valid", () => {
    expect(designLayoutOptions.map((option) => option.value)).toEqual([
      "STANDARD",
      "BALANCED",
      "BALANCED_REVERSE",
      "INLINE",
      "STACKED_WIDE",
      "COMPACT_STACK",
      "CTA_RIGHT",
      "CTA_LEFT",
      "CTA_TOP",
      "HERO_TIMER",
      "SIDE_RAIL",
      "SPREAD",
      "MOBILE_BANNER",
      "MOBILE_CARD",
      "MOBILE_SHEET",
      "MOBILE_COMPACT_BAR",
      "MOBILE_SPOTLIGHT",
    ]);
    expect(designFontFamilyOptions.map((option) => option.value)).toEqual([
      "THEME",
      "SYSTEM",
      "SERIF",
      "ROUNDED",
      "MONO",
      "GEOMETRIC",
      "HUMANIST",
      "CONDENSED",
      "CASUAL",
    ]);
    expect(designTimerStyleOptions.map((option) => option.value)).toEqual([
      "PLAIN",
      "GROUPED",
      "BOXES",
    ]);
    expect(designTimerFormatOptions.map((option) => option.value)).toEqual([
      "UNITS",
      "COLON",
    ]);
    expect(designBannerAnimationOptions.map((option) => option.value)).toEqual([
      "NONE",
      "FADE",
      "SLIDE",
      "POP",
    ]);
    expect(
      designTimerTickAnimationOptions.map((option) => option.value),
    ).toEqual(["NONE", "FADE", "FLIP", "PULSE"]);
    expect(designPositionModeOptions.map((option) => option.value)).toEqual([
      "FLOW",
      "OVERLAY",
    ]);
    expect(designAlignmentOptions.map((option) => option.value)).toEqual([
      "LEFT",
      "CENTER",
      "RIGHT",
    ]);
    expect(designIconOptions.map((option) => option.value)).toEqual([
      "FIRE",
      "CLOCK",
      "TRUCK",
      "GIFT",
      "TAG",
      "STAR",
      "BOLT",
      "HEART",
      "CART",
      "PERCENT",
      "BELL",
      "ROCKET",
      "CHECK",
      "CUSTOM",
      "NONE",
    ]);
    expect(designOfferCodeLayoutOptions.map((option) => option.value)).toEqual([
      "INLINE",
      "STACKED",
      "COMPACT",
    ]);
    expect(
      designOfferCopyBehaviorOptions.map((option) => option.value),
    ).toEqual(["FEEDBACK", "HIDE_OFFER", "CLOSE_CAMPAIGN"]);
    expect(
      designOfferApplyBehaviorOptions.map((option) => option.value),
    ).toEqual(["SHOW_APPLIED", "HIDE_OFFER", "CLOSE_CAMPAIGN"]);

    for (const values of [
      ...campaignDesignTemplates,
      defaultCampaignDesignValues,
    ]) {
      expect(validateCampaignDesignValues(values)).toEqual({});
    }
  });

  it("checks readable contrast", () => {
    expect(getContrastRatio("#000000", "#FFFFFF")).toBeGreaterThan(20);
    expect(hasReadableContrast("#111827", "#FFFFFF")).toBe(true);
    expect(hasReadableContrast("#F5F5F5", "#FFFFFF")).toBe(false);
  });

  it("keeps bundled templates readable", () => {
    for (const template of campaignDesignTemplates) {
      expect(
        hasReadableContrast(template.textColor, template.backgroundColor),
      ).toBe(true);
      expect(
        hasReadableContrast(template.buttonTextColor, template.buttonColor),
      ).toBe(true);
    }
  });

  it("applies templates without carrying over visual defaults accidentally", () => {
    const values = applyCampaignDesignTemplate("flash-sale", {
      ...defaultCampaignDesignValues,
      layout: "CTA_LEFT",
      customCss: ".banner { letter-spacing: 0; }",
    });

    expect(values.templateKey).toBe("flash-sale");
    expect(values.layout).toBe("CTA_LEFT");
    expect(values.backgroundColor).toBe("#7F1D1D");
    expect(values.timerFontSize).toBe(32);
    expect(values.timerStyle).toBe("GROUPED");
    expect(values.customCss).toBe(".banner { letter-spacing: 0; }");
  });

  it("reconciles preset visuals with the selected layout defaults", () => {
    const values = applyCampaignDesignTemplate("love", {
      ...defaultCampaignDesignValues,
      layout: "STACKED_WIDE",
      titleFontSize: 48,
      timerFontSize: 72,
    });

    expect(values.templateKey).toBe("love");
    expect(values.layout).toBe("STACKED_WIDE");
    expect(values.backgroundType).toBe("GRADIENT");
    expect(values.titleFontSize).toBe(24);
    expect(values.timerFontSize).toBe(36);
    expect(values.timerFormat).toBe("UNITS");
    expect(values.timerShowLabels).toBe(true);
    expect(values.contentMaxWidth).toBe(1040);
  });

  it("gates and sanitizes custom CSS", () => {
    expect(sanitizeCustomCss(".x { color: red; }", false)).toBe("");
    expect(
      sanitizeCustomCss(
        "<style>@import url('x'); .x { background: url(javascript:alert(1)); }</style>",
        true,
      ),
    ).not.toContain("@import");
  });

  it("validates custom icons and image backgrounds", () => {
    expect(
      validateCampaignDesignValues({
        ...defaultCampaignDesignValues,
        icon: "CUSTOM",
        customIconUrl: "",
      }),
    ).toMatchObject({
      customIconUrl: "Upload an SVG, PNG, JPG, or JPEG icon.",
    });

    expect(
      validateCampaignDesignValues({
        ...defaultCampaignDesignValues,
        icon: "CUSTOM",
        customIconUrl: "data:text/html;base64,PHNjcmlwdD4=",
      }),
    ).toMatchObject({
      customIconUrl: "Upload a valid image icon.",
    });

    expect(
      validateCampaignDesignValues({
        ...defaultCampaignDesignValues,
        backgroundType: "IMAGE",
        backgroundImageUrl: "javascript:alert(1)",
      }),
    ).toMatchObject({
      backgroundImageUrl: "Use a valid image URL.",
    });

    expect(
      validateCampaignDesignValues({
        ...defaultCampaignDesignValues,
        icon: "CUSTOM",
        customIconUrl: "data:image/png;base64,AAAA",
        backgroundType: "IMAGE",
        backgroundImageUrl: "https://cdn.shopify.com/icon.png",
      }),
    ).toEqual({});
  });

  it("validates offer-code design settings", () => {
    expect(
      validateCampaignDesignValues({
        ...defaultCampaignDesignValues,
        offerCodeTextColor: "#FFFFFF",
        offerCodeBackgroundColor: "#F5F5F5",
        offerCodeLayout: "CAROUSEL" as never,
        offerCopyBehavior: "DISMISS" as never,
        offerApplyBehavior: "RESET" as never,
        offerCodeFontSize: 32,
        offerCodeGap: 40,
        appliedDiscountMessage: "",
      }),
    ).toMatchObject({
      offerCodeTextColor:
        "Offer code text needs stronger contrast with its background.",
      offerCodeLayout: "Choose a valid offer layout.",
      offerCopyBehavior: "Choose a valid copy behavior.",
      offerApplyBehavior: "Choose a valid apply behavior.",
      offerCodeFontSize: "Offer code font size must be between 10 and 24.",
      offerCodeGap: "Offer gap must be between 0 and 24.",
      appliedDiscountMessage: "Applied message is required.",
    });
  });
});

describe("describeDesignSettingsForAi", () => {
  const catalog = describeDesignSettingsForAi();

  it("documents the core visual fields the image flow can override", () => {
    for (const field of [
      "layout",
      "backgroundType",
      "backgroundColor",
      "gradientStartColor",
      "textColor",
      "buttonColor",
      "paddingBlock",
      "paddingInline",
      "contentGap",
      "timerStyle",
      "timerFormat",
      "showButton",
      "showIcon",
      "fullWidth",
      "alignment",
    ]) {
      expect(catalog).toContain(field);
    }
  });

  it("only lists desktop layout values, never mobile-only ones", () => {
    for (const option of designLayoutOptions) {
      if (isMobileDesignLayout(option.value)) {
        expect(catalog).not.toContain(`${option.value} (`);
      } else {
        expect(catalog).toContain(option.value);
      }
    }
  });

  it("lists every built-in preset key as a starting point", () => {
    for (const template of campaignDesignTemplates) {
      expect(catalog).toContain(template.templateKey);
    }
  });

  it("requires hex colors so the model returns valid values", () => {
    expect(catalog).toContain("#1A2B3C");
  });
});
