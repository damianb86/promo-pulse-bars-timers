import { describe, expect, it } from "vitest";

import { resolveInspectorComponent } from "./component-registry";
import { commonPropGroups } from "./common-props-registry";

describe("resolveInspectorComponent", () => {
  it("maps app-component slots to a reusable panel", () => {
    const timer = resolveInspectorComponent({
      tag: "div",
      attrs: { "data-cp-slot": "timer" },
    });
    expect(timer.label).toBe("Timer");
    expect(timer.panelTitle).toBe("Timer Style");
    expect(timer.isAppComponent).toBe(true);
    expect(timer.isText).toBe(false);
  });

  it("marks text slots/tags as text with no global panel", () => {
    const headline = resolveInspectorComponent({
      tag: "strong",
      attrs: { "data-cp-slot": "headline" },
    });
    expect(headline.isText).toBe(true);
    expect(headline.panelTitle).toBeUndefined();

    const heading = resolveInspectorComponent({ tag: "h2" });
    expect(heading).toMatchObject({
      label: "Heading",
      isText: true,
      isContainer: false,
      isAppComponent: false,
    });
  });

  it("marks containers and generic blocks", () => {
    expect(resolveInspectorComponent({ tag: "div" })).toMatchObject({
      label: "Container",
      isContainer: true,
      isText: false,
    });
    expect(resolveInspectorComponent({ tag: "img" }).label).toBe("Image");
    expect(resolveInspectorComponent({ tag: "weird" }).label).toBe("HTML Block");
  });
});

describe("commonPropGroups", () => {
  it("includes Typography only for text nodes", () => {
    const generic = commonPropGroups(false).map((g) => g.group);
    expect(generic).toContain("Size");
    expect(generic).toContain("Spacing");
    expect(generic).toContain("Flex");
    expect(generic).not.toContain("Typography");

    const text = commonPropGroups(true).map((g) => g.group);
    expect(text).toContain("Typography");
  });

  it("keeps values free-form (no px coercion in the registry)", () => {
    const size = commonPropGroups(false).find((g) => g.group === "Size");
    expect(size?.descriptors.every((d) => d.kind === "css")).toBe(true);
  });
});
