import { useEffect, type ReactNode } from "react";

import { CommonPropsForm } from "./CommonPropsForm";
import type { InspectorComponent } from "./component-registry";

// Modal opened when a component is clicked in the preview inspector. For app
// components it embeds the matching DesignControls panel (via renderPanel);
// every component also gets the shared common-properties form.
export function ComponentInspectorModal({
  component,
  nodeStyle,
  renderPanel,
  onApplyCommon,
  onClose,
}: {
  component: InspectorComponent;
  nodeStyle: string | undefined;
  // Renders the reused DesignControls panel for an app component (by title).
  renderPanel: (panelTitle: string) => ReactNode;
  onApplyCommon: (declarations: Record<string, string>) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="counterpulse-modal-backdrop">
      <button
        aria-label="Close"
        className="counterpulse-modal-backdrop__dismiss"
        tabIndex={-1}
        type="button"
        onClick={onClose}
      />
      <div
        aria-label={`Edit ${component.label}`}
        aria-modal="true"
        className="counterpulse-modal counterpulse-modal--html"
        role="dialog"
      >
        <div className="counterpulse-modal__header">
          <div>
            <p className="counterpulse-kicker">Component</p>
            <h2>{component.label}</h2>
          </div>
        </div>
        <div className="counterpulse-modal__body">
          {component.isAppComponent && component.panelTitle && (
            <div className="counterpulse-inspector-panel">
              {renderPanel(component.panelTitle)}
            </div>
          )}
          <CommonPropsForm style={nodeStyle} onApply={onApplyCommon} />
        </div>
        <div className="counterpulse-modal__actions">
          <button
            className="counterpulse-button"
            type="button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
