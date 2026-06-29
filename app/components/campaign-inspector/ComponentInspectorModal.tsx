import { useEffect, useState, type ReactNode } from "react";

import { CommonPropsForm } from "./CommonPropsForm";
import { pickAndResolveShopifyFile } from "../DesignControls";
import type { InspectorComponent } from "./component-registry";

// Modal opened when a component is clicked in the preview inspector. Layout:
//   1. Common (per-node CSS) properties — always, first.
//   2. The component's own panel — app components reuse their DesignControls
//      panel; the root structural container reuses the "Card" panel.
// Generic elements only get the common properties.
export function ComponentInspectorModal({
  component,
  isRoot,
  nodeStyle,
  isImage,
  imageSrc,
  imageAlt,
  renderPanel,
  onApplyCommon,
  onChangeAttr,
  onClose,
}: {
  component: InspectorComponent;
  // True when the selected node is the campaign's root surface (gets the Card
  // panel as the high-level container/wrapper).
  isRoot: boolean;
  nodeStyle: string | undefined;
  isImage: boolean;
  imageSrc: string;
  imageAlt: string;
  // Renders the reused DesignControls panel (by title).
  renderPanel: (panelTitle: string) => ReactNode;
  onApplyCommon: (declarations: Record<string, string>) => void;
  onChangeAttr: (name: string, value: string) => void;
  onClose: () => void;
}) {
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const browseShopifyImage = async () => {
    setPickError(null);
    setPicking(true);
    try {
      const file = await pickAndResolveShopifyFile("background");
      if (file) onChangeAttr("src", file.url);
    } catch (error) {
      setPickError(
        error instanceof Error ? error.message : "Could not open the picker.",
      );
    } finally {
      setPicking(false);
    }
  };

  // The Card panel only applies to the high-level container (the root surface).
  const showCard = isRoot && component.isContainer;

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
          <div className="counterpulse-inspector-panels">
            {/* 1. Common properties, first. */}
            <CommonPropsForm
              style={nodeStyle}
              isText={component.isText}
              onApply={onApplyCommon}
            />

            {/* Image source (with Shopify library picker) for <img> nodes. */}
            {isImage && (
              <section className="counterpulse-design-card counterpulse-inspector-card">
                <h3>
                  <span>Image</span>
                </h3>
                {imageSrc && (
                  <img
                    alt=""
                    className="counterpulse-inspector-image-preview"
                    src={imageSrc}
                  />
                )}
                <label className="counterpulse-form-field counterpulse-design-control-field">
                  <span className="counterpulse-card-field__label">
                    <span className="counterpulse-design-field-title">
                      Image URL
                    </span>
                  </span>
                  <input
                    placeholder="https://…"
                    type="text"
                    value={imageSrc}
                    onChange={(event) => onChangeAttr("src", event.target.value)}
                  />
                </label>
                <label className="counterpulse-form-field counterpulse-design-control-field">
                  <span className="counterpulse-card-field__label">
                    <span className="counterpulse-design-field-title">
                      Alt text
                    </span>
                  </span>
                  <input
                    type="text"
                    value={imageAlt}
                    onChange={(event) => onChangeAttr("alt", event.target.value)}
                  />
                </label>
                <button
                  className="counterpulse-button-secondary"
                  disabled={picking}
                  type="button"
                  onClick={browseShopifyImage}
                >
                  {picking ? "Opening…" : "Browse Shopify library"}
                </button>
                {pickError && (
                  <p className="counterpulse-form-error">{pickError}</p>
                )}
              </section>
            )}

            {/* 2. Component-specific settings (reused panels). */}
            {component.isAppComponent && component.panelTitle
              ? renderPanel(component.panelTitle)
              : null}
            {showCard ? renderPanel("Card") : null}
          </div>
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
