import { useMemo, useState } from "react";

import { parseStyle } from "../../utils/campaign-structure";

// Per-node CSS editor (the shared "common properties"). One collapsible panel
// (collapsed by default, slides down on click) exposing every inline-style
// declaration as free-form Custom CSS. Fields reuse the design-control classes
// so padding/borders/icons match the rest of the editor.
export function CommonPropsForm({
  style,
  onApply,
}: {
  style: string | undefined;
  onApply: (declarations: Record<string, string>) => void;
}) {
  const current = useMemo(() => parseStyle(style), [style]);
  const [open, setOpen] = useState(false);

  // Every declaration on the node is editable as a custom entry.
  const customEntries = useMemo(() => Object.entries(current), [current]);
  const setCount = customEntries.length;

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  // The property being edited (so renaming it removes the original chip).
  const [editingProp, setEditingProp] = useState<string | null>(null);

  const normalizeProp = (prop: string) =>
    prop.trim().toLowerCase().replace(/\s+/g, "-");

  const addCustom = () => {
    const prop = normalizeProp(newKey);
    const value = newValue.trim();
    if (!prop || !value) return;
    // When the property was renamed, drop the original declaration too.
    const declarations: Record<string, string> =
      editingProp && editingProp !== prop
        ? { [editingProp]: "", [prop]: value }
        : { [prop]: value };
    onApply(declarations);
    setNewKey("");
    setNewValue("");
    setEditingProp(null);
  };

  // Load a chip back into the editor inputs so it can be edited. The chip stays
  // in place until the edit is re-applied, so nothing is lost mid-edit.
  const editCustom = (prop: string, value: string) => {
    setNewKey(prop);
    setNewValue(value);
    setEditingProp(prop);
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
          <GroupIcon kind="Custom" />
          <span>Custom CSS</span>
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
