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
  designAlignmentOptions,
  designBannerAnimationOptions,
  designFontFamilyOptions,
  designIconOptions,
  designLayoutOptions,
  designPositionModeOptions,
  designTimerFormatOptions,
  designTimerStyleOptions,
  designTimerTickAnimationOptions,
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
      "INLINE",
      "CTA_RIGHT",
      "CTA_LEFT",
      "CTA_TOP",
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
    expect(designTimerTickAnimationOptions.map((option) => option.value)).toEqual(
      ["NONE", "FADE", "FLIP", "PULSE"],
    );
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
      "CUSTOM",
      "NONE",
    ]);

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
    expect(values.customCss).toBe(".banner { letter-spacing: 0; }");
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
});
