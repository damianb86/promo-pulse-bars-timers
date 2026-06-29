import { useMemo } from "react";

import { parseStyle } from "../../utils/campaign-structure";
import {
  commonPropGroups,
  type CommonPropDescriptor,
} from "./common-props-registry";

// Per-node CSS editor (the shared "common properties"). Reads the node's inline
// `style` and emits CSS declarations to merge back via the AST
// (`updateNodeStyle`). Each group renders as a design card so it matches the
// other modal panels. Values are free-form, so any valid CSS value works.
export function CommonPropsForm({
  style,
  isText,
  onApply,
}: {
  // Current inline style string of the node.
  style: string | undefined;
  // Whether the node is a text element (adds the Typography group).
  isText: boolean;
  // Apply a CSS declaration map ({ "min-width": "120px" }; "" removes it).
  onApply: (declarations: Record<string, string>) => void;
}) {
  const current = useMemo(() => parseStyle(style), [style]);
  const groups = useMemo(() => commonPropGroups(isText), [isText]);

  const renderField = (descriptor: CommonPropDescriptor) => {
    const value = current[descriptor.cssProp] ?? "";
    const apply = (next: string) =>
      onApply({ [descriptor.cssProp]: next });

    if (descriptor.kind === "select") {
      return (
        <label key={descriptor.key} className="counterpulse-form-field">
          <span>{descriptor.label}</span>
          <select
            value={value}
            onChange={(event) => apply(event.target.value)}
          >
            {(descriptor.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option === "" ? "Not set" : option}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (descriptor.kind === "color") {
      return (
        <label key={descriptor.key} className="counterpulse-form-field">
          <span>{descriptor.label}</span>
          <div className="counterpulse-inspector-color">
            <input
              aria-label={`${descriptor.label} swatch`}
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
              onChange={(event) => apply(event.target.value)}
            />
            <input
              placeholder="inherit"
              type="text"
              value={value}
              onChange={(event) => apply(event.target.value)}
            />
          </div>
        </label>
      );
    }

    // Free-form CSS value (length, number, keyword, …).
    return (
      <label key={descriptor.key} className="counterpulse-form-field">
        <span>{descriptor.label}</span>
        <input
          placeholder="auto"
          type="text"
          value={value}
          onChange={(event) => apply(event.target.value)}
        />
      </label>
    );
  };

  return (
    <>
      {groups.map((group) => (
        <section
          key={group.group}
          className="counterpulse-design-card counterpulse-inspector-card"
        >
          <h3>
            <span>{group.group}</span>
          </h3>
          <div className="counterpulse-form-grid counterpulse-form-grid--wide">
            {group.descriptors.map(renderField)}
          </div>
        </section>
      ))}
    </>
  );
}
