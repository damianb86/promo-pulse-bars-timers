import { describe, expect, it } from "vitest";

import { hasBasicHtml, sanitizeBasicHtml } from "./basic-html";

describe("sanitizeBasicHtml", () => {
  it("keeps allowed inline formatting tags", () => {
    expect(sanitizeBasicHtml("Save <strong>50%</strong> today")).toBe(
      "Save <strong>50%</strong> today",
    );
    expect(sanitizeBasicHtml("Ends <mark>tonight</mark><br>hurry")).toBe(
      "Ends <mark>tonight</mark><br>hurry",
    );
  });

  it("keeps a sanitized class on span and drops other attributes", () => {
    expect(sanitizeBasicHtml('<span class="hot-deal">Deal</span>')).toBe(
      '<span class="hot-deal">Deal</span>',
    );
    expect(
      sanitizeBasicHtml('<strong style="color:red" onclick="x()">Hi</strong>'),
    ).toBe("<strong>Hi</strong>");
    // Dangerous attributes never survive as real attributes — only the class
    // value is kept (here folded to harmless tokens).
    const out = sanitizeBasicHtml(
      '<span class="deal" onload="alert(1)">x</span>',
    );
    expect(out).toBe('<span class="deal">x</span>');
    expect(out).not.toContain("onload=");
  });

  it("drops disallowed tags but keeps their escaped text", () => {
    expect(sanitizeBasicHtml('<script>alert("x")</script>')).toBe('alert("x")');
    expect(sanitizeBasicHtml('<img src=x onerror="alert(1)">hi')).toBe("hi");
    expect(sanitizeBasicHtml('<a href="https://evil">link</a>')).toBe("link");
  });

  it("escapes stray angle brackets and ampersands", () => {
    expect(sanitizeBasicHtml("a < b && c > d")).toBe(
      "a &lt; b &amp;&amp; c &gt; d",
    );
    expect(sanitizeBasicHtml("price <")).toBe("price &lt;");
  });

  it("ignores empty / non-string input", () => {
    expect(sanitizeBasicHtml("")).toBe("");
    expect(sanitizeBasicHtml(null)).toBe("");
    expect(sanitizeBasicHtml(undefined)).toBe("");
    expect(sanitizeBasicHtml(42)).toBe("");
  });

  it("normalizes self-closing and uppercase tags", () => {
    expect(sanitizeBasicHtml("line<BR/>break")).toBe("line<br>break");
    expect(sanitizeBasicHtml("<EM>x</EM>")).toBe("<em>x</em>");
  });

  it("detects whether a string carries markup", () => {
    expect(hasBasicHtml("<b>x</b>")).toBe(true);
    expect(hasBasicHtml("plain text")).toBe(false);
    expect(hasBasicHtml(123)).toBe(false);
  });
});
