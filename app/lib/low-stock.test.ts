import { describe, expect, it } from "vitest";

import { buildLowStockMessage } from "./low-stock";

describe("buildLowStockMessage", () => {
  it("returns fallback without inventing quantity when inventory is unavailable", () => {
    expect(
      buildLowStockMessage(
        { threshold: 5, showExactQuantity: true, fallbackMessage: "Low stock" },
        null,
        "Only {{quantity}} left.",
      ),
    ).toBe("Low stock");
  });

  it("returns null when inventory is unavailable and no fallback is configured", () => {
    expect(
      buildLowStockMessage(
        { threshold: 5, showExactQuantity: true, fallbackMessage: "" },
        undefined,
        "Only {{quantity}} left.",
      ),
    ).toBeNull();
  });

  it("does not render when inventory is above threshold", () => {
    expect(
      buildLowStockMessage(
        { threshold: 5, showExactQuantity: true, fallbackMessage: "Low stock" },
        8,
        "Only {{quantity}} left.",
      ),
    ).toBeNull();
  });

  it("interpolates exact quantity when enabled", () => {
    expect(
      buildLowStockMessage(
        { threshold: 5, showExactQuantity: true, fallbackMessage: "Low stock" },
        3,
        "Only {{quantity}} left.",
      ),
    ).toBe("Only 3 left.");
  });

  it("uses a generic message when exact quantity is disabled", () => {
    expect(
      buildLowStockMessage(
        {
          threshold: 5,
          showExactQuantity: false,
          fallbackMessage: "Low stock",
        },
        3,
        "Only {{quantity}} left.",
      ),
    ).toBe("Low stock");
  });

  it("does not show an exact quantity for zero inventory", () => {
    expect(
      buildLowStockMessage(
        { threshold: 5, showExactQuantity: true, fallbackMessage: "Low stock" },
        0,
        "Only {{quantity}} left.",
      ),
    ).toBe("Low stock");
  });
});
