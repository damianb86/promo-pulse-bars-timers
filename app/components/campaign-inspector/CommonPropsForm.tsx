import { useMemo, useState } from "react";

import { parseStyle } from "../../utils/campaign-structure";
import {
  COMMON_PROP_DESCRIPTORS,
  commonPropGroups,
  type CommonPropDescriptor,
} from "./common-props-registry";

// CSS properties already covered by the structured fields — everything else in
// the node's inline style is treated as a free-form custom declaration.
const KNOWN_CSS_PROPS = new Set(
  COMMON_PROP_DESCRIPTORS.map((descriptor) => descriptor.cssProp),
);

// Per-node CSS editor (the shared "common properties"). One collapsible panel
// (collapsed by default, slides down on click) holding every group separated by
// titles. Fields reuse the design-control classes so padding/borders/icons match
// the rest of the editor, and the grid fits up to ~6 related fields per row.
export function CommonPropsForm({
  style,
  isText,
  onApply,
}: {
  style: string | undefined;
  isText: boolean;
  onApply: (declarations: Record<string, string>) => void;
}) {
  const current = useMemo(() => parseStyle(style), [style]);
  const [open, setOpen] = useState(false);
  const setCount = Object.keys(current).length;

  // Free-form declarations that are not one of the structured fields above.
  const customEntries = useMemo(
    () =>
      Object.entries(current).filter(([prop]) => !KNOWN_CSS_PROPS.has(prop)),
    [current],
  );
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const normalizeProp = (prop: string) =>
    prop.trim().toLowerCase().replace(/\s+/g, "-");

  const addCustom = () => {
    const prop = normalizeProp(newKey);
    const value = newValue.trim();
    if (!prop || !value) return;
    onApply({ [prop]: value });
    setNewKey("");
    setNewValue("");
  };

  // Load a chip back into the editor inputs (and drop it) so it can be edited.
  const editCustom = (prop: string, value: string) => {
    setNewKey(prop);
    setNewValue(value);
    onApply({ [prop]: "" });
  };

  // Flex item props only make sense when the element is a flex container, so the
  // Flex group is hidden unless display is flex / inline-flex.
  const isFlex =
    current.display === "flex" || current.display === "inline-flex";
  const groups = useMemo(
    () =>
      commonPropGroups(isText).filter(
        (group) => group.group !== "Flex" || isFlex,
      ),
    [isText, isFlex],
  );

  const renderControl = (descriptor: CommonPropDescriptor) => {
    const value = current[descriptor.cssProp] ?? "";
    const apply = (next: string) => onApply({ [descriptor.cssProp]: next });

    if (descriptor.kind === "color") {
      return (
        <span className="counterpulse-card-color-control counterpulse-design-color-control">
          <span className="counterpulse-card-color-control__swatch">
            <input
              aria-label={`${descriptor.label} color`}
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
              onChange={(event) => apply(event.target.value)}
            />
          </span>
          <input
            placeholder="inherit"
            value={value}
            onChange={(event) => apply(event.target.value)}
          />
          <span className="counterpulse-card-color-control__picker" aria-hidden="true">
            <GroupIcon kind="Typography" />
          </span>
        </span>
      );
    }

    return (
      <span className="counterpulse-card-number-control counterpulse-design-number-control">
        <span className="counterpulse-card-number-control__icon" aria-hidden="true">
          <GroupIcon kind={descriptor.group} />
        </span>
        {descriptor.kind === "select" ? (
          <select value={value} onChange={(event) => apply(event.target.value)}>
            {(descriptor.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option === "" ? "Not set" : option}
              </option>
            ))}
          </select>
        ) : (
          <input
            placeholder="auto"
            type="text"
            value={value}
            onChange={(event) => apply(event.target.value)}
          />
        )}
        <button
          aria-label={`Clear ${descriptor.label}`}
          className="counterpulse-card-number-control__unit counterpulse-inspector-clear"
          disabled={!value}
          tabIndex={-1}
          type="button"
          onClick={() => apply("")}
        >
          {value ? "×" : ""}
        </button>
      </span>
    );
  };

  return (
    <section className="counterpulse-design-card counterpulse-inspector-card counterpulse-inspector-collapsible">
      <button
        aria-expanded={open}
        className="counterpulse-inspector-collapsible__header"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="counterpulse-inspector-collapsible__title">
          <GroupIcon kind="Size" />
          <span>Layout &amp; style</span>
          {setCount > 0 && (
            <span className="counterpulse-inspector-badge">{setCount}</span>
          )}
        </span>
        <span
          className={
            open
              ? "counterpulse-inspector-chevron is-open"
              : "counterpulse-inspector-chevron"
          }
          aria-hidden="true"
        >
          <ChevronIcon />
        </span>
      </button>
      <div
        className="counterpulse-inspector-collapsible__body"
        data-open={open ? "true" : "false"}
      >
        <div className="counterpulse-inspector-collapsible__inner">
          {groups.map((group) => (
            <div key={group.group} className="counterpulse-inspector-group">
              <p className="counterpulse-inspector-group__title">
                <GroupIcon kind={group.group} />
                <span>{group.group}</span>
              </p>
              <div className="counterpulse-inspector-grid">
                {group.descriptors.map((descriptor) => (
                  <label
                    key={descriptor.key}
                    className="counterpulse-form-field counterpulse-design-control-field"
                  >
                    <span className="counterpulse-card-field__label">
                      <span className="counterpulse-design-field-title">
                        {descriptor.label}
                      </span>
                    </span>
                    {renderControl(descriptor)}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Free-form CSS declarations: add one Key:Value at a time. Existing
              ones show as chips that can be edited (loaded back into the inputs)
              or removed. */}
          <div className="counterpulse-inspector-group">
            <p className="counterpulse-inspector-group__title">
              <GroupIcon kind="Custom" />
              <span>Custom CSS</span>
            </p>

            {customEntries.length > 0 && (
              <div className="counterpulse-inspector-chips">
                {customEntries.map(([prop, value]) => (
                  <span key={prop} className="counterpulse-inspector-chip">
                    <button
                      className="counterpulse-inspector-chip__edit"
                      title={`Edit ${prop}`}
                      type="button"
                      onClick={() => editCustom(prop, value)}
                    >
                      <span className="counterpulse-inspector-chip__prop">
                        {prop}
                      </span>
                      <span className="counterpulse-inspector-chip__sep">:</span>
                      <span className="counterpulse-inspector-chip__value">
                        {value}
                      </span>
                    </button>
                    <button
                      aria-label={`Remove ${prop}`}
                      className="counterpulse-inspector-chip__remove"
                      type="button"
                      onClick={() => onApply({ [prop]: "" })}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="counterpulse-inspector-custom-add">
              <input
                aria-label="Custom property"
                className="counterpulse-inspector-custom-add__key"
                placeholder="property (e.g. box-shadow)"
                type="text"
                value={newKey}
                onChange={(event) => setNewKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustom();
                  }
                }}
              />
              <input
                aria-label="Custom value"
                className="counterpulse-inspector-custom-add__value"
                placeholder="value (e.g. 0 2px 8px rgba(0,0,0,.2))"
                type="text"
                value={newValue}
                onChange={(event) => setNewValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustom();
                  }
                }}
              />
              <button
                className="counterpulse-inspector-custom-add__button"
                disabled={!newKey.trim() || !newValue.trim()}
                type="button"
                onClick={addCustom}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path
        d="m7 10 5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Small icon per group/field so titles + controls have icons like the rest of
// the design editor.
function GroupIcon({ kind }: { kind: string }) {
  const common = { viewBox: "0 0 24 24", focusable: false, "aria-hidden": true };
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "Custom":
      return (
        <svg {...common}>
          <path d="M9 8 5 12l4 4M15 8l4 4-4 4M13 5l-2 14" {...stroke} />
        </svg>
      );
    case "Spacing":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" {...stroke} />
          <rect x="8" y="8" width="8" height="8" rx="1" {...stroke} />
        </svg>
      );
    case "Border":
      return (
        <svg {...common}>
          <path d="M5 11V7a2 2 0 0 1 2-2h4" {...stroke} />
          <rect x="11" y="11" width="9" height="9" rx="2" {...stroke} />
        </svg>
      );
    case "Layout":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="6" rx="1" {...stroke} />
          <rect x="3" y="14" width="11" height="6" rx="1" {...stroke} />
        </svg>
      );
    case "Flex":
      return (
        <svg {...common}>
          <path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" {...stroke} />
        </svg>
      );
    case "Typography":
      return (
        <svg {...common}>
          <path d="M6 18 10 6l4 12M7.5 14h5M16 18h3" {...stroke} />
        </svg>
      );
    default:
      // Size
      return (
        <svg {...common}>
          <path d="M4 20 20 4M4 9V4h5M15 20h5v-5" {...stroke} />
        </svg>
      );
  }
}
