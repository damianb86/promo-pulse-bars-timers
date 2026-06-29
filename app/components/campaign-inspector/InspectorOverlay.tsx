import { useEffect, useState, type RefObject } from "react";

type Rect = { top: number; left: number; width: number; height: number };

// Visual inspector overlay: highlights the most specific component under the
// cursor with a dotted border and opens its editor on click. Purely visual — it
// reads `data-cp-node` paths the preview renders and never mutates layout.
export function InspectorOverlay({
  containerRef,
  enabled,
  onSelect,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  onSelect: (path: string) => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) {
      setRect(null);
      return;
    }

    const findNode = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>("[data-cp-node]");
    };

    // Highlight rect relative to the container. For `display: contents` wrappers
    // (app-component slots) the wrapper has no box, so fall back to the actual
    // hovered element's rect.
    const rectFor = (node: HTMLElement, target: EventTarget | null): Rect => {
      const base = container.getBoundingClientRect();
      let box = node.getBoundingClientRect();
      if ((box.width === 0 || box.height === 0) && target instanceof Element) {
        box = target.getBoundingClientRect();
      }
      return {
        top: box.top - base.top,
        left: box.left - base.left,
        width: box.width,
        height: box.height,
      };
    };

    const handleMove = (event: MouseEvent) => {
      const node = findNode(event.target);
      setRect(node ? rectFor(node, event.target) : null);
    };
    const handleLeave = () => setRect(null);
    const handleClick = (event: MouseEvent) => {
      const node = findNode(event.target);
      if (!node) return;
      event.preventDefault();
      event.stopPropagation();
      onSelect(node.getAttribute("data-cp-node") ?? "");
    };

    container.addEventListener("mousemove", handleMove);
    container.addEventListener("mouseleave", handleLeave);
    // Capture phase so links/buttons in the preview don't swallow the click.
    container.addEventListener("click", handleClick, true);
    return () => {
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("mouseleave", handleLeave);
      container.removeEventListener("click", handleClick, true);
    };
  }, [containerRef, enabled, onSelect]);

  if (!enabled || !rect) return null;

  return (
    <div
      aria-hidden="true"
      className="counterpulse-inspector-highlight"
      style={{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
    />
  );
}
