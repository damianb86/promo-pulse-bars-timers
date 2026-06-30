import { getNodeSlot, type StructureNode } from "../../utils/campaign-structure";

// Resolves a structural AST node to a component descriptor for the inspector.
// App components (identified by data-cp-slot) expose `panelTitle` so the modal
// reuses the matching DesignControls panel (their real, non-CSS settings). Text
// nodes get `isText` so the modal shows the per-node Typography group. Generic
// HTML nodes only get a friendly label + the common (CSS) properties.
export type InspectorComponent = {
  label: string;
  // DesignControls panel title to reuse for an app component, if any.
  panelTitle?: string;
  isAppComponent: boolean;
  // Text element → the per-node Typography group is shown.
  isText: boolean;
  // Structural container (section/div) → eligible for the Card panel when it is
  // the root surface (decided with the node path in the modal).
  isContainer: boolean;
};

// data-cp-slot -> app component descriptor.
const SLOT_COMPONENTS: Record<
  string,
  { label: string; panelTitle?: string; isText?: boolean }
> = {
  timer: { label: "Timer", panelTitle: "Timer Style" },
  "timer-inline": { label: "Timer", panelTitle: "Timer Style" },
  "timer-days": { label: "Timer · days", panelTitle: "Timer Style" },
  "timer-hours": { label: "Timer · hours", panelTitle: "Timer Style" },
  "timer-minutes": { label: "Timer · minutes", panelTitle: "Timer Style" },
  "timer-seconds": { label: "Timer · seconds", panelTitle: "Timer Style" },
  progress: { label: "Progress bar", panelTitle: "Progress" },
  offer: { label: "Discount code", panelTitle: "Offer code" },
  icon: { label: "Icon", panelTitle: "Elements" },
  close: { label: "Close button", panelTitle: "Elements" },
  cta: { label: "Button", panelTitle: "Elements" },
  headline: { label: "Headline", isText: true },
  body: { label: "Text", isText: true },
  "badge-text": { label: "Badge", isText: true },
};

// Tag -> { label, isText, isContainer }.
const TAG_INFO: Record<
  string,
  { label: string; isText?: boolean; isContainer?: boolean }
> = {
  section: { label: "Section", isContainer: true },
  div: { label: "Container", isContainer: true },
  article: { label: "Container", isContainer: true },
  aside: { label: "Container", isContainer: true },
  header: { label: "Container", isContainer: true },
  footer: { label: "Container", isContainer: true },
  span: { label: "Text", isText: true },
  p: { label: "Text", isText: true },
  strong: { label: "Text", isText: true },
  em: { label: "Text", isText: true },
  small: { label: "Text", isText: true },
  label: { label: "Text", isText: true },
  h1: { label: "Heading", isText: true },
  h2: { label: "Heading", isText: true },
  h3: { label: "Heading", isText: true },
  h4: { label: "Heading", isText: true },
  h5: { label: "Heading", isText: true },
  h6: { label: "Heading", isText: true },
  img: { label: "Image" },
  picture: { label: "Image" },
  a: { label: "Link", isText: true },
  button: { label: "Button" },
  ul: { label: "List", isContainer: true },
  ol: { label: "List", isContainer: true },
  li: { label: "List item" },
  table: { label: "Table" },
  figure: { label: "Figure", isContainer: true },
  svg: { label: "Icon" },
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
      isText: Boolean(entry.isText),
      isContainer: false,
    };
  }
  const info = TAG_INFO[node.tag] ?? { label: "HTML Block" };
  return {
    label: info.label,
    isAppComponent: false,
    isText: Boolean(info.isText),
    isContainer: Boolean(info.isContainer),
  };
}
