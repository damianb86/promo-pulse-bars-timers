import { describe, expect, it } from "vitest";

import {
  decodePackedStructure,
  treeToHtml,
  unpackTree,
} from "./campaign-structure";
import {
  generateStructureFromHtml,
  generateStructureFromSettings,
} from "./campaign-structure.server";

const viewModel = {
  ctaText: "Shop now",
  ctaUrl: "https://example.com",
  timer: { mode: "FIXED_DATE" },
  offer: { canApply: true },
};

const design = {
  layout: "STANDARD",
  fullWidth: false,
  positionMode: "FLOW",
  floatPosition: "FIXED",
  entranceAnimation: "FADE",
  exitAnimation: "FADE",
  icon: "FIRE",
  showButton: true,
  showCloseButton: true,
  showProgressBar: true,
  showDiscountCode: true,
  showCopyCodeButton: true,
  showApplyDiscountButton: true,
  backgroundColor: "#111827",
  textColor: "#FFFFFF",
  customCss: ".x{color:red}",
};

describe("generateStructureFromSettings", () => {
  it("produces a decodable packed structure + scoped css", () => {
    const result = generateStructureFromSettings(viewModel, design);

    expect(result.css).toContain("--cp-bg: #111827;");
    expect(result.css).toContain(".x{color:red}");

    const packed = decodePackedStructure(result.compact);
    expect(packed).not.toBeNull();

    const html = treeToHtml(unpackTree(packed!));
    expect(html).toContain('data-cp-slot="headline"');
    expect(html).toContain('data-cp-slot="timer"');
    expect(html).toContain('data-cp-slot="offer"');
    expect(html).toContain('data-cp-slot="icon"');
    expect(html).not.toContain("style=");
  });
});

describe("generateStructureFromHtml", () => {
  it("packs sanitized hand-edited html and drops unsafe content", () => {
    const result = generateStructureFromHtml(
      '<section class="cp-promo"><script>bad()</script>' +
        '<div data-cp-slot="headline"></div></section>',
      design,
    );
    expect(result).not.toBeNull();

    const html = treeToHtml(unpackTree(decodePackedStructure(result!.compact)!));
    expect(html).not.toContain("script");
    expect(html).toContain('data-cp-slot="headline"');
  });

  it("returns null for empty html", () => {
    expect(generateStructureFromHtml("", design)).toBeNull();
  });
});
