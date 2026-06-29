import { describe, expect, it } from "vitest";

import {
  customMessageIdFromSlot,
  customMessageSlotName,
  generateCustomMessageId,
  isValidCustomMessageId,
  parseCustomMessages,
  serializeCustomMessages,
} from "./custom-messages";

describe("custom message ids + slots", () => {
  it("generates valid short ids", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(isValidCustomMessageId(generateCustomMessageId())).toBe(true);
    }
  });

  it("maps id <-> slot name", () => {
    expect(customMessageSlotName("m4f2a9")).toBe("custom-m4f2a9");
    expect(customMessageIdFromSlot("custom-m4f2a9")).toBe("m4f2a9");
  });

  it("rejects non-custom or malformed slots", () => {
    expect(customMessageIdFromSlot("headline")).toBeNull();
    expect(customMessageIdFromSlot("custom-")).toBeNull();
    expect(customMessageIdFromSlot("custom-NOT VALID")).toBeNull();
  });
});

describe("parseCustomMessages", () => {
  it("keeps valid entries and drops malformed/duplicate ones", () => {
    const json = JSON.stringify([
      { id: "m1", text: "Order in {{time_left}}" },
      { id: "m1", text: "duplicate id" },
      { id: "BAD ID", text: "x" },
      { text: "no id" },
      { id: "m2", text: "Spend {{amount}} more" },
    ]);
    expect(parseCustomMessages(json)).toEqual([
      { id: "m1", text: "Order in {{time_left}}" },
      { id: "m2", text: "Spend {{amount}} more" },
    ]);
  });

  it("returns [] for empty / invalid input", () => {
    expect(parseCustomMessages("")).toEqual([]);
    expect(parseCustomMessages(undefined)).toEqual([]);
    expect(parseCustomMessages("not json")).toEqual([]);
    expect(parseCustomMessages("{}")).toEqual([]);
  });

  it("round-trips through serialize", () => {
    const messages = [{ id: "m1", text: "Hi {{year}}" }];
    expect(parseCustomMessages(serializeCustomMessages(messages))).toEqual(
      messages,
    );
  });
});
