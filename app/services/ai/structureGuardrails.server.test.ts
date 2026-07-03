import { describe, expect, it } from "vitest";

import {
  enforceAiStructureQuality,
  enforceReadableAiColors,
  sanitizeAiStructureCss,
} from "./structureGuardrails.server";

const VALID_COUNTDOWN_STRUCTURE =
  '<section class="cp-promo">' +
  '<strong data-cp-slot="headline"></strong>' +
  '<span data-cp-slot="body"></span>' +
  '<div data-cp-slot="timer"></div>' +
  "</section>";

describe("enforceAiStructureQuality", () => {
  it("keeps a valid countdown structure and its CSS", () => {
    const result = enforceAiStructureQuality(
      VALID_COUNTDOWN_STRUCTURE,
      "__CP_SCOPE__ .cp-promo{color:#fff}",
      "COUNTDOWN_BAR",
    );

    expect(result.structureHtml).toContain('data-cp-slot="timer"');
    expect(result.structureCss).toContain("color:#fff");
    expect(result.warnings).toEqual([]);
  });

  it("returns empty output without warnings when the AI sent no structure", () => {
    const result = enforceAiStructureQuality("", "css", "COUNTDOWN_BAR");

    expect(result).toEqual({
      structureHtml: "",
      structureCss: "",
      warnings: [],
    });
  });

  it("discards a countdown structure without a timer slot", () => {
    const result = enforceAiStructureQuality(
      '<section class="cp-promo"><strong data-cp-slot="headline"></strong></section>',
      "",
      "COUNTDOWN_BAR",
    );

    expect(result.structureHtml).toBe("");
    expect(result.warnings[0]).toContain("countdown timer slot");
  });

  it("accepts timer-part slots as the countdown timer", () => {
    const result = enforceAiStructureQuality(
      '<section class="cp-promo"><strong data-cp-slot="headline"></strong>' +
        '<span data-cp-slot="timer-minutes"></span>:' +
        '<span data-cp-slot="timer-seconds"></span></section>',
      "",
      "PRODUCT_TIMER",
    );

    expect(result.structureHtml).toContain("timer-minutes");
    expect(result.warnings).toEqual([]);
  });

  it("discards a free shipping structure without a progress slot", () => {
    const result = enforceAiStructureQuality(
      '<section class="cp-promo"><strong data-cp-slot="headline"></strong></section>',
      "",
      "FREE_SHIPPING_GOAL",
    );

    expect(result.structureHtml).toBe("");
    expect(result.warnings[0]).toContain("progress");
  });

  it("discards a structure without headline or body slots", () => {
    const result = enforceAiStructureQuality(
      '<section class="cp-promo"><div data-cp-slot="timer"></div></section>',
      "",
      "COUNTDOWN_BAR",
    );

    expect(result.structureHtml).toBe("");
    expect(result.warnings[0]).toContain("headline/body");
  });

  it("discards a structure with duplicated dynamic slots", () => {
    const result = enforceAiStructureQuality(
      '<section class="cp-promo"><strong data-cp-slot="headline"></strong>' +
        '<div data-cp-slot="timer"></div><div data-cp-slot="timer"></div></section>',
      "",
      "COUNTDOWN_BAR",
    );

    expect(result.structureHtml).toBe("");
    expect(result.warnings[0]).toContain("repeated");
  });

  it("discards a pathologically large structure", () => {
    const html =
      '<section class="cp-promo"><strong data-cp-slot="headline"></strong>' +
      "<span>x</span>".repeat(400) +
      "</section>";

    const result = enforceAiStructureQuality(html, "", "LOW_STOCK");

    expect(result.structureHtml).toBe("");
    expect(result.warnings[0]).toContain("too large");
  });

  it("does not require a timer slot for non-timer campaign types", () => {
    const result = enforceAiStructureQuality(
      '<section class="cp-promo"><strong data-cp-slot="headline"></strong></section>',
      "",
      "LOW_STOCK",
    );

    expect(result.structureHtml).toContain("headline");
    expect(result.warnings).toEqual([]);
  });
});

describe("sanitizeAiStructureCss", () => {
  it("strips viewport-pinning and page-covering declarations", () => {
    const css = sanitizeAiStructureCss(
      "__CP_SCOPE__ .cp-promo{position:fixed;z-index:99999;width:100vw;color:#fff}" +
        "__CP_SCOPE__ .cp-actions{position:sticky;min-height:100vh;padding:8px}",
    );

    expect(css).not.toContain("fixed");
    expect(css).not.toContain("sticky");
    expect(css).not.toContain("99999");
    expect(css).not.toContain("100vw");
    expect(css).not.toContain("100vh");
    expect(css).toContain("color:#fff");
    expect(css).toContain("padding:8px");
  });

  it("keeps small z-index values and ordinary sizing", () => {
    const css = sanitizeAiStructureCss(
      "__CP_SCOPE__ .cp-promo{z-index:10;width:320px;height:2rem}",
    );

    expect(css).toContain("z-index:10");
    expect(css).toContain("width:320px");
    expect(css).toContain("height:2rem");
  });
});

describe("enforceReadableAiColors", () => {
  it("replaces unreadable text on a solid background with black or white", () => {
    const fixed = enforceReadableAiColors({
      backgroundType: "SOLID",
      backgroundColor: "#f5f5f5",
      textColor: "#ffffff",
      titleColor: "#eeeeee",
    });

    expect(fixed.textColor).toBe("#111111");
    expect(fixed.titleColor).toBe("#111111");
  });

  it("keeps readable colors untouched", () => {
    const design = {
      backgroundType: "SOLID",
      backgroundColor: "#111827",
      textColor: "#ffffff",
      buttonColor: "#f59e0b",
      buttonTextColor: "#111827",
    };

    expect(enforceReadableAiColors(design)).toEqual(design);
  });

  it("fixes unreadable button text against the button color", () => {
    const fixed = enforceReadableAiColors({
      buttonColor: "#fde047",
      buttonTextColor: "#ffffff",
    });

    expect(fixed.buttonTextColor).toBe("#111111");
  });

  it("leaves gradient and image backgrounds alone", () => {
    const design = {
      backgroundType: "GRADIENT",
      backgroundColor: "#ffffff",
      textColor: "#ffffff",
    };

    expect(enforceReadableAiColors(design)).toEqual(design);
  });
});
