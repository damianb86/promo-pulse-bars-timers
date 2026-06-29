import { useMemo } from "react";

import { parseStyle } from "../../utils/campaign-structure";
import {
  COMMON_PROP_DESCRIPTORS,
  parseLengthValue,
  toLengthCss,
} from "./common-props-registry";

// Edits the shared properties (Min/Max Width/Height, future spacing/layout/…)
// of any inspected node. Reads the node's current inline `style` and emits CSS
// declarations to merge back via the AST (`updateNodeStyle`). Generic over the
// descriptor registry so new common props need no changes here.
export function CommonPropsForm({
  style,
  onApply,
}: {
  // Current inline style string of the node.
  style: string | undefined;
  // Apply a CSS declaration map ({ "min-width": "120px", ... }; "" removes it).
  onApply: (declarations: Record<string, string>) => void;
}) {
  const current = useMemo(() => parseStyle(style), [style]);

  // Group descriptors so future props render under headings.
  const groups = useMemo(() => {
    const byGroup = new Map<string, typeof COMMON_PROP_DESCRIPTORS>();
    for (const descriptor of COMMON_PROP_DESCRIPTORS) {
      const list = byGroup.get(descriptor.group) ?? [];
      list.push(descriptor);
      byGroup.set(descriptor.group, list);
    }
    return Array.from(byGroup.entries());
  }, []);

  return (
    <div className="counterpulse-inspector-common">
      {groups.map(([group, descriptors]) => (
        <div key={group} className="counterpulse-inspector-common__group">
          <p className="counterpulse-kicker">{group}</p>
          <div className="counterpulse-form-grid counterpulse-form-grid--wide">
            {descriptors.map((descriptor) => (
              <label
                key={descriptor.key}
                className="counterpulse-form-field"
              >
                <span>{descriptor.label}</span>
                <input
                  inputMode="numeric"
                  placeholder="auto"
                  type="text"
                  value={parseLengthValue(current[descriptor.cssProp])}
                  onChange={(event) =>
                    onApply({
                      [descriptor.cssProp]: toLengthCss(event.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
