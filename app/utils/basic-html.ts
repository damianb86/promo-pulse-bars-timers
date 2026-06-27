// Allowlist-based sanitizer for the small set of inline formatting tags that
// campaign message fields (headline, subheadline, CTA, etc.) may contain.
//
// It is intentionally isomorphic (no DOM) so it runs the same on the server
// (SSR), in the admin preview, and — mirrored in plain JS — on the storefront
// theme extension (see campaign-surface.js `sanitizeBasicHtml`).
//
// Security model: every tag is dropped unless its name is in the allowlist, and
// even then it is *re-emitted from scratch* with only a sanitized `class`
// attribute. No other attributes (no event handlers, no `style`, no `href`) and
// no other tags survive, so script/markup injection cannot pass through. All
// text between tags is HTML-escaped.

const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "br",
  "span",
  "small",
  "mark",
  "sup",
  "sub",
]);

// Tags that never have a closing tag / children.
const VOID_TAGS = new Set(["br"]);

export const basicHtmlAllowedTags = Array.from(ALLOWED_TAGS);

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Extract a safe `class="..."` attribute string (or "") from a raw tag's
// attribute section. Class tokens are restricted to harmless characters.
function safeClassAttr(rawAttrs: string): string {
  const match = /(?:^|\s)class\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(
    rawAttrs,
  );
  if (!match) return "";

  const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
  const cleaned = rawValue
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9_-]/g, ""))
    .filter(Boolean)
    .join(" ");

  return cleaned ? ` class="${cleaned}"` : "";
}

/**
 * Sanitize a string that may contain a small set of inline formatting tags,
 * returning HTML that is safe to inject via innerHTML / dangerouslySetInnerHTML.
 */
export function sanitizeBasicHtml(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) return "";

  let out = "";
  let index = 0;

  while (index < input.length) {
    const lt = input.indexOf("<", index);

    if (lt === -1) {
      out += escapeText(input.slice(index));
      break;
    }

    out += escapeText(input.slice(index, lt));

    // A "<" only starts a tag when immediately followed by a letter or "/".
    // Otherwise (e.g. "a < b") it is literal text.
    const next = input.charAt(lt + 1);
    if (next !== "/" && !/[a-zA-Z]/.test(next)) {
      out += "&lt;";
      index = lt + 1;
      continue;
    }

    const gt = input.indexOf(">", lt);
    if (gt === -1) {
      // Unterminated "<" — treat the rest as plain text.
      out += escapeText(input.slice(lt));
      break;
    }

    const rawTag = input.slice(lt + 1, gt);
    const parsed = /^(\/?)([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)\/?\s*$/.exec(rawTag);

    if (parsed) {
      const isClosing = parsed[1] === "/";
      const name = parsed[2].toLowerCase();

      if (ALLOWED_TAGS.has(name)) {
        if (isClosing) {
          if (!VOID_TAGS.has(name)) out += `</${name}>`;
        } else if (VOID_TAGS.has(name)) {
          out += `<${name}>`;
        } else {
          out += `<${name}${safeClassAttr(parsed[3])}>`;
        }
      }
      // Non-allowlisted tags (script, img, a, comments, etc.) are dropped
      // entirely; their inner text continues to be processed and escaped.
    }

    index = gt + 1;
  }

  return out;
}

/**
 * True when the value contains characters that would render differently as HTML
 * (i.e. it has any markup worth interpreting). Used to skip the HTML path for
 * plain text so existing behavior is unchanged.
 */
export function hasBasicHtml(value: unknown): boolean {
  return typeof value === "string" && /[<>&]/.test(value);
}
