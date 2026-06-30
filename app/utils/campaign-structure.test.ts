import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_STRUCTURE_VERSION,
  STRUCTURE_CSS_SCOPE_TOKEN,
  buildCampaignStructureTree,
  buildStructureCss,
  getNodeAtPath,
  getNodeSlot,
  htmlToTree,
  packTree,
  parseStyle,
  serializeStyle,
  setNodeStyleAtPath,
  TIMER_PART_SLOTS,
  timerPartValue,
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

describe("node addressing + inline style helpers", () => {
  const html =
    '<section class="cp-promo"><div class="cp-left">' +
    '<strong data-cp-slot="headline"></strong></div>' +
    '<img src="/x.png" alt="a"></section>';

  it("getNodeAtPath walks child indices", () => {
    const tree = htmlToTree(html)!;
    expect(getNodeAtPath(tree, "")?.tag).toBe("section");
    expect(getNodeAtPath(tree, "0")?.attrs?.class).toBe("cp-left");
    expect(getNodeAtPath(tree, "0-0")?.attrs?.["data-cp-slot"]).toBe("headline");
    expect(getNodeAtPath(tree, "1")?.tag).toBe("img");
    expect(getNodeAtPath(tree, "9")).toBeNull();
  });

  it("parseStyle / serializeStyle round-trip", () => {
    const parsed = parseStyle("min-width: 100px; max-height: 40px");
    expect(parsed).toEqual({ "min-width": "100px", "max-height": "40px" });
    expect(serializeStyle(parsed)).toBe("min-width: 100px; max-height: 40px");
  });

  it("setNodeStyleAtPath merges + removes declarations immutably", () => {
    const tree = htmlToTree(html)!;
    const next = setNodeStyleAtPath(tree, "0", {
      "min-width": "120px",
      "max-width": "300px",
    });
    // Original untouched.
    expect(getNodeAtPath(tree, "0")?.attrs?.style).toBeUndefined();
    expect(getNodeAtPath(next, "0")?.attrs?.style).toBe(
      "min-width: 120px; max-width: 300px",
    );
    // Removing a declaration drops it (and style when empty).
    const cleared = setNodeStyleAtPath(next, "0", {
      "min-width": "",
      "max-width": "",
    });
    expect(getNodeAtPath(cleared, "0")?.attrs?.style).toBeUndefined();
    // The class attribute is preserved.
    expect(getNodeAtPath(cleared, "0")?.attrs?.class).toBe("cp-left");
  });

  it("setNodeStyleAtPath output round-trips through treeToHtml", () => {
    const tree = htmlToTree(html)!;
    const next = setNodeStyleAtPath(tree, "1", { "max-width": "100%" });
    expect(treeToHtml(next)).toContain('style="max-width: 100%"');
  });
});

describe("timerPartValue", () => {
  // 1 day, 2 hours, 3 minutes, 4 seconds in ms.
  const ms = ((1 * 24 + 2) * 3600 + 3 * 60 + 4) * 1000;

  it("computes zero-padded countdown parts", () => {
    expect(timerPartValue("days", ms)).toBe("1");
    expect(timerPartValue("hours", ms)).toBe("02");
    expect(timerPartValue("minutes", ms)).toBe("03");
    expect(timerPartValue("seconds", ms)).toBe("04");
  });

  it("clamps negative remaining time to zero", () => {
    expect(timerPartValue("hours", -5000)).toBe("00");
    expect(timerPartValue("days", -5000)).toBe("0");
  });

  it("maps the timer-part slots to their part", () => {
    expect(TIMER_PART_SLOTS["timer-days"]).toBe("days");
    expect(TIMER_PART_SLOTS["timer-seconds"]).toBe("seconds");
  });
});
