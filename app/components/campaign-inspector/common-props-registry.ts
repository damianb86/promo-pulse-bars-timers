// Common CSS properties applied to ANY inspected node (app component or generic
// HTML) as inline `style` on the node. Adding a new shared property is a one-line
// entry here — no per-component changes. The inspector reads/writes these against
// the node's `style` via the AST helpers (parseStyle / setNodeStyleAtPath).
//
// Values are stored verbatim, so any valid CSS value works (100px, 20%, 50vw,
// auto, fit-content, inherit, …). `select` props offer common presets but the
// stored value is still a plain string.

export type CommonPropKind = "css" | "select" | "color";

export type CommonPropDescriptor = {
  // Stable key (also the field id).
  key: string;
  label: string;
  // The CSS property written to the node's inline style.
  cssProp: string;
  kind: CommonPropKind;
  // Group heading the property renders under (one card per group).
  group: string;
  // Preset options for `select` (empty value = "not set").
  options?: string[];
  // Only show for text nodes (Typography).
  textOnly?: boolean;
};

const SELECT_NONE = ""; // "not set" — clears the declaration.

export const COMMON_PROP_DESCRIPTORS: CommonPropDescriptor[] = [
  // Size ---------------------------------------------------------------------
  { key: "width", label: "Width", cssProp: "width", kind: "css", group: "Size" },
  { key: "height", label: "Height", cssProp: "height", kind: "css", group: "Size" },
  { key: "minWidth", label: "Min width", cssProp: "min-width", kind: "css", group: "Size" },
  { key: "maxWidth", label: "Max width", cssProp: "max-width", kind: "css", group: "Size" },
  { key: "minHeight", label: "Min height", cssProp: "min-height", kind: "css", group: "Size" },
  { key: "maxHeight", label: "Max height", cssProp: "max-height", kind: "css", group: "Size" },

  // Spacing ------------------------------------------------------------------
  { key: "margin", label: "Margin", cssProp: "margin", kind: "css", group: "Spacing" },
  { key: "marginTop", label: "Margin top", cssProp: "margin-top", kind: "css", group: "Spacing" },
  { key: "marginRight", label: "Margin right", cssProp: "margin-right", kind: "css", group: "Spacing" },
  { key: "marginBottom", label: "Margin bottom", cssProp: "margin-bottom", kind: "css", group: "Spacing" },
  { key: "marginLeft", label: "Margin left", cssProp: "margin-left", kind: "css", group: "Spacing" },
  { key: "padding", label: "Padding", cssProp: "padding", kind: "css", group: "Spacing" },
  { key: "paddingTop", label: "Padding top", cssProp: "padding-top", kind: "css", group: "Spacing" },
  { key: "paddingRight", label: "Padding right", cssProp: "padding-right", kind: "css", group: "Spacing" },
  { key: "paddingBottom", label: "Padding bottom", cssProp: "padding-bottom", kind: "css", group: "Spacing" },
  { key: "paddingLeft", label: "Padding left", cssProp: "padding-left", kind: "css", group: "Spacing" },

  // Border -------------------------------------------------------------------
  { key: "borderRadius", label: "Border radius", cssProp: "border-radius", kind: "css", group: "Border" },

  // Layout -------------------------------------------------------------------
  {
    key: "display",
    label: "Display",
    cssProp: "display",
    kind: "select",
    group: "Layout",
    options: [SELECT_NONE, "block", "inline", "inline-block", "flex", "inline-flex", "grid", "none"],
  },
  {
    key: "position",
    label: "Position",
    cssProp: "position",
    kind: "select",
    group: "Layout",
    options: [SELECT_NONE, "static", "relative", "absolute", "fixed", "sticky"],
  },
  {
    key: "overflow",
    label: "Overflow",
    cssProp: "overflow",
    kind: "select",
    group: "Layout",
    options: [SELECT_NONE, "visible", "hidden", "scroll", "auto", "clip"],
  },
  {
    key: "visibility",
    label: "Visibility",
    cssProp: "visibility",
    kind: "select",
    group: "Layout",
    options: [SELECT_NONE, "visible", "hidden"],
  },
  { key: "zIndex", label: "Z-index", cssProp: "z-index", kind: "css", group: "Layout" },

  // Flex (for the item itself) ----------------------------------------------
  { key: "flexGrow", label: "Flex grow", cssProp: "flex-grow", kind: "css", group: "Flex" },
  { key: "flexShrink", label: "Flex shrink", cssProp: "flex-shrink", kind: "css", group: "Flex" },
  { key: "order", label: "Order", cssProp: "order", kind: "css", group: "Flex" },
  {
    key: "alignSelf",
    label: "Align self",
    cssProp: "align-self",
    kind: "select",
    group: "Flex",
    options: [SELECT_NONE, "auto", "flex-start", "center", "flex-end", "stretch", "baseline"],
  },

  // Typography (text nodes only) --------------------------------------------
  { key: "fontSize", label: "Font size", cssProp: "font-size", kind: "css", group: "Typography", textOnly: true },
  { key: "color", label: "Color", cssProp: "color", kind: "color", group: "Typography", textOnly: true },
  { key: "fontWeight", label: "Font weight", cssProp: "font-weight", kind: "css", group: "Typography", textOnly: true },
  { key: "lineHeight", label: "Line height", cssProp: "line-height", kind: "css", group: "Typography", textOnly: true },
  { key: "letterSpacing", label: "Letter spacing", cssProp: "letter-spacing", kind: "css", group: "Typography", textOnly: true },
  {
    key: "textAlign",
    label: "Text align",
    cssProp: "text-align",
    kind: "select",
    group: "Typography",
    options: [SELECT_NONE, "left", "center", "right", "justify"],
    textOnly: true,
  },
  {
    key: "fontStyle",
    label: "Font style",
    cssProp: "font-style",
    kind: "select",
    group: "Typography",
    options: [SELECT_NONE, "normal", "italic"],
    textOnly: true,
  },
  {
    key: "textTransform",
    label: "Text transform",
    cssProp: "text-transform",
    kind: "select",
    group: "Typography",
    options: [SELECT_NONE, "none", "uppercase", "lowercase", "capitalize"],
    textOnly: true,
  },
];

// Returns the descriptors grouped (in declaration order), filtered for the node
// type. Typography only appears for text nodes.
export function commonPropGroups(
  isText: boolean,
): Array<{ group: string; descriptors: CommonPropDescriptor[] }> {
  const groups: Array<{ group: string; descriptors: CommonPropDescriptor[] }> =
    [];
  for (const descriptor of COMMON_PROP_DESCRIPTORS) {
    if (descriptor.textOnly && !isText) continue;
    let entry = groups.find((g) => g.group === descriptor.group);
    if (!entry) {
      entry = { group: descriptor.group, descriptors: [] };
      groups.push(entry);
    }
    entry.descriptors.push(descriptor);
  }
  return groups;
}
