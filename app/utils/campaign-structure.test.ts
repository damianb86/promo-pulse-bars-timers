import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_STRUCTURE_VERSION,
  STRUCTURE_CSS_SCOPE_TOKEN,
  buildCampaignStructureTree,
  buildStructureCss,
  getNodeSlot,
  htmlToTree,
  packTree,
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

describe("buildCampaignStructureTree", () => {
  it("builds the bar structure with slots and no inline styles", () => {
    const tree = buildCampaignStructureTree(baseSpec);
    expect(tree.tag).toBe("section");
    expect(tree.attrs?.class).toContain("counterpulse-preview-promo");

    const html = treeToHtml(tree);
    expect(html).toContain('data-cp-slot="headline"');
    expect(html).toContain('data-cp-slot="icon"');
    expect(html).toContain('data-cp-slot="timer"');
    expect(html).toContain('data-cp-slot="offer"');
    expect(html).toContain('data-cp-slot="cta"');
    expect(html).toContain('data-cp-slot="close"');
    expect(html).not.toContain("style=");
  });
});

describe("faithful html <-> tree round-trip", () => {
  it("preserves arbitrary tags, attributes, ids, text and order", () => {
    const html =
      '<div class="promo" id="hero" data-x="1">' +
      '<img src="/image.png" alt="Sale">' +
      "<h1>Summer Sale</h1>" +
      "<button>Buy Now</button>" +
      "</div>";
    const tree = htmlToTree(html);
    expect(tree).not.toBeNull();

    // Structure is preserved: tags, order, attributes, text.
    expect(tree!.tag).toBe("div");
    expect(tree!.attrs).toEqual({ class: "promo", id: "hero", "data-x": "1" });
    const children = tree!.children!;
    expect(children.map((c) => c.tag)).toEqual(["img", "h1", "button"]);
    expect(children[0].attrs).toEqual({ src: "/image.png", alt: "Sale" });
    expect(children[1].children![0].text).toBe("Summer Sale");
    expect(children[2].children![0].text).toBe("Buy Now");

    // Re-serializing and re-parsing is stable (idempotent).
    const serialized = treeToHtml(tree!);
    expect(treeToHtml(htmlToTree(serialized)!)).toBe(serialized);
  });

  it("wraps multiple top-level nodes so none are dropped", () => {
    const tree = htmlToTree("<h1>A</h1><p>B</p>");
    expect(tree).not.toBeNull();
    expect(tree!.children!.map((c) => c.tag)).toEqual(["h1", "p"]);
  });

  it("exposes the data-cp-slot marker via getNodeSlot", () => {
    const tree = htmlToTree('<div data-cp-slot="timer"></div>');
    expect(getNodeSlot(tree!)).toBe("timer");
  });
});

describe("pack <-> unpack is fully reversible", () => {
  it("round-trips a faithful tree without losing anything", () => {
    const html =
      '<section class="promo"><img src="/x.png" alt="a">' +
      '<ul><li data-i="1">One</li><li>Two</li></ul>' +
      '<a href="https://x.com">Go</a></section>';
    const tree = htmlToTree(html)!;
    const packed = packTree(tree);
    expect(packed.v).toBe(CAMPAIGN_STRUCTURE_VERSION);

    const restored = unpackTree(packed);
    // Deep structural equality and identical serialization.
    expect(restored).toEqual(tree);
    expect(treeToHtml(restored)).toBe(treeToHtml(tree));
  });

  it("dictionary-packs repeated tag and attribute names once", () => {
    const tree = htmlToTree(
      "<ul><li>a</li><li>b</li><li>c</li></ul>",
    )!;
    const packed = packTree(tree);
    expect(packed.t).toContain("li");
    expect(new Set(packed.t).size).toBe(packed.t.length);
    expect(new Set(packed.a).size).toBe(packed.a.length);
  });
});

describe("buildStructureCss", () => {
  it("emits scoped css variables and appends sanitized custom css", () => {
    const css = buildStructureCss({
      backgroundColor: "#111827",
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
