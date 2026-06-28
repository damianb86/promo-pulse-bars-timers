// Security sanitization for campaign structural HTML + CSS.
//
// The structural HTML the merchant (or the AI) writes IS the campaign — it is the
// single source of truth for rendering. So the sanitizer's job is to preserve
// everything that is safe (any allowed tag, ids, classes, data-*, text, images,
// attributes, order) and only strip what is dangerous (scripts, event handlers,
// unknown/unsafe tags, javascript:/data: URLs, dangerous CSS). It never reorders
// or rewrites safe content.
//
// A mirrored JS validator lives in the theme extension (campaign-surface.js) as
// defense in depth when unpacking.

import {
  htmlToTree,
  treeToHtml,
  TEXT_TAG,
  type StructureNode,
  type TreeToHtmlOptions,
} from "./campaign-structure";

// Tags the merchant may use. Anything outside this list (script, style, iframe,
// object, embed, link, meta, form, input, ...) is dropped.
const ALLOWED_TAGS = new Set([
  "div", "span", "section", "article", "aside", "header", "footer", "main",
  "nav", "p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i",
  "u", "s", "small", "mark", "sup", "sub", "br", "hr", "a", "button", "img",
  "picture", "source", "figure", "figcaption", "blockquote", "code", "pre",
  "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tfoot",
  "tr", "th", "td", "caption", "label", "time", "address",
  // Inline SVG (used by icons and allowed for custom marks).
  "svg", "path", "circle", "line", "rect", "polygon", "polyline", "ellipse",
  "g", "defs", "use", "title",
]);

// Attributes allowed on any element.
const GLOBAL_ATTRS = new Set([
  "class", "id", "title", "role", "dir", "lang", "tabindex", "hidden",
  "data-cp-slot",
]);

// Attributes allowed only on specific tags.
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading", "srcset", "sizes"]),
  source: new Set(["src", "srcset", "type", "media", "sizes"]),
  button: new Set(["type", "disabled"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  td: new Set(["colspan", "rowspan"]),
  time: new Set(["datetime"]),
  ol: new Set(["start", "reversed", "type"]),
  label: new Set(["for"]),
};

// SVG presentation/geometry attributes (allowed on svg + its children).
const SVG_TAGS = new Set([
  "svg", "path", "circle", "line", "rect", "polygon", "polyline", "ellipse",
  "g", "defs", "use", "title",
]);
const SVG_ATTRS = new Set([
  "viewbox", "fill", "stroke", "stroke-width", "stroke-linecap",
  "stroke-linejoin", "stroke-dasharray", "d", "cx", "cy", "r", "rx", "ry",
  "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points", "transform",
  "focusable", "xmlns", "preserveaspectratio", "opacity", "fill-rule",
  "clip-rule", "offset",
]);

const URL_ATTRS = new Set(["href", "src"]);
const SAFE_URL = /^(https?:\/\/|\/|#|mailto:|tel:)/i;
// Internal asset placeholder kept through sanitization; the pipeline replaces it
// with the uploaded Shopify URL before render.
const ASSET_PLACEHOLDER = /^\{\{asset:[a-zA-Z0-9_-]+\}\}$/;

function isAttrAllowed(tag: string, name: string): boolean {
  if (GLOBAL_ATTRS.has(name)) return true;
  if (name.startsWith("data-") || name.startsWith("aria-")) return true;
  if (TAG_ATTRS[tag]?.has(name)) return true;
  if (SVG_TAGS.has(tag) && SVG_ATTRS.has(name)) return true;
  return false;
}

function sanitizeStyleValue(value: string): string | null {
  const cleaned = value
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(\s*(?:'|")?\s*(?:javascript|data|vbscript):[^)]*\)/gi, "")
    .replace(/javascript:/gi, "");
  return cleaned.trim() ? cleaned : null;
}

function sanitizeAttrs(
  tag: string,
  attrs: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!attrs) return undefined;
  const result: Record<string, string> = {};
  for (const name of Object.keys(attrs)) {
    const lower = name.toLowerCase();
    // Never allow inline event handlers.
    if (lower.startsWith("on")) continue;

    if (lower === "style") {
      const safe = sanitizeStyleValue(attrs[name]);
      if (safe) result.style = safe;
      continue;
    }

    if (!isAttrAllowed(tag, lower)) continue;

    if (URL_ATTRS.has(lower)) {
      const url = attrs[name].trim();
      if (!SAFE_URL.test(url) && !ASSET_PLACEHOLDER.test(url)) continue;
      result[lower] = url;
      continue;
    }

    result[lower] = attrs[name];
  }
  return Object.keys(result).length ? result : undefined;
}

function sanitizeNode(node: StructureNode): StructureNode | null {
  if (node.tag === TEXT_TAG) {
    return node.text ? { tag: TEXT_TAG, text: node.text } : null;
  }
  if (!ALLOWED_TAGS.has(node.tag)) return null;

  const result: StructureNode = { tag: node.tag };
  const attrs = sanitizeAttrs(node.tag, node.attrs);
  if (attrs) result.attrs = attrs;

  // Drop <img> with no src so an AI-emitted empty <img> (whose asset was never
  // produced/referenced) never renders broken. A valid {{asset:...}} placeholder
  // counts as a src and is kept (the pipeline resolves it later).
  if (node.tag === "img" && !(attrs?.src ?? "")) {
    return null;
  }

  if (node.children && node.children.length) {
    const children = node.children
      .map(sanitizeNode)
      .filter((child): child is StructureNode => child !== null);
    if (children.length) result.children = children;
  }
  return result;
}

/**
 * Sanitize arbitrary structural HTML to the safe allowlist, preserving all safe
 * tags, attributes, text, and order. Returns clean HTML, or "" when there is no
 * usable structure.
 */
export function sanitizeStructureHtml(
  input: unknown,
  options: TreeToHtmlOptions = {},
): string {
  const tree = parseSafeStructureTree(input);
  if (!tree) return "";
  return treeToHtml(tree, options);
}

/**
 * Parse + sanitize structural HTML into a faithful tree (or null).
 */
export function parseSafeStructureTree(input: unknown): StructureNode | null {
  if (typeof input !== "string" || input.trim().length === 0) return null;
  const tree = htmlToTree(input);
  if (!tree) return null;
  return sanitizeNode(tree);
}

/**
 * Sanitize the per-campaign CSS string (scoped vars + merchant CSS). Strips
 * dangerous constructs while leaving ordinary styles intact.
 */
export function sanitizeStructureCss(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) return "";
  return input
    .replace(/<\/?\s*style[^>]*>/gi, "")
    .replace(/@import[^;]+;/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(\s*(?:'|")?\s*(?:javascript|data|vbscript):[^)]*\)/gi, "")
    .replace(/javascript:/gi, "")
    .slice(0, 20000);
}
