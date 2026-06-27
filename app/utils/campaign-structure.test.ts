import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_STRUCTURE_VERSION,
  STRUCTURE_CSS_SCOPE_TOKEN,
  buildCampaignStructureTree,
  buildStructureCss,
  htmlToTree,
  packTree,
  toLongClass,
  toShortClass,
  treeToHtml,
  unpackTree,
  type StructureBuildSpec,
} from "./campaign-structure";

const baseSpec: StructureBuildSpec = {
  variant: "bar",
  placement: "TOP_BAR",
  layout: "STANDARD",
  fullWidth: false,
  positionMode: "FLOW",
  floatPosition: "FIXED",
  entranceAnimation: "FADE",
  exitAnimation: "FADE",
  hasIcon: true,
  hasInlineTimer: false,
  hasBlockTimer: true,
  hasBody: true,
  hasOffer: true,
  hasCta: true,
  ctaIsLink: false,
  hasClose: true,
  hasProgress: false,
  hasBadgeTimer: false,
};

describe("class aliasing", () => {
  it("round-trips long <-> short class names", () => {
    expect(toShortClass("counterpulse-preview-promo")).toBe("cp-promo");
    expect(toLongClass("cp-promo")).toBe("counterpulse-preview-promo");
    expect(toLongClass(toShortClass("counterpulse-preview-message-copy"))).toBe(
      "counterpulse-preview-message-copy",
    );
  });

  it("leaves unknown classes untouched", () => {
    expect(toShortClass("foo-bar")).toBe("foo-bar");
    expect(toLongClass("foo-bar")).toBe("foo-bar");
  });
});

describe("buildCampaignStructureTree", () => {
  it("builds the bar structure with slots", () => {
    const tree = buildCampaignStructureTree(baseSpec);
    expect(tree.tag).toBe("section");
    expect(tree.cls).toContain("counterpulse-preview-promo");
    expect(tree.cls).toContain("counterpulse-preview-promo--layout-standard");

    const html = treeToHtml(tree);
    expect(html).toContain('data-cp-slot="headline"');
    expect(html).toContain('data-cp-slot="icon"');
    expect(html).toContain('data-cp-slot="timer"');
    expect(html).toContain('data-cp-slot="offer"');
    expect(html).toContain('data-cp-slot="cta"');
    expect(html).toContain('data-cp-slot="close"');
    expect(html).toContain('class="cp-promo');
    // No inline styles in the structural HTML.
    expect(html).not.toContain("style=");
  });

  it("uses an inline timer slot for INLINE layout and omits the body", () => {
    const tree = buildCampaignStructureTree({
      ...baseSpec,
      layout: "INLINE",
      hasInlineTimer: true,
      hasBlockTimer: false,
    });
    const html = treeToHtml(tree);
    expect(html).toContain('data-cp-slot="timer-inline"');
    expect(html).not.toContain('data-cp-slot="body"');
    expect(html).not.toContain('data-cp-slot="timer"');
  });

  it("renders the cta as an anchor when ctaIsLink", () => {
    const tree = buildCampaignStructureTree({ ...baseSpec, ctaIsLink: true });
    const html = treeToHtml(tree);
    expect(html).toContain('<a data-cp-slot="cta"></a>');
  });

  it("builds a badge structure", () => {
    const tree = buildCampaignStructureTree({
      ...baseSpec,
      variant: "badge",
      badgeShape: "PILL",
      badgePosition: "TOP_RIGHT",
      hasBadgeTimer: true,
    });
    expect(tree.tag).toBe("div");
    expect(tree.cls).toContain("counterpulse-preview-badge--pill");
    const html = treeToHtml(tree);
    expect(html).toContain('data-cp-slot="badge-text"');
    expect(html).toContain('data-cp-slot="badge-timer"');
  });
});

describe("html <-> tree round-trip", () => {
  it("parses back the serialized html into an equivalent tree", () => {
    const tree = buildCampaignStructureTree(baseSpec);
    const html = treeToHtml(tree);
    const parsed = htmlToTree(html);
    expect(parsed).not.toBeNull();
    // Re-serialize and compare to ensure structural equivalence.
    expect(treeToHtml(parsed!)).toBe(html);
  });

  it("drops disallowed tags and attributes", () => {
    const dirty =
      '<section class="cp-promo"><script>alert(1)</script>' +
      '<div data-cp-slot="headline" onclick="x()">hi</div></section>';
    const parsed = htmlToTree(dirty);
    const html = treeToHtml(parsed!);
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).toContain('data-cp-slot="headline"');
  });
});

describe("pack <-> unpack round-trip", () => {
  it("packs and unpacks to an equivalent tree", () => {
    const tree = buildCampaignStructureTree(baseSpec);
    const packed = packTree(tree);
    expect(packed.v).toBe(CAMPAIGN_STRUCTURE_VERSION);
    expect(Array.isArray(packed.t)).toBe(true);
    expect(Array.isArray(packed.c)).toBe(true);

    const restored = unpackTree(packed);
    expect(treeToHtml(restored)).toBe(treeToHtml(tree));
  });

  it("dictionary-packs repeated classes once", () => {
    const tree = buildCampaignStructureTree(baseSpec);
    const packed = packTree(tree);
    // No duplicate class tokens in the dictionary.
    expect(new Set(packed.c).size).toBe(packed.c.length);
  });

  it("produces a smaller payload than the raw html", () => {
    const tree = buildCampaignStructureTree(baseSpec);
    const html = treeToHtml(tree, { pretty: false });
    const packed = JSON.stringify(packTree(tree));
    expect(packed.length).toBeLessThan(html.length * 1.5);
  });
});

describe("buildStructureCss", () => {
  it("emits scoped css variables and appends sanitized custom css", () => {
    const css = buildStructureCss({
      backgroundColor: "#111827",
      textColor: "#FFFFFF",
      contentMaxWidth: 600,
      customCss: ".x { color: red; }</style><script>bad()</script>",
    });
    expect(css).toContain(STRUCTURE_CSS_SCOPE_TOKEN);
    expect(css).toContain("--cp-bg: #111827;");
    expect(css).toContain("--cp-content-max-width: 600px;");
    expect(css).toContain(".x { color: red; }");
    expect(css).not.toContain("</style>");
  });
});
