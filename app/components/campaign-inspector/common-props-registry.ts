// Common properties applied to ANY inspected node (app component or generic HTML)
// as inline CSS on the node. Adding a new shared property is a one-line entry
// here — no per-component changes. The inspector reads/writes these against the
// node's `style` via the AST helpers (parseStyle / setNodeStyleAtPath).

export type CommonPropKind = "length";

export type CommonPropDescriptor = {
  // Stable key (also the form field name).
  key: string;
  // Label shown in the form.
  label: string;
  // The CSS property written to the node's inline style.
  cssProp: string;
  kind: CommonPropKind;
  // Optional group, so future props (Spacing, Layout, Position, ...) can be
  // rendered under headings without restructuring.
  group: string;
};

// v1: sizing. Future props (margin, padding, border-radius, visibility,
// alignment, flex-grow/shrink, order, overflow, z-index, display, position) slot
// in here under their group with the right kind.
export const COMMON_PROP_DESCRIPTORS: CommonPropDescriptor[] = [
  {
    key: "minWidth",
    label: "Min width",
    cssProp: "min-width",
    kind: "length",
    group: "Size",
  },
  {
    key: "maxWidth",
    label: "Max width",
    cssProp: "max-width",
    kind: "length",
    group: "Size",
  },
  {
    key: "minHeight",
    label: "Min height",
    cssProp: "min-height",
    kind: "length",
    group: "Size",
  },
  {
    key: "maxHeight",
    label: "Max height",
    cssProp: "max-height",
    kind: "length",
    group: "Size",
  },
];

// Parses a stored CSS length (e.g. "120px") into a number for the form, or "".
export function parseLengthValue(value: string | undefined): string {
  if (!value) return "";
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match ? match[1] : value.trim();
}

// Serializes a form value back to a CSS length. Bare numbers become px; empty
// clears the declaration.
export function toLengthCss(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^-?\d+(?:\.\d+)?$/.test(trimmed) ? `${trimmed}px` : trimmed;
}
