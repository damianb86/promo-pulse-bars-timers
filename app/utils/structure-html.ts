// Security sanitization for campaign structural HTML + CSS.
//
// The structural HTML is produced by app/utils/campaign-structure.ts and may be
// hand-edited by merchants in the design editor's HTML modal. Before it is
// stored or rendered it must be sanitized to a safe allowlist: only structural
// tags, only safe class / data-cp-slot / href attributes, no scripts, no inline
// event handlers, no inline styles, no iframes, no javascript: URLs.
//
// Implementation reuses the allowlist parser/serializer in campaign-structure.ts
// (htmlToTree already drops disallowed tags and keeps only class/slot/href), and
// adds URL-scheme validation on top. A mirrored JS validator lives in the theme
// extension (campaign-surface.js) as defense in depth when unpacking.

import {
  htmlToTree,
  treeToHtml,
  type StructureNode,
  type TreeToHtmlOptions,
} from "./campaign-structure";

const SAFE_HREF = /^(https?:\/\/|\/|#|mailto:)/i;

function sanitizeNode(current: StructureNode): StructureNode {
  const result: StructureNode = { tag: current.tag };
  if (current.cls && current.cls.length) result.cls = current.cls;
  if (current.slot) result.slot = current.slot;
  if (current.text != null) result.text = current.text;
  if (current.href != null && current.tag === "a") {
    const href = String(current.href).trim();
    // Drop any URL whose scheme is not explicitly safe (blocks javascript:,
    // data:, vbscript:, etc.).
    if (SAFE_HREF.test(href)) result.href = href;
  }
  if (current.children && current.children.length) {
    result.children = current.children.map(sanitizeNode);
  }
  return result;
}

/**
 * Sanitize arbitrary structural HTML to the safe allowlist. Returns clean HTML,
 * or "" when the input has no usable structure.
 */
export function sanitizeStructureHtml(
  input: unknown,
  options: TreeToHtmlOptions = {},
): string {
  if (typeof input !== "string" || input.trim().length === 0) return "";
  const tree = htmlToTree(input);
  if (!tree) return "";
  return treeToHtml(sanitizeNode(tree), options);
}

/**
 * Parse + sanitize structural HTML into a tree (or null). Useful when the caller
 * needs to pack the tree rather than re-serialize it.
 */
export function parseSafeStructureTree(input: unknown): StructureNode | null {
  if (typeof input !== "string" || input.trim().length === 0) return null;
  const tree = htmlToTree(input);
  if (!tree) return null;
  return sanitizeNode(tree);
}

/**
 * Sanitize the per-campaign CSS string. The `--cp-*` variable block is generated
 * by us and trusted; merchant custom CSS is appended and must be stripped of
 * dangerous constructs. This mirrors sanitizeCustomCss (app/utils/campaign-design.ts)
 * but operates on the already-assembled structure CSS (no plan gating here —
 * gating happens upstream when customCss is captured).
 */
export function sanitizeStructureCss(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) return "";
  return input
    .replace(/<\/?\s*style[^>]*>/gi, "")
    .replace(/@import[^;]+;/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(\s*(?:'|")?\s*(?:javascript|data|vbscript):[^)]*\)/gi, "")
    .replace(/javascript:/gi, "")
    .slice(0, 8000);
}
