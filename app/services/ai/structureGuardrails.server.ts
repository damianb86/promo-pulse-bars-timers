// Quality guardrails for AI-authored campaign structure and colors.
//
// Security sanitization (structure-html.ts) already guarantees the AI cannot
// inject unsafe markup or CSS. This module guards the *aesthetics*: an AI
// layout is only kept when it contains the slots the campaign needs to render
// completely; otherwise it is discarded so the save pipeline regenerates the
// standard structure from the visual settings, which always looks right.

import type { CampaignTypeValue } from "../../types/campaign-options";
import { getContrastRatio } from "../../utils/campaign-design";
import {
  getNodeSlot,
  TEXT_TAG,
  treeToHtml,
  type StructureNode,
} from "../../utils/campaign-structure";
import {
  parseSafeStructureTree,
  sanitizeStructureCss,
} from "../../utils/structure-html";

const MAX_STRUCTURE_NODES = 300;
const MAX_STRUCTURE_DEPTH = 20;

const TIMER_SLOTS = new Set([
  "timer",
  "timer-inline",
  "badge-timer",
  "timer-days",
  "timer-hours",
  "timer-minutes",
  "timer-seconds",
]);

// Slots that must not repeat: duplicated dynamic widgets (two timers, two
// progress bars, two close buttons) always read as broken.
const UNIQUE_SLOTS = new Set([
  "headline",
  "body",
  "cta",
  "icon",
  "timer",
  "timer-inline",
  "offer",
  "close",
  "progress",
  "badge-timer",
  "badge-text",
]);

const TIMER_CAMPAIGN_TYPES: ReadonlySet<CampaignTypeValue> = new Set([
  "COUNTDOWN_BAR",
  "PRODUCT_TIMER",
  "CART_TIMER",
]);

export type AiStructureResult = {
  structureHtml: string;
  structureCss: string;
  warnings: string[];
};

// Validates AI-authored structural HTML for the given campaign type. Returns
// the sanitized structure when usable, or empty strings (plus a warning) when
// the layout must fall back to the standard generated structure.
export function enforceAiStructureQuality(
  structureHtml: unknown,
  structureCss: unknown,
  campaignType: CampaignTypeValue,
): AiStructureResult {
  const discarded = (reason: string): AiStructureResult => ({
    structureHtml: "",
    structureCss: "",
    warnings: [
      `The AI layout was discarded (${reason}); the standard layout for this campaign type is used instead.`,
    ],
  });

  if (typeof structureHtml !== "string" || !structureHtml.trim()) {
    // No AI layout: CSS alone cannot apply, drop both silently.
    return { structureHtml: "", structureCss: "", warnings: [] };
  }

  const tree = parseSafeStructureTree(structureHtml);
  if (!tree) return discarded("it contained no usable markup");

  const stats = collectStructureStats(tree);
  if (stats.nodeCount > MAX_STRUCTURE_NODES) {
    return discarded("it was too large");
  }
  if (stats.depth > MAX_STRUCTURE_DEPTH) {
    return discarded("it was nested too deeply");
  }
  if (stats.duplicatedSlots.length) {
    return discarded(
      `it repeated the ${stats.duplicatedSlots.join(", ")} slot`,
    );
  }
  if (!stats.slots.has("headline") && !stats.slots.has("body")) {
    return discarded("it was missing the headline/body text slots");
  }
  if (
    TIMER_CAMPAIGN_TYPES.has(campaignType) &&
    ![...stats.slots].some((slot) => TIMER_SLOTS.has(slot))
  ) {
    return discarded("it was missing the countdown timer slot");
  }
  if (campaignType === "FREE_SHIPPING_GOAL" && !stats.slots.has("progress")) {
    return discarded("it was missing the shipping progress slot");
  }

  return {
    structureHtml: treeToHtml(tree),
    structureCss: sanitizeAiStructureCss(structureCss),
    warnings: [],
  };
}

// Layout-safety pass over AI-authored CSS, on top of the security sanitizer.
// Merchants may hand-write anything in the HTML editor; the AI must not pin
// elements to the viewport or stack above the host page.
export function sanitizeAiStructureCss(input: unknown): string {
  const css = sanitizeStructureCss(input);
  if (!css) return "";

  return css
    .replace(/position\s*:\s*(?:fixed|sticky)\s*(!important)?\s*;?/gi, "")
    .replace(/z-index\s*:\s*-?\d{4,}\s*(!important)?\s*;?/gi, "")
    .replace(
      /(?:min-|max-)?(?:width|height)\s*:\s*\d+(?:\.\d+)?v(?:w|h|min|max)\s*(!important)?\s*;?/gi,
      "",
    );
}

// Ensures AI-picked foreground colors stay readable against their background.
// Instead of rejecting the palette, the offending color is replaced with black
// or white, whichever contrasts more — the AI look survives, legibility wins.
export function enforceReadableAiColors<T extends Record<string, unknown>>(
  design: T,
): T {
  const result: Record<string, unknown> = { ...design };
  const background =
    result.backgroundType === "SOLID" ? readHex(result.backgroundColor) : "";

  if (background) {
    // Same 4.5 threshold as validateCampaignDesign, which would otherwise
    // reject the AI design at save time.
    fixContrast(result, "textColor", background, 4.5);
    fixContrast(result, "titleColor", background, 3);
    fixContrast(result, "subheadingColor", background, 3);
    fixContrast(result, "legendColor", background, 3);
  }

  const buttonColor = readHex(result.buttonColor);
  if (buttonColor) fixContrast(result, "buttonTextColor", buttonColor, 4.5);

  return result as T;
}

function fixContrast(
  design: Record<string, unknown>,
  field: string,
  background: string,
  minimumRatio: number,
) {
  const color = readHex(design[field]);
  if (!color || getContrastRatio(color, background) >= minimumRatio) return;

  design[field] =
    getContrastRatio("#111111", background) >=
    getContrastRatio("#ffffff", background)
      ? "#111111"
      : "#ffffff";
}

function readHex(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : "";
}

function collectStructureStats(tree: StructureNode) {
  const slotCounts = new Map<string, number>();
  let nodeCount = 0;
  let depth = 0;

  (function walk(node: StructureNode, level: number) {
    nodeCount += 1;
    depth = Math.max(depth, level);
    if (node.tag !== TEXT_TAG) {
      const slot = getNodeSlot(node);
      if (slot) slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
    }
    for (const child of node.children ?? []) walk(child, level + 1);
  })(tree, 1);

  return {
    nodeCount,
    depth,
    slots: new Set(slotCounts.keys()),
    duplicatedSlots: [...slotCounts.entries()]
      .filter(([slot, count]) => count > 1 && UNIQUE_SLOTS.has(slot))
      .map(([slot]) => slot),
  };
}
