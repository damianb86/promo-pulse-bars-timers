// Helpers for generating + encoding a campaign's structural HTML/CSS.
//
// Storage strategy:
//  - The structural AST is dictionary-packed (campaign-structure.ts packTree) and
//    stored as a compact JSON string in `structureCompact`. The dictionary pack
//    is the "compact AST"; it stays isomorphic (no gzip dependency) so the same
//    encode/decode works on the server and is safe to import from storefront
//    bundles. HTTP-level gzip covers the wire when the API response is sent.
//  - The per-campaign CSS (scoped `--cp-*` vars + sanitized custom CSS) is stored
//    as plain text in `structureCss`.

import {
  buildCampaignStructureTree,
  buildStructureCss,
  deriveCampaignStructureSpec,
  encodePackedStructure,
  packTree,
  scopeCustomCss,
  type StructureSpecDesign,
  type StructureSpecViewModel,
  type StyleDesignInput,
} from "./campaign-structure";
import { parseSafeStructureTree } from "./structure-html";

export type GeneratedStructure = {
  compact: string;
  css: string;
};

// Auto-generates a campaign's structural HTML (packed) + CSS from its settings.
// Used at save time when the merchant has NOT hand-edited the HTML, so the
// structure stays a faithful, regenerated mirror of the visual editor.
export function generateStructureFromSettings(
  viewModel: StructureSpecViewModel,
  design: StructureSpecDesign & StyleDesignInput,
): GeneratedStructure {
  const spec = deriveCampaignStructureSpec(viewModel, design);
  const tree = buildCampaignStructureTree(spec);
  return {
    compact: encodePackedStructure(packTree(tree)),
    css: buildStructureCss(design),
  };
}

// Builds the stored structure from hand-edited (already sanitized) HTML and an
// optional hand-edited CSS override. When no CSS override is given the CSS is
// regenerated from the visual settings.
export function generateStructureFromHtml(
  html: string,
  design: StyleDesignInput,
  cssOverride?: string | null,
): GeneratedStructure | null {
  const tree = parseSafeStructureTree(html);
  if (!tree) return null;
  // Auto-scope the hand-edited/AI CSS so plain selectors (`.cp-promo {}`) only
  // affect this campaign — the `__CP_SCOPE__` token is optional (already-scoped
  // selectors pass through untouched).
  const css =
    typeof cssOverride === "string" && cssOverride.trim()
      ? scopeCustomCss(cssOverride)
      : buildStructureCss(design);
  return {
    compact: encodePackedStructure(packTree(tree)),
    css,
  };
}
