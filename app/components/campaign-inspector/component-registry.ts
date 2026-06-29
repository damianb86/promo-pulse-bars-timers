import { getNodeSlot, type StructureNode } from "../../utils/campaign-structure";

// Resolves a structural AST node to a component descriptor for the inspector.
// App components (identified by their data-cp-slot) expose `panelTitle` so the
// modal can reuse the matching DesignControls panel. Generic HTML nodes only get
// a friendly label (and only the common properties in the modal).
export type InspectorComponent = {
  // Friendly title shown in the modal (Timer, Button, Container, ...).
  label: string;
  // DesignControls panel title to reuse for an app component, if any.
  panelTitle?: string;
  // True for app-owned components (have a settings panel), false for generic HTML.
  isAppComponent: boolean;
};

// data-cp-slot -> app component descriptor.
const SLOT_COMPONENTS: Record<
  string,
  { label: string; panelTitle?: string }
> = {
  timer: { label: "Timer", panelTitle: "Timer Style" },
  "timer-inline": { label: "Timer", panelTitle: "Timer Style" },
  progress: { label: "Progress bar", panelTitle: "Progress" },
  offer: { label: "Discount code", panelTitle: "Offer code" },
  icon: { label: "Icon", panelTitle: "Elements" },
  close: { label: "Close button", panelTitle: "Elements" },
  cta: { label: "Button", panelTitle: "Elements" },
  headline: { label: "Headline", panelTitle: "Typography" },
  body: { label: "Text", panelTitle: "Typography" },
  "badge-text": { label: "Badge", panelTitle: "Typography" },
};

// Tag -> generic label (no settings panel).
const TAG_LABELS: Record<string, string> = {
  section: "Section",
  div: "Container",
  span: "Text",
  p: "Text",
  strong: "Text",
  small: "Text",
  h1: "Heading",
  h2: "Heading",
  h3: "Heading",
  h4: "Heading",
  h5: "Heading",
  h6: "Heading",
  img: "Image",
  picture: "Image",
  a: "Link",
  button: "Button",
  ul: "List",
  ol: "List",
  li: "List item",
  table: "Table",
  figure: "Figure",
  svg: "Icon",
};

export function resolveInspectorComponent(
  node: StructureNode,
): InspectorComponent {
  const slot = getNodeSlot(node);
  if (slot && SLOT_COMPONENTS[slot]) {
    const entry = SLOT_COMPONENTS[slot];
    return {
      label: entry.label,
      panelTitle: entry.panelTitle,
      isAppComponent: true,
    };
  }
  return {
    label: TAG_LABELS[node.tag] ?? "HTML Block",
    isAppComponent: false,
  };
}
