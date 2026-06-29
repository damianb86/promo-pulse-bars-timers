import { describe, expect, it } from "vitest";

import {
  MESSAGE_VARIABLES,
  describeMessageVariablesForAi,
  messageVariablesForType,
} from "./message-variables";
import {
  buildFreeShippingVariables,
  calculateFreeShippingProgress,
} from "../lib/free-shipping";

describe("message variable catalog", () => {
  it("has no aliases (each concept appears once)", () => {
    const tokens = MESSAGE_VARIABLES.map((variable) => variable.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    // The removed aliases must not be present.
    for (const alias of ["amount", "remaining", "count", "time_remaining"]) {
      expect(tokens).not.toContain(alias);
    }
  });

  it("includes the new useful variables", () => {
    const tokens = MESSAGE_VARIABLES.map((variable) => variable.token);
    for (const added of [
      "cart_subtotal",
      "threshold_amount",
      "progress_percent",
      "remaining_percent",
      "month",
      "weekday",
      "date",
      "time",
      "days_left",
      "hours_left",
      "minutes_left",
      "seconds_left",
    ]) {
      expect(tokens).toContain(added);
    }
  });

  it("scopes variables to the campaign type", () => {
    const free = messageVariablesForType("FREE_SHIPPING_GOAL").map(
      (variable) => variable.token,
    );
    expect(free).toContain("remaining_amount");
    expect(free).not.toContain("quantity");

    const low = messageVariablesForType("LOW_STOCK").map(
      (variable) => variable.token,
    );
    expect(low).toContain("quantity");
    expect(low).not.toContain("remaining_amount");
  });

  it("describes the variables for the AI without aliases", () => {
    const text = describeMessageVariablesForAi();
    expect(text).toContain("{{remaining_amount}}");
    expect(text).toContain("{{progress_percent}}");
    expect(text).not.toContain("{{amount}}");
  });
});

describe("buildFreeShippingVariables", () => {
  it("computes the canonical free-shipping tokens", () => {
    const progress = calculateFreeShippingProgress(100, 62);
    const vars = buildFreeShippingVariables(progress, "USD", "en-US");
    expect(vars.remaining_amount).toBe("$38.00");
    expect(vars.cart_subtotal).toBe("$62.00");
    expect(vars.threshold_amount).toBe("$100.00");
    expect(vars.progress_percent).toBe("62%");
    expect(vars.remaining_percent).toBe("38%");
    // No aliases.
    expect(vars.amount).toBeUndefined();
    expect(vars.remaining).toBeUndefined();
  });
});
