import { describe, expect, it } from "vitest";

import {
  calculateFreeShippingProgress,
  formatCurrencyAmount,
  interpolateFreeShippingText,
} from "./free-shipping";

describe("calculateFreeShippingProgress", () => {
  it("handles an empty cart", () => {
    expect(calculateFreeShippingProgress(75, 0)).toEqual({
      threshold: 75,
      cartSubtotal: 0,
      amountRemaining: 75,
      percentage: 0,
      unlocked: false,
    });
  });

  it("calculates progress below the threshold", () => {
    expect(calculateFreeShippingProgress(75, 30)).toMatchObject({
      amountRemaining: 45,
      percentage: 40,
      unlocked: false,
    });
  });

  it("unlocks when subtotal equals the threshold", () => {
    expect(calculateFreeShippingProgress(75, 75)).toMatchObject({
      amountRemaining: 0,
      percentage: 100,
      unlocked: true,
    });
  });

  it("caps progress when subtotal is greater than the threshold", () => {
    expect(calculateFreeShippingProgress(75, 120)).toMatchObject({
      amountRemaining: 0,
      percentage: 100,
      unlocked: true,
    });
  });
});

describe("free shipping currency text", () => {
  it("formats currency amounts", () => {
    expect(formatCurrencyAmount(45, "USD", "en-US")).toBe("$45.00");
  });

  it("interpolates supported amount placeholders", () => {
    expect(
      interpolateFreeShippingText(
        "You're {{remaining_amount}} away from free shipping",
        "$45.00",
      ),
    ).toBe("You're $45.00 away from free shipping");
    expect(
      interpolateFreeShippingText("Add {{remaining_amount}} more", "$45.00"),
    ).toBe("Add $45.00 more");
    // Aliases are gone — old tokens are left untouched.
    expect(
      interpolateFreeShippingText("You're {{amount}} away", "$45.00"),
    ).toBe("You're {{amount}} away");
  });
});
