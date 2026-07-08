/*
 * Campaign structural HTML model (isomorphic — no DOM / React / Node deps).
 *
 * This is the single source of truth for the *structure* of a campaign surface.
 * Today the same DOM tree is produced in three places (the React preview in
 * CampaignPreview.tsx and the storefront builder in campaign-surface.js). This
 * module describes that tree as a small, framework-agnostic AST so a campaign can
 * save and render its own HTML structure instead of relying only on fixed
 * layouts + settings.
 *
 * Separation of concerns:
 *  - STRUCTURE lives here as an AST of nodes (containers, wrappers, text slots,
 *    and dynamic slots for timer/offer/progress/...).
 *  - STYLES are kept out of the HTML: the structural HTML carries only short,
 *    safe class names + `data-cp-slot` markers. Per-campaign style values live in
 *    a separate CSS string (see buildStructureCss) plus the shared stylesheet.
 *
 * Dynamic parts (timer countdown, free-shipping progress, copy/apply offer,
 * icon, close) are represented as empty *slot* placeholders. At render time the
 * storefront/admin hydrate those slots with the existing builders, so the live
 * campaign keeps its interactivity.
 *
 * Class naming: the rendered DOM keeps the existing `counterpulse-preview-*`
 * class names so the shared CSS (campaign-surface.css / the React preview) keeps
 * working unchanged. The editor-facing HTML and the compact AST use a short
 * `cp-*` alias derived by a reversible prefix swap, so the HTML the merchant
 * sees/edits is clean and small.
 */

import {
  getBackgroundImageAttachmentCssValue,
  getBackgroundImagePositionCssValue,
  getBackgroundImageRepeatCssValue,
  getBackgroundImageSizeCssValue,
} from "./campaign-design";

export const CAMPAIGN_STRUCTURE_VERSION = 2;

// The structural HTML the merchant writes is the single source of truth. The AST
// is a faithful, fully reversible representation of that HTML: every safe tag,
// attribute (id, class, data-*, src, alt, ...), text node, and child order is
// preserved. Class names are stored verbatim — never transformed — so what the
// user writes is exactly what renders everywhere (preview + storefront).

// Slots that the hydrator REPLACES with a freshly built dynamic node (the slot
// element itself is discarded). FILL slots keep their element and only receive
// sanitized text content.
export const REPLACE_SLOTS = [
  "icon",
  "timer",
  "timer-inline",
  "offer",
  "close",
  "progress",
  "badge-timer",
] as const;

// Scoped safety CSS applied under every structure surface BEFORE the campaign's
// own CSS (which can override it). Keeps the standard cp-* skeleton from
// collapsing the text column to one character per line next to a fixed-width
// timer/image, the most common broken-layout failure mode.
export const STRUCTURE_BASELINE_CSS = [
  "__CP_SCOPE__ .cp-promo{box-sizing:border-box;background:var(--cp-surface-bg);color:var(--cp-text);border:var(--cp-border-size) solid var(--cp-border-color);border-radius:var(--cp-radius);font-family:var(--cp-font-family);font-size:var(--cp-font-size);padding:var(--cp-padding-block) var(--cp-padding-inline);margin:var(--cp-margin-top) var(--cp-margin-right) var(--cp-margin-bottom) var(--cp-margin-left)}",
  "__CP_SCOPE__ .cp-message,__CP_SCOPE__ .cp-message-copy,__CP_SCOPE__ .cp-left{min-width:0}",
  "__CP_SCOPE__ .cp-message-copy{flex:1 1 auto}",
  "__CP_SCOPE__ .cp-message-copy strong,__CP_SCOPE__ .cp-message-copy span,__CP_SCOPE__ .cp-message-copy p{overflow-wrap:break-word;word-break:normal}",
].join("\n");

export const FILL_SLOTS = [
  "headline",
  "body",
  "cta",
  "badge-text",
  // Individual live countdown parts — render just the number and tick every
  // second on the storefront, so the merchant can place days/hours/minutes/
  // seconds anywhere in the custom HTML.
  "timer-days",
  "timer-hours",
  "timer-minutes",
  "timer-seconds",
] as const;

// The four single-part timer slots, mapped to how to compute their value.
export const TIMER_PART_SLOTS: Record<
  string,
  "days" | "hours" | "minutes" | "seconds"
> = {
  "timer-days": "days",
  "timer-hours": "hours",
  "timer-minutes": "minutes",
  "timer-seconds": "seconds",
};

// Computes the zero-padded value of one countdown part from a remaining-ms value.
export function timerPartValue(
  part: "days" | "hours" | "minutes" | "seconds",
  remainingMs: number,
): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  switch (part) {
    case "days":
      return String(Math.floor(total / 86400));
    case "hours":
      return pad(Math.floor((total % 86400) / 3600));
    case "minutes":
      return pad(Math.floor((total % 3600) / 60));
    default:
      return pad(total % 60);
  }
}

export type StructureSlot =
  | (typeof REPLACE_SLOTS)[number]
  | (typeof FILL_SLOTS)[number];

const ALL_SLOTS: ReadonlySet<string> = new Set([
  ...REPLACE_SLOTS,
  ...FILL_SLOTS,
]);

export function isStructureSlot(value: unknown): value is StructureSlot {
  return typeof value === "string" && ALL_SLOTS.has(value);
}

export function isFillSlot(slot: string): boolean {
  return (FILL_SLOTS as readonly string[]).includes(slot);
}

// One node of the structural AST. A text node has tag "#text" and a `text`
// value; an element node has a tag, ordered `attrs`, and ordered `children`
// (which may be elements or text nodes). Nothing is normalized away, so the AST
// can rebuild the exact HTML it was parsed from.
export const TEXT_TAG = "#text";

export type StructureNode = {
  tag: string;
  text?: string;
  attrs?: Record<string, string>;
  children?: StructureNode[];
};

// Reads the dynamic-slot marker (data-cp-slot) from a node, if any.
export function getNodeSlot(node: StructureNode): string | undefined {
  return node.attrs?.["data-cp-slot"];
}

// ---------------------------------------------------------------------------
// Tree builder — mirrors build() in campaign-surface.js and PromoSurface().
// ---------------------------------------------------------------------------

export type StructureBuildSpec = {
  variant: "bar" | "block" | "badge";
  placement: string;
  // Class-affecting design fields (no style values here).
  layout: string;
  fullWidth: boolean;
  positionMode: string;
  positionSticky: boolean;
  floatPosition: string;
  entranceAnimation: string;
  exitAnimation: string;
  badgeShape?: string;
  badgePosition?: string;
  // Presence flags computed by the caller from the campaign view model.
  hasIcon: boolean;
  hasInlineTimer: boolean;
  hasBlockTimer: boolean;
  hasBody: boolean;
  hasOffer: boolean;
  hasCta: boolean;
  ctaIsLink: boolean;
  hasClose: boolean;
  hasProgress: boolean;
  hasBadgeTimer: boolean;
};

function lower(value: string): string {
  return String(value || "").toLowerCase();
}

function dash(value: string): string {
  return lower(value).replace(/_/g, "-");
}

// Class prefix used by the auto-generated default structure so the shared
// stylesheet (campaign-surface.css / the React preview) styles it. Merchant-
// authored HTML can use any class names it wants.
function cpClass(suffix: string): string {
  return "counterpulse-preview-" + suffix;
}

function node(
  tag: string,
  cls: string[] | undefined,
  extra?: { children?: StructureNode[] },
): StructureNode {
  const result: StructureNode = { tag };
  const classValue = (cls ?? []).filter(Boolean).join(" ");
  if (classValue) result.attrs = { class: classValue };
  if (extra?.children && extra.children.length)
    result.children = extra.children;
  return result;
}

function slotNode(slot: StructureSlot, tag = "div"): StructureNode {
  return { tag, attrs: { "data-cp-slot": slot } };
}

export function buildCampaignStructureTree(
  spec: StructureBuildSpec,
): StructureNode {
  if (spec.variant === "badge") {
    return buildBadgeTree(spec);
  }

  const isInline = spec.layout === "INLINE";

  const rootClasses = [
    cpClass("promo"),
    cpClass("promo--" + spec.variant),
    cpClass("promo--layout-" + lower(spec.layout)),
    cpClass("promo--placement-" + dash(spec.placement)),
    spec.fullWidth ? cpClass("promo--full-width") : "",
    cpClass("promo--position-" + lower(spec.positionMode)),
    spec.variant === "bar" &&
    (spec.placement === "TOP_BAR" || spec.placement === "BOTTOM_BAR") &&
    spec.positionMode !== "OVERLAY" &&
    spec.positionSticky
      ? cpClass("promo--sticky")
      : "",
    spec.positionMode === "OVERLAY"
      ? cpClass("promo--float-" + lower(spec.floatPosition || "FIXED"))
      : "",
    cpClass("promo--enter-" + lower(spec.entranceAnimation)),
    cpClass("promo--exit-" + lower(spec.exitAnimation)),
  ].filter(Boolean);

  const children: StructureNode[] = [];

  // Message block: icon + copy (headline, optional inline timer / body).
  const copyChildren: StructureNode[] = [slotNode("headline", "strong")];
  if (isInline && spec.hasInlineTimer) {
    copyChildren.push(slotNode("timer-inline"));
  }
  if (!isInline && spec.hasBody) {
    copyChildren.push(slotNode("body", "span"));
  }

  const messageChildren: StructureNode[] = [];
  if (spec.hasIcon) messageChildren.push(slotNode("icon", "span"));
  messageChildren.push(
    node("div", [cpClass("message-copy")], { children: copyChildren }),
  );
  children.push(
    node("div", [cpClass("message")], { children: messageChildren }),
  );

  // Block-level timer.
  if (!isInline && spec.hasBlockTimer) {
    children.push(slotNode("timer"));
  }

  // Actions (offer + cta).
  if (spec.hasOffer || spec.hasCta) {
    const actionChildren: StructureNode[] = [];
    if (spec.hasOffer) actionChildren.push(slotNode("offer", "span"));
    if (spec.hasCta) {
      actionChildren.push(slotNode("cta", spec.ctaIsLink ? "a" : "span"));
    }
    children.push(
      node("div", [cpClass("actions")], { children: actionChildren }),
    );
  }

  // Close button.
  if (spec.hasClose) children.push(slotNode("close", "span"));

  // Progress bar.
  if (spec.hasProgress) children.push(slotNode("progress"));

  return node("section", rootClasses, { children });
}

// Minimal view-model shape needed to decide which slots are present. Mirrors the
// presence logic in PromoSurface() (CampaignPreview.tsx) so admin + storefront +
// stored structure stay in agreement. Kept loose so callers can pass the full
// CampaignViewModel or a subset.
export type StructureSpecViewModel = {
  ctaText?: string;
  ctaUrl?: string;
  timer?: unknown | null;
  deliveryCutoff?: unknown | null;
  freeShipping?: unknown | null;
  offer?: { canApply?: boolean } | null;
  cartRescue?: { showButton?: boolean } | null;
  badge?: unknown | null;
};

export type StructureSpecDesign = {
  layout: string;
  fullWidth: boolean;
  positionMode: string;
  positionSticky: boolean;
  floatPosition: string;
  entranceAnimation: string;
  exitAnimation: string;
  icon: string;
  showButton: boolean;
  showCloseButton: boolean;
  showProgressBar: boolean;
  showDiscountCode: boolean;
  showCopyCodeButton: boolean;
  showApplyDiscountButton: boolean;
};

export function deriveCampaignStructureSpec(
  viewModel: StructureSpecViewModel,
  design: StructureSpecDesign,
  variant: "bar" | "block" | "badge" = "block",
  placement = "PRODUCT_PAGE",
  badge?: { badgeShape?: string; badgePosition?: string },
): StructureBuildSpec {
  const isInline = design.layout === "INLINE";
  const hasTimer = Boolean(viewModel.timer || viewModel.deliveryCutoff);
  const offer = viewModel.offer ?? null;
  const hasOffer = Boolean(
    offer &&
    (design.showDiscountCode ||
      design.showCopyCodeButton ||
      (design.showApplyDiscountButton && offer.canApply !== false)),
  );
  const hasCta = Boolean(
    design.showButton &&
    viewModel.cartRescue?.showButton !== false &&
    viewModel.ctaText,
  );

  return {
    variant,
    placement,
    layout: design.layout,
    fullWidth: design.fullWidth,
    positionMode: design.positionMode,
    positionSticky: design.positionSticky,
    floatPosition: design.floatPosition,
    entranceAnimation: design.entranceAnimation,
    exitAnimation: design.exitAnimation,
    badgeShape: badge?.badgeShape,
    badgePosition: badge?.badgePosition,
    hasIcon: design.icon !== "NONE",
    hasInlineTimer: isInline && hasTimer,
    hasBlockTimer: !isInline && hasTimer,
    hasBody: !isInline,
    hasOffer,
    hasCta,
    ctaIsLink: Boolean(viewModel.ctaUrl && viewModel.ctaUrl !== "#"),
    hasClose: design.showCloseButton,
    hasProgress:
      Boolean(viewModel.freeShipping) && design.showProgressBar !== false,
    hasBadgeTimer: hasTimer,
  };
}

function buildBadgeTree(spec: StructureBuildSpec): StructureNode {
  const classes = [
    cpClass("badge"),
    cpClass("badge--" + lower(spec.badgeShape || "PILL")),
    cpClass("badge--" + dash(spec.badgePosition || "TOP_RIGHT")),
  ].filter(Boolean);

  const children: StructureNode[] = [slotNode("badge-text", "span")];
  if (spec.hasBadgeTimer) children.push(slotNode("badge-timer"));

  return node("div", classes, { children });
}

// ---------------------------------------------------------------------------
// HTML serialization (tree -> clean HTML, no inline styles).
// ---------------------------------------------------------------------------

const VOID_TAGS: ReadonlySet<string> = new Set(["br", "img", "hr"]);

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type TreeToHtmlOptions = {
  // Pretty-print with indentation. Defaults to true.
  pretty?: boolean;
};

export function treeToHtml(
  tree: StructureNode,
  options: TreeToHtmlOptions = {},
): string {
  const pretty = options.pretty !== false;
  return renderNode(tree, pretty, 0).trimEnd();
}

function serializeAttrs(attrs: Record<string, string> | undefined): string {
  if (!attrs) return "";
  const parts = Object.keys(attrs).map((name) =>
    attrs[name] === "" ? name : `${name}="${escapeAttr(attrs[name])}"`,
  );
  return parts.length ? " " + parts.join(" ") : "";
}

function isTextOnly(node: StructureNode): boolean {
  return Boolean(
    node.children &&
    node.children.length > 0 &&
    node.children.every((child) => child.tag === TEXT_TAG),
  );
}

function renderNode(
  current: StructureNode,
  pretty: boolean,
  depth: number,
): string {
  const indent = pretty ? "  ".repeat(depth) : "";
  const nl = pretty ? "\n" : "";

  if (current.tag === TEXT_TAG) {
    return `${indent}${escapeText(current.text ?? "")}${nl}`;
  }

  const tag = current.tag;
  const attrString = serializeAttrs(current.attrs);

  if (VOID_TAGS.has(tag)) {
    return `${indent}<${tag}${attrString}>${nl}`;
  }

  const children = current.children ?? [];
  if (children.length === 0) {
    return `${indent}<${tag}${attrString}></${tag}>${nl}`;
  }

  // Keep elements whose children are all text on a single line for readability
  // (e.g. <h1>Summer Sale</h1>).
  if (isTextOnly(current)) {
    const text = children.map((child) => escapeText(child.text ?? "")).join("");
    return `${indent}<${tag}${attrString}>${text}</${tag}>${nl}`;
  }

  let inner = "";
  for (const child of children) {
    inner += renderNode(child, pretty, depth + 1);
  }
  return `${indent}<${tag}${attrString}>${nl}${inner}${indent}</${tag}>${nl}`;
}

// ---------------------------------------------------------------------------
// HTML parsing (HTML -> faithful tree). Preserves every tag, attribute, text
// node, and child order. It does NOT enforce security — that is the job of
// sanitizeStructureHtml (structure-html.ts), which runs before storage. This
// parser only normalizes whitespace-only text between elements.
// ---------------------------------------------------------------------------

export function htmlToTree(html: string): StructureNode | null {
  const tokens = tokenizeHtml(html);
  const root: StructureNode = { tag: "#root", children: [] };
  const stack: StructureNode[] = [root];

  for (const token of tokens) {
    const top = stack[stack.length - 1];
    if (token.type === "text") {
      // Decode entities back to characters so a re-serialization is stable.
      const value = decodeEntities(token.value);
      if (value.trim().length === 0) continue; // drop whitespace-only nodes
      (top.children ??= []).push({ tag: TEXT_TAG, text: value });
      continue;
    }
    if (token.type === "open") {
      const built: StructureNode = { tag: token.tag };
      const attrs = parseAttributes(token.rawAttrs);
      if (Object.keys(attrs).length) built.attrs = attrs;
      (top.children ??= []).push(built);
      if (!token.selfClosing && !VOID_TAGS.has(token.tag)) {
        stack.push(built);
      }
      continue;
    }
    // close — unwind to the matching open tag.
    for (let i = stack.length - 1; i > 0; i -= 1) {
      if (stack[i].tag === token.tag) {
        stack.length = i;
        break;
      }
    }
  }

  const children = root.children ?? [];
  const firstElement = children.find((child) => child.tag !== TEXT_TAG);
  if (!firstElement) return null;

  // The structural document is wrapped in a single root element. If the user
  // wrote multiple top-level nodes, wrap them so nothing is dropped.
  const elementCount = children.filter(
    (child) => child.tag !== TEXT_TAG,
  ).length;
  if (elementCount === 1 && children[0] === firstElement) {
    return firstElement;
  }
  return { tag: "div", attrs: { class: "cp-root" }, children };
}

type HtmlToken =
  | { type: "text"; value: string }
  | { type: "open"; tag: string; rawAttrs: string; selfClosing: boolean }
  | { type: "close"; tag: string };

function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  let index = 0;
  while (index < html.length) {
    const lt = html.indexOf("<", index);
    if (lt === -1) {
      tokens.push({ type: "text", value: html.slice(index) });
      break;
    }
    if (lt > index) {
      tokens.push({ type: "text", value: html.slice(index, lt) });
    }
    const gt = html.indexOf(">", lt);
    if (gt === -1) {
      tokens.push({ type: "text", value: html.slice(lt) });
      break;
    }
    const raw = html.slice(lt + 1, gt);
    index = gt + 1;
    if (raw.startsWith("!")) continue; // comments / doctype
    if (raw.startsWith("/")) {
      tokens.push({ type: "close", tag: raw.slice(1).trim().toLowerCase() });
      continue;
    }
    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const match = /^([a-zA-Z][a-zA-Z0-9-]*)([\s\S]*)$/.exec(body.trim());
    if (!match) continue;
    tokens.push({
      type: "open",
      tag: match[1].toLowerCase(),
      rawAttrs: match[2] || "",
      selfClosing,
    });
  }
  return tokens;
}

// Parses a tag's raw attribute text into an ordered name->value map. Boolean
// attributes get an empty-string value. Names are lower-cased.
function parseAttributes(rawAttrs: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawAttrs))) {
    const name = match[1];
    if (!name) continue;
    const rawValue = match[3] ?? match[4] ?? match[5] ?? "";
    attrs[name.toLowerCase()] = decodeEntities(rawValue);
  }
  return attrs;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// Compact AST (dictionary-packed) — a storage/transmission optimization only.
// It is fully reversible: unpack(pack(tree)) deep-equals tree, so the exact HTML
// can be rebuilt with treeToHtml.
//
// Shape: { v, t:[tagNames], a:[attrNames], n:<packed node> }
//   element node = [tagId, [[attrNameId, value], ...], [children...]]
//   text node    = [tagId(of "#text"), textString]
// Trailing empty entries on element nodes are trimmed for size.
// ---------------------------------------------------------------------------

export type PackedStructure = {
  v: number;
  t: string[];
  a: string[];
  n: PackedNode;
};

type PackedNode = unknown[];

export function packTree(tree: StructureNode): PackedStructure {
  const tags: string[] = [];
  const attrNames: string[] = [];
  const tagIndex = new Map<string, number>();
  const attrIndex = new Map<string, number>();

  const intern = (
    value: string,
    list: string[],
    index: Map<string, number>,
  ): number => {
    let id = index.get(value);
    if (id === undefined) {
      id = list.length;
      list.push(value);
      index.set(value, id);
    }
    return id;
  };

  const pack = (current: StructureNode): PackedNode => {
    const tagId = intern(current.tag, tags, tagIndex);
    if (current.tag === TEXT_TAG) {
      return [tagId, current.text ?? ""];
    }
    const attrs = current.attrs ?? {};
    const attrPairs = Object.keys(attrs).map((name) => [
      intern(name, attrNames, attrIndex),
      attrs[name],
    ]);
    const arr: unknown[] = [
      tagId,
      attrPairs,
      (current.children ?? []).map(pack),
    ];
    while (arr.length > 1) {
      const last = arr[arr.length - 1];
      if (Array.isArray(last) && last.length === 0) {
        arr.pop();
      } else {
        break;
      }
    }
    return arr;
  };

  return {
    v: CAMPAIGN_STRUCTURE_VERSION,
    t: tags,
    a: attrNames,
    n: pack(tree),
  };
}

// The dictionary-packed AST is stored as a compact JSON string. Encoding/decoding
// stays isomorphic (no gzip) so the storefront bundle can decode it too.
export function encodePackedStructure(packed: PackedStructure): string {
  return JSON.stringify(packed);
}

export function decodePackedStructure(
  encoded: string | null | undefined,
): PackedStructure | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(encoded) as PackedStructure;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.t) ||
      !Array.isArray(parsed.a)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function unpackTree(packed: PackedStructure): StructureNode {
  const { t: tags, a: attrNames } = packed;

  const unpack = (arr: PackedNode): StructureNode => {
    const tag = tags[arr[0] as number];
    if (tag === TEXT_TAG) {
      return { tag, text: String(arr[1] ?? "") };
    }
    const result: StructureNode = { tag };
    const attrPairs = (arr[1] as Array<[number, string]>) ?? [];
    if (attrPairs.length) {
      const attrs: Record<string, string> = {};
      for (const [nameId, value] of attrPairs) {
        attrs[attrNames[nameId]] = String(value ?? "");
      }
      result.attrs = attrs;
    }
    const children = arr[2] as PackedNode[] | undefined;
    if (children && children.length) {
      result.children = children.map(unpack);
    }
    return result;
  };

  return unpack(packed.n);
}

// ---------------------------------------------------------------------------
// Node addressing + inline-style helpers (used by the visual inspector to edit a
// specific node's common properties without hand-editing the HTML).
//
// A node "path" mirrors the render keys in StructurePromoSurface: the child
// indices from the root, joined with "-" (e.g. "0-2-1"). The empty string "" is
// the root itself.
// ---------------------------------------------------------------------------

export function getNodeAtPath(
  tree: StructureNode,
  path: string,
): StructureNode | null {
  if (!path) return tree;
  let node: StructureNode | undefined = tree;
  for (const segment of path.split("-")) {
    const index = Number(segment);
    if (!node?.children || !Number.isInteger(index)) return null;
    node = node.children[index];
  }
  return node ?? null;
}

// Parses an inline style string into an ordered prop->value map.
export function parseStyle(style: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!style) return result;
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx <= 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (prop && value) result[prop] = value;
  }
  return result;
}

export function serializeStyle(style: Record<string, string>): string {
  return Object.keys(style)
    .filter((prop) => style[prop] !== "" && style[prop] != null)
    .map((prop) => `${prop}: ${style[prop]}`)
    .join("; ");
}

// Returns a deep-cloned tree with the given CSS declarations merged into the
// inline `style` of the node at `path`. Declarations with empty values are
// removed. The tree is cloned so callers can compare/replace immutably.
export function setNodeStyleAtPath(
  tree: StructureNode,
  path: string,
  declarations: Record<string, string>,
): StructureNode {
  const clone = cloneNode(tree);
  const node = getNodeAtPath(clone, path);
  if (!node || node.tag === TEXT_TAG) return clone;

  const style = parseStyle(node.attrs?.style);
  for (const prop of Object.keys(declarations)) {
    const value = declarations[prop];
    if (value === "" || value == null) delete style[prop];
    else style[prop] = value;
  }

  const serialized = serializeStyle(style);
  const attrs = { ...(node.attrs ?? {}) };
  if (serialized) attrs.style = serialized;
  else delete attrs.style;
  node.attrs = Object.keys(attrs).length ? attrs : undefined;
  return clone;
}

// Sets (or removes, when value is "") an attribute on the node at `path`.
// Returns a deep-cloned tree. Used by the inspector to edit e.g. an image src.
export function setNodeAttrAtPath(
  tree: StructureNode,
  path: string,
  name: string,
  value: string,
): StructureNode {
  const clone = cloneNode(tree);
  const node = getNodeAtPath(clone, path);
  if (!node || node.tag === TEXT_TAG) return clone;
  const attrs = { ...(node.attrs ?? {}) };
  if (value === "") delete attrs[name];
  else attrs[name] = value;
  node.attrs = Object.keys(attrs).length ? attrs : undefined;
  return clone;
}

// Removes every element carrying `data-cp-slot="<slot>"` from the tree, at any
// depth. Used by the design editor to "remove an element's HTML" (button, icon,
// close, ...). Returns a deep-cloned tree; the root is never removed.
export function removeNodeBySlot(
  tree: StructureNode,
  slot: string,
): StructureNode {
  const clone = cloneNode(tree);
  const prune = (node: StructureNode) => {
    if (!node.children) return;
    node.children = node.children.filter(
      (child) => getNodeSlot(child) !== slot,
    );
    node.children.forEach(prune);
  };
  prune(clone);
  return clone;
}

function cloneNode(node: StructureNode): StructureNode {
  const next: StructureNode = { tag: node.tag };
  if (node.text != null) next.text = node.text;
  if (node.attrs) next.attrs = { ...node.attrs };
  if (node.children) next.children = node.children.map(cloneNode);
  return next;
}

// ---------------------------------------------------------------------------
// Per-campaign style values. Emits the `--cp-*` custom properties (the same set
// applied inline today by buildPreviewStyle / applyStyle) scoped to the campaign
// surface, plus the merchant customCss. The shared layout rules stay in the
// shared stylesheet. Returns CSS text using `__CP_SCOPE__` as a placeholder the
// renderer replaces with a unique per-instance selector to avoid collisions.
// ---------------------------------------------------------------------------

export const STRUCTURE_CSS_SCOPE_TOKEN = "__CP_SCOPE__";

// At-rules whose body contains style rules that must themselves be scoped.
const CSS_NESTED_AT_RULE = /^@(media|supports|container|layer|scope)\b/i;

// Rewrites merchant "Custom CSS" so every selector is confined to a single
// campaign surface: each top-level selector is prefixed with `scope` (the
// per-campaign scope token/selector) unless it already references it. Nested
// at-rules (@media/@supports/…) recurse; @keyframes/@font-face/@page/@import and
// other statement/keyframe blocks are left untouched so their inner selectors
// (0%, from, to, …) are not mangled. This lets merchants author plain CSS
// (`.cp-promo { … }`) and have it only affect their campaign — no `__CP_SCOPE__`
// bookkeeping required. Already-scoped rules (e.g. AI-authored) pass through.
export function scopeCustomCss(
  css: string,
  scope: string = STRUCTURE_CSS_SCOPE_TOKEN,
): string {
  const input = (css ?? "").trim();
  if (!input) return "";
  return scopeCssRules(input, scope).trim();
}

function scopeCssRules(css: string, scope: string): string {
  let out = "";
  let i = 0;
  const len = css.length;

  while (i < len) {
    // Preserve leading whitespace/comments verbatim.
    const triviaStart = i;
    i = skipCssTrivia(css, i);
    out += css.slice(triviaStart, i);
    if (i >= len) break;

    // Read the prelude up to the next top-level `{`, `;` or `}`.
    let j = i;
    let parens = 0;
    while (j < len) {
      const c = css[j];
      if (c === '"' || c === "'") {
        j = skipCssString(css, j);
        continue;
      }
      if (c === "/" && css[j + 1] === "*") {
        j = skipCssComment(css, j);
        continue;
      }
      if (c === "(") parens++;
      else if (c === ")") parens = Math.max(0, parens - 1);
      else if (parens === 0 && (c === "{" || c === ";" || c === "}")) break;
      j++;
    }

    if (j >= len) {
      out += css.slice(i);
      break;
    }

    const delimiter = css[j];
    if (delimiter === ";" || delimiter === "}") {
      // Statement at-rule (@import/@charset) or stray token — leave as-is.
      out += css.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    // delimiter === "{" — a rule with a block. Keep the original block text
    // (and prelude whitespace) so only the selector is rewritten.
    const rawPrelude = css.slice(i, j);
    const trimmedPrelude = rawPrelude.trim();
    const blockEnd = matchCssBrace(css, j);
    const block = css.slice(j, blockEnd + 1);

    if (trimmedPrelude.startsWith("@")) {
      if (CSS_NESTED_AT_RULE.test(trimmedPrelude)) {
        const inner = css.slice(j + 1, blockEnd);
        out += `${rawPrelude}{${scopeCssRules(inner, scope)}}`;
      } else {
        // @keyframes/@font-face/@page/… — leave the whole rule untouched.
        out += css.slice(i, blockEnd + 1);
      }
    } else {
      const trailingWs = rawPrelude.slice(trimmedPrelude.length);
      out += `${scopeCssSelectorList(trimmedPrelude, scope)}${trailingWs}${block}`;
    }
    i = blockEnd + 1;
  }

  return out;
}

function scopeCssSelectorList(selectorList: string, scope: string): string {
  return splitTopLevelCommas(selectorList)
    .map((selector) => {
      const trimmed = selector.trim();
      if (!trimmed) return trimmed;
      // Leave already-scoped selectors and nesting selectors untouched.
      if (trimmed.includes(scope) || trimmed.startsWith("&")) return trimmed;
      return `${scope} ${trimmed}`;
    })
    .join(", ");
}

function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"' || c === "'") {
      i = skipCssString(value, i) - 1;
      continue;
    }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
    else if (c === "," && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function skipCssTrivia(css: string, i: number): number {
  const len = css.length;
  while (i < len) {
    const c = css[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f") {
      i++;
    } else if (c === "/" && css[i + 1] === "*") {
      i = skipCssComment(css, i);
    } else {
      break;
    }
  }
  return i;
}

function skipCssComment(css: string, i: number): number {
  const end = css.indexOf("*/", i + 2);
  return end === -1 ? css.length : end + 2;
}

function skipCssString(css: string, i: number): number {
  const quote = css[i];
  let j = i + 1;
  while (j < css.length) {
    if (css[j] === "\\") {
      j += 2;
      continue;
    }
    if (css[j] === quote) return j + 1;
    j++;
  }
  return css.length;
}

function matchCssBrace(css: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") {
      i = skipCssString(css, i) - 1;
      continue;
    }
    if (c === "/" && css[i + 1] === "*") {
      i = skipCssComment(css, i) - 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length;
}

const FONT_FAMILIES: Record<string, string> = {
  THEME: "inherit",
  SYSTEM:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  SERIF: 'Georgia, Cambria, "Times New Roman", Times, serif',
  ROUNDED: '"Nunito", "Quicksand", system-ui, sans-serif',
  MONO: '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  GEOMETRIC: '"Futura", "Century Gothic", system-ui, sans-serif',
  HUMANIST: '"Optima", "Segoe UI", system-ui, sans-serif',
  CONDENSED: '"Arial Narrow", "Roboto Condensed", system-ui, sans-serif',
  CASUAL: '"Trebuchet MS", "Comic Sans MS", system-ui, sans-serif',
};

export type StyleDesignInput = {
  backgroundType?: string;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  backgroundImageSize?: string;
  backgroundImagePosition?: string;
  backgroundImageRepeat?: string;
  backgroundImageAttachment?: string;
  gradientAngle?: number;
  gradientStartColor?: string;
  gradientEndColor?: string;
  contentMaxWidth?: number;
  textColor?: string;
  accentColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonHoverColor?: string;
  buttonTextHoverColor?: string;
  closeButtonColor?: string;
  fontSize?: number;
  fontFamily?: string;
  borderRadius?: number;
  borderSize?: number;
  borderColor?: string;
  alignment?: string;
  titleFontSize?: number;
  titleColor?: string;
  subheadingFontSize?: number;
  subheadingColor?: string;
  timerFontSize?: number;
  timerColor?: string;
  legendFontSize?: number;
  legendColor?: string;
  timerNumberFontSize?: number;
  timerLabelFontSize?: number;
  timerGap?: number;
  timerUnitGap?: number;
  timerPaddingBlock?: number;
  timerPaddingInline?: number;
  timerSurfaceColor?: string;
  timerSurfaceBorderColor?: string;
  timerSurfaceBorderSize?: number;
  timerSurfaceRadius?: number;
  paddingBlock?: number;
  paddingInline?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  contentGap?: number;
  positionStickyZIndex?: number;
  offerCodeTextColor?: string;
  offerCodeBackgroundColor?: string;
  offerCodeBorderColor?: string;
  offerCodeFontSize?: number;
  offerCodeBorderRadius?: number;
  offerCodePaddingBlock?: number;
  offerCodePaddingInline?: number;
  offerCodeGap?: number;
  animationDurationMs?: number;
  timerTickDurationMs?: number;
  floatOffsetTop?: string;
  floatOffsetBottom?: string;
  floatOffsetLeft?: string;
  floatOffsetRight?: string;
  customCss?: string | null;
};

function px(value: number | undefined, fallback: number): string {
  const num =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return `${num}px`;
}

function cssLength(value: string | undefined, fallback: string): string {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return fallback;
  if (raw === "auto") return "auto";
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw + "px";
  if (/^-?\d+(\.\d+)?(px|rem|em|vh|vw|%)$/.test(raw)) return raw;
  return fallback;
}

function escapeCssUrl(value: string): string {
  return String(value || "").replace(/["\\\n\r]/g, "");
}

function surfaceBackground(design: StyleDesignInput): string {
  if (design.backgroundType === "IMAGE" && design.backgroundImageUrl) {
    return `linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.18)), url("${escapeCssUrl(
      design.backgroundImageUrl,
    )}") ${getBackgroundImagePositionCssValue(
      design.backgroundImagePosition,
    )} / ${getBackgroundImageSizeCssValue(
      design.backgroundImageSize,
    )} ${getBackgroundImageRepeatCssValue(
      design.backgroundImageRepeat,
    )} ${getBackgroundImageAttachmentCssValue(
      design.backgroundImageAttachment,
    )}`;
  }
  if (design.backgroundType === "GRADIENT") {
    return `linear-gradient(${design.gradientAngle ?? 90}deg, ${design.gradientStartColor}, ${design.gradientEndColor})`;
  }
  return design.backgroundColor ?? "";
}

function textAlign(alignment: string | undefined): string {
  if (alignment === "LEFT") return "left";
  if (alignment === "RIGHT") return "right";
  return "center";
}

function justifyContent(alignment: string | undefined): string {
  if (alignment === "LEFT") return "flex-start";
  if (alignment === "RIGHT") return "flex-end";
  return "center";
}

// Grid `justify-items` value (start/center/end) so the alignment control also
// moves grid items (timer/actions/etc.), not just inline text.
function justifyItems(alignment: string | undefined): string {
  if (alignment === "LEFT") return "start";
  if (alignment === "RIGHT") return "end";
  return "center";
}

// Builds the `--cp-*` declarations for a campaign. Returned as a record so it can
// be applied inline (admin preview) or serialized to a scoped CSS string.
export function buildStructureCssVars(
  design: StyleDesignInput,
): Record<string, string> {
  return {
    "--cp-surface-bg": surfaceBackground(design),
    "--cp-bg": design.backgroundColor ?? "",
    "--cp-content-max-width": px(design.contentMaxWidth, 420),
    "--cp-text": design.textColor ?? "",
    "--cp-accent": design.accentColor ?? "",
    "--cp-button": design.buttonColor ?? "",
    "--cp-button-text": design.buttonTextColor ?? "",
    "--cp-button-hover": design.buttonHoverColor ?? "",
    "--cp-button-text-hover": design.buttonTextHoverColor ?? "",
    "--cp-close": design.closeButtonColor ?? "",
    "--cp-font-size": px(design.fontSize, 15),
    "--cp-font-family":
      FONT_FAMILIES[design.fontFamily ?? "THEME"] || "inherit",
    "--cp-radius": px(design.borderRadius, 0),
    "--cp-border-size": px(design.borderSize, 0),
    "--cp-border-color": design.borderColor ?? "",
    "--cp-align": textAlign(design.alignment),
    "--cp-justify": justifyContent(design.alignment),
    "--cp-justify-items": justifyItems(design.alignment),
    "--cp-title-size": px(design.titleFontSize, 18),
    "--cp-title-color": design.titleColor ?? "",
    "--cp-subheading-size": px(design.subheadingFontSize, 14),
    "--cp-subheading-color": design.subheadingColor ?? "",
    // "Number size" (timerNumberFontSize) and "Label size" (timerLabelFontSize)
    // are the single source of truth for timer digit/label sizing. The older
    // --cp-timer-size / --cp-legend-size vars (still used by some storefront
    // rules and the colon/inline/compact timer) are fed the same values so the
    // editor preview and the stored/storefront CSS stay in sync.
    "--cp-timer-size": px(
      design.timerNumberFontSize ?? design.timerFontSize,
      20,
    ),
    "--cp-timer-color": design.timerColor ?? "",
    "--cp-legend-size": px(
      design.timerLabelFontSize ?? design.legendFontSize,
      11,
    ),
    "--cp-legend-color": design.legendColor ?? "",
    "--cp-timer-number-size": px(
      design.timerNumberFontSize ?? design.timerFontSize,
      20,
    ),
    "--cp-timer-label-size": px(
      design.timerLabelFontSize ?? design.legendFontSize,
      11,
    ),
    "--cp-timer-gap": px(design.timerGap, 10),
    "--cp-timer-unit-gap": px(design.timerUnitGap, 3),
    "--cp-timer-padding-block": px(design.timerPaddingBlock, 8),
    "--cp-timer-padding-inline": px(design.timerPaddingInline, 12),
    "--cp-timer-surface": design.timerSurfaceColor ?? "",
    "--cp-timer-border": design.timerSurfaceBorderColor ?? "",
    "--cp-timer-border-size": px(design.timerSurfaceBorderSize, 0),
    "--cp-timer-radius": px(design.timerSurfaceRadius, 0),
    "--cp-padding-block": px(design.paddingBlock, 16),
    "--cp-padding-inline": px(design.paddingInline, 20),
    "--cp-margin-top": px(design.marginTop, 0),
    "--cp-margin-bottom": px(design.marginBottom, 0),
    "--cp-margin-left": px(design.marginLeft, 0),
    "--cp-margin-right": px(design.marginRight, 0),
    "--cp-gap": px(design.contentGap, 12),
    "--cp-sticky-z-index": String(
      typeof design.positionStickyZIndex === "number"
        ? Math.max(0, Math.round(design.positionStickyZIndex))
        : 50,
    ),
    "--cp-offer-code-text": design.offerCodeTextColor ?? "",
    "--cp-offer-code-bg": design.offerCodeBackgroundColor ?? "",
    "--cp-offer-code-border": design.offerCodeBorderColor ?? "",
    "--cp-offer-code-size": px(design.offerCodeFontSize, 14),
    "--cp-offer-code-radius": px(design.offerCodeBorderRadius, 0),
    "--cp-offer-code-padding-block": px(design.offerCodePaddingBlock, 6),
    "--cp-offer-code-padding-inline": px(design.offerCodePaddingInline, 10),
    "--cp-offer-gap": px(design.offerCodeGap, 8),
    "--cp-motion-duration": `${
      typeof design.animationDurationMs === "number"
        ? design.animationDurationMs
        : 220
    }ms`,
    "--cp-tick-duration": `${
      typeof design.timerTickDurationMs === "number"
        ? design.timerTickDurationMs
        : 220
    }ms`,
    "--cp-float-top": cssLength(design.floatOffsetTop, "0"),
    "--cp-float-bottom": cssLength(design.floatOffsetBottom, "auto"),
    "--cp-float-left": cssLength(design.floatOffsetLeft, "0"),
    "--cp-float-right": cssLength(design.floatOffsetRight, "0"),
  };
}

// Serializes the per-campaign style values to a scoped CSS string. The custom
// CSS is expected to already be plan-gated + sanitized by the caller; a
// defensive strip prevents `</style>` breakout.
export function buildStructureCss(design: StyleDesignInput): string {
  const vars = buildStructureCssVars(design);
  const declarations = Object.entries(vars)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");

  let css = `${STRUCTURE_CSS_SCOPE_TOKEN} {\n${declarations}\n}`;

  const customCss = (design.customCss ?? "").trim();
  if (customCss) {
    // Auto-scope the merchant CSS to this campaign's surface so plain selectors
    // (`.cp-promo {}`) only affect this campaign — no `__CP_SCOPE__` needed.
    const scoped = scopeCustomCss(customCss.replace(/<\/?\s*style/gi, ""));
    css += `\n${scoped}`;
  }
  return css;
}
