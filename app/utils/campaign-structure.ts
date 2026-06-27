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

export const FILL_SLOTS = ["headline", "body", "cta", "badge-text"] as const;

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
  if (extra?.children && extra.children.length) result.children = extra.children;
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
    attrs[name] === ""
      ? name
      : `${name}="${escapeAttr(attrs[name])}"`,
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
// Per-campaign style values. Emits the `--cp-*` custom properties (the same set
// applied inline today by buildPreviewStyle / applyStyle) scoped to the campaign
// surface, plus the merchant customCss. The shared layout rules stay in the
// shared stylesheet. Returns CSS text using `__CP_SCOPE__` as a placeholder the
// renderer replaces with a unique per-instance selector to avoid collisions.
// ---------------------------------------------------------------------------

export const STRUCTURE_CSS_SCOPE_TOKEN = "__CP_SCOPE__";

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
  gradientAngle?: number;
  gradientStartColor?: string;
  gradientEndColor?: string;
  contentMaxWidth?: number;
  textColor?: string;
  accentColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
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
  offerCodeTextColor?: string;
  offerCodeBackgroundColor?: string;
  offerCodeBorderColor?: string;
  offerCodeFontSize?: number;
  offerCodeBorderRadius?: number;
  offerCodePaddingBlock?: number;
  offerCodePaddingInline?: number;
  offerCodeGap?: number;
  animationDurationMs?: number;
  floatOffsetTop?: string;
  floatOffsetBottom?: string;
  floatOffsetLeft?: string;
  floatOffsetRight?: string;
  customCss?: string | null;
};

function px(value: number | undefined, fallback: number): string {
  const num = typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
    )}") center / cover no-repeat`;
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

// Builds the `--cp-*` declarations for a campaign. Returned as a record so it can
// be applied inline (admin preview) or serialized to a scoped CSS string.
export function buildStructureCssVars(design: StyleDesignInput): Record<string, string> {
  return {
    "--cp-surface-bg": surfaceBackground(design),
    "--cp-bg": design.backgroundColor ?? "",
    "--cp-content-max-width": px(design.contentMaxWidth, 420),
    "--cp-text": design.textColor ?? "",
    "--cp-accent": design.accentColor ?? "",
    "--cp-button": design.buttonColor ?? "",
    "--cp-button-text": design.buttonTextColor ?? "",
    "--cp-close": design.closeButtonColor ?? "",
    "--cp-font-size": px(design.fontSize, 15),
    "--cp-font-family": FONT_FAMILIES[design.fontFamily ?? "THEME"] || "inherit",
    "--cp-radius": px(design.borderRadius, 0),
    "--cp-border-size": px(design.borderSize, 0),
    "--cp-border-color": design.borderColor ?? "",
    "--cp-align": textAlign(design.alignment),
    "--cp-justify": justifyContent(design.alignment),
    "--cp-title-size": px(design.titleFontSize, 18),
    "--cp-title-color": design.titleColor ?? "",
    "--cp-subheading-size": px(design.subheadingFontSize, 14),
    "--cp-subheading-color": design.subheadingColor ?? "",
    "--cp-timer-size": px(design.timerFontSize, 20),
    "--cp-timer-color": design.timerColor ?? "",
    "--cp-legend-size": px(design.legendFontSize, 11),
    "--cp-legend-color": design.legendColor ?? "",
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
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");

  let css = `${STRUCTURE_CSS_SCOPE_TOKEN} {\n${declarations}\n}`;

  const customCss = (design.customCss ?? "").trim();
  if (customCss) {
    css += `\n${customCss.replace(/<\/?\s*style/gi, "")}`;
  }
  return css;
}
