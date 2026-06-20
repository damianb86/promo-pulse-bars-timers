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
      }),
    ).toMatchObject({
      backgroundColor: "Enter a valid 6-digit hex color.",
      fontSize: "Font size must be between 10 and 24.",
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
});
