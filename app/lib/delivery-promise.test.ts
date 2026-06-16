import { describe, expect, it } from "vitest";

import {
  calculateDeliveryPromise,
  formatDeliveryPromiseMessage,
} from "./delivery-promise";

const baseSettings = {
  cutoffHour: 17,
  cutoffMinute: 0,
  timezone: "UTC",
  processingDays: 0,
  minDeliveryDays: 2,
  maxDeliveryDays: 4,
  workingDays: [1, 2, 3, 4, 5],
  holidays: [],
  afterCutoffBehavior: "SHOW_NEXT_WINDOW",
} as const;

describe("calculateDeliveryPromise", () => {
  it("calculates a promise before cutoff", () => {
    const promise = calculateDeliveryPromise(
      baseSettings,
      new Date("2026-06-15T14:45:30.000Z"),
      "en-US",
    );

    expect(promise.beforeCutoff).toBe(true);
    expect(promise.timeRemainingMs).toBe(8_070_000);
    expect(promise.shipsDate.toISOString().slice(0, 10)).toBe("2026-06-15");
  });

  it("calculates the next shipping window after cutoff", () => {
    const promise = calculateDeliveryPromise(
      baseSettings,
      new Date("2026-06-15T18:00:00.000Z"),
      "en-US",
    );

    expect(promise.beforeCutoff).toBe(false);
    expect(promise.timeRemainingMs).toBe(0);
    expect(promise.shipsDate.toISOString().slice(0, 10)).toBe("2026-06-16");
  });

  it("moves Friday after cutoff to Monday for Monday-Friday working days", () => {
    const promise = calculateDeliveryPromise(
      baseSettings,
      new Date("2026-06-19T18:00:00.000Z"),
      "en-US",
    );

    expect(promise.shipsDate.toISOString().slice(0, 10)).toBe("2026-06-22");
  });

  it("skips holidays", () => {
    const promise = calculateDeliveryPromise(
      {
        ...baseSettings,
        holidays: ["2026-06-16"],
      },
      new Date("2026-06-15T18:00:00.000Z"),
      "en-US",
    );

    expect(promise.shipsDate.toISOString().slice(0, 10)).toBe("2026-06-17");
  });

  it("calculates min and max delivery ranges using working days", () => {
    const promise = calculateDeliveryPromise(
      baseSettings,
      new Date("2026-06-15T14:00:00.000Z"),
      "en-US",
    );

    expect(promise.minDeliveryDate.toISOString().slice(0, 10)).toBe(
      "2026-06-17",
    );
    expect(promise.maxDeliveryDate.toISOString().slice(0, 10)).toBe(
      "2026-06-19",
    );
  });

  it("returns localized English and Spanish message variables", () => {
    const english = calculateDeliveryPromise(
      baseSettings,
      new Date("2026-06-15T14:00:00.000Z"),
      "en-US",
    );
    const spanish = calculateDeliveryPromise(
      baseSettings,
      new Date("2026-06-15T14:00:00.000Z"),
      "es",
    );

    expect(english.messageVariables.max_delivery_weekday).toBe("Friday");
    expect(spanish.messageVariables.max_delivery_weekday).toBe("viernes");
    expect(
      formatDeliveryPromiseMessage(
        "Order within {{time_remaining}} to get it by {{max_delivery_weekday}}",
        english.messageVariables,
      ),
    ).toBe("Order within 03:00:00 to get it by Friday");
  });
});
