import { describe, expect, it } from "vitest";

import { resolveInspectorComponent } from "./component-registry";
import { parseLengthValue, toLengthCss } from "./common-props-registry";

describe("resolveInspectorComponent", () => {
  it("maps app-component slots to a labeled panel", () => {
    const timer = resolveInspectorComponent({
      tag: "div",
      attrs: { "data-cp-slot": "timer" },
    });
    expect(timer).toEqual({
      label: "Timer",
      panelTitle: "Timer Style",
      isAppComponent: true,
    });

    const progress = resolveInspectorComponent({
      tag: "div",
      attrs: { "data-cp-slot": "progress" },
    });
    expect(progress.panelTitle).toBe("Progress");
    expect(progress.isAppComponent).toBe(true);
  });

  it("maps generic tags to a friendly label without a panel", () => {
    expect(resolveInspectorComponent({ tag: "div" })).toEqual({
      label: "Container",
      isAppComponent: false,
    });
    expect(resolveInspectorComponent({ tag: "img" }).label).toBe("Image");
    expect(resolveInspectorComponent({ tag: "h2" }).label).toBe("Heading");
    expect(resolveInspectorComponent({ tag: "weird" }).label).toBe("HTML Block");
  });
});

describe("common-prop length helpers", () => {
  it("parses px lengths to bare numbers and keeps others", () => {
    expect(parseLengthValue("120px")).toBe("120");
    expect(parseLengthValue(undefined)).toBe("");
    expect(parseLengthValue("50%")).toBe("50%");
  });

  it("serializes bare numbers to px and clears empty", () => {
    expect(toLengthCss("120")).toBe("120px");
    expect(toLengthCss("")).toBe("");
    expect(toLengthCss("50%")).toBe("50%");
  });
});
