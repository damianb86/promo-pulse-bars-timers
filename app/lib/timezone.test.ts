import { describe, expect, it } from "vitest";

import {
  formatDateTimeLocalInZone,
  parseDateTimeLocalInZone,
  safeTimezone,
  zonedTimeToUtc,
} from "./timezone";

describe("parseDateTimeLocalInZone", () => {
  it("interprets a datetime-local as wall time in the given zone (DST)", () => {
    // 2026-07-10 is DST in New York (UTC-4), so 14:00 local === 18:00 UTC.
    const date = parseDateTimeLocalInZone(
      "2026-07-10T14:00",
      "America/New_York",
    );
    expect(date?.toISOString()).toBe("2026-07-10T18:00:00.000Z");
  });

  it("interprets a winter datetime-local (standard time, UTC-5)", () => {
    const date = parseDateTimeLocalInZone(
      "2026-01-10T14:00",
      "America/New_York",
    );
    expect(date?.toISOString()).toBe("2026-01-10T19:00:00.000Z");
  });

  it("treats the value as UTC when the zone is UTC", () => {
    const date = parseDateTimeLocalInZone("2026-07-10T14:00", "UTC");
    expect(date?.toISOString()).toBe("2026-07-10T14:00:00.000Z");
  });

  it("returns null for empty or invalid input", () => {
    expect(parseDateTimeLocalInZone("", "UTC")).toBeNull();
    expect(parseDateTimeLocalInZone("not-a-date", "UTC")).toBeNull();
  });

  it("falls back to UTC for an invalid timezone", () => {
    const date = parseDateTimeLocalInZone("2026-07-10T14:00", "Not/AZone");
    expect(date?.toISOString()).toBe("2026-07-10T14:00:00.000Z");
  });
});

describe("formatDateTimeLocalInZone", () => {
  it("renders a UTC instant as wall time in the given zone", () => {
    expect(
      formatDateTimeLocalInZone(
        "2026-07-10T18:00:00.000Z",
        "America/New_York",
      ),
    ).toBe("2026-07-10T14:00");
  });

  it("round-trips with parseDateTimeLocalInZone", () => {
    const tz = "America/New_York";
    const local = "2026-07-10T14:00";
    const utc = parseDateTimeLocalInZone(local, tz);
    expect(formatDateTimeLocalInZone(utc, tz)).toBe(local);
  });

  it("returns an empty string for null/invalid input", () => {
    expect(formatDateTimeLocalInZone(null, "UTC")).toBe("");
    expect(formatDateTimeLocalInZone("nope", "UTC")).toBe("");
  });
});

describe("safeTimezone", () => {
  it("keeps valid IANA zones and falls back to UTC otherwise", () => {
    expect(safeTimezone("America/New_York")).toBe("America/New_York");
    expect(safeTimezone("Not/AZone")).toBe("UTC");
    expect(safeTimezone("")).toBe("UTC");
    expect(safeTimezone(null)).toBe("UTC");
  });
});

describe("zonedTimeToUtc", () => {
  it("converts wall-clock components in a zone to the correct UTC instant", () => {
    expect(
      zonedTimeToUtc(2026, 7, 10, 14, 0, "America/New_York").toISOString(),
    ).toBe("2026-07-10T18:00:00.000Z");
  });
});
