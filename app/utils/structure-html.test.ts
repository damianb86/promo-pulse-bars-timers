import { describe, expect, it } from "vitest";

import {
  parseSafeStructureTree,
  sanitizeStructureCss,
  sanitizeStructureHtml,
} from "./structure-html";

describe("sanitizeStructureHtml", () => {
  it("keeps structural tags, classes and slots", () => {
    const html = sanitizeStructureHtml(
      '<section class="cp-promo"><div data-cp-slot="headline">Hi</div></section>',
    );
    expect(html).toContain('class="cp-promo"');
    expect(html).toContain('data-cp-slot="headline"');
    expect(html).toContain("Hi");
  });

  it("drops scripts, iframes and event handlers", () => {
    const html = sanitizeStructureHtml(
      '<section onclick="x()"><script>alert(1)</script>' +
        '<iframe src="evil"></iframe><span>ok</span></section>',
    );
    expect(html).not.toMatch(/script|iframe|onclick/i);
    expect(html).toContain("ok");
  });

  it("strips unsafe href schemes but keeps safe links", () => {
    const safe = sanitizeStructureHtml('<a href="https://x.com">go</a>');
    expect(safe).toContain('href="https://x.com"');

    const unsafe = sanitizeStructureHtml('<a href="javascript:alert(1)">x</a>');
    expect(unsafe).not.toContain("javascript:");
    expect(unsafe).not.toContain("href=");
  });

  it("returns empty for blank input", () => {
    expect(sanitizeStructureHtml("")).toBe("");
    expect(sanitizeStructureHtml(null)).toBe("");
  });

  it("parseSafeStructureTree returns a sanitized tree", () => {
    const tree = parseSafeStructureTree(
      '<section class="cp-promo"><a href="javascript:bad()">x</a></section>',
    );
    expect(tree).not.toBeNull();
    expect(tree!.children?.[0].href).toBeUndefined();
  });
});

describe("sanitizeStructureCss", () => {
  it("strips style tags, imports and dangerous urls", () => {
    const css = sanitizeStructureCss(
      "__CP_SCOPE__{--cp-bg:#111}</style>@import url(x);" +
        ".y{background:url(javascript:bad())}",
    );
    expect(css).not.toContain("</style>");
    expect(css).not.toContain("@import");
    expect(css).not.toContain("javascript:");
    expect(css).toContain("--cp-bg:#111");
  });
});
