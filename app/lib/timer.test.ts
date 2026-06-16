import { describe, expect, it } from "vitest";

import {
  calculateTimerState,
  formatTimeRemaining,
  isCampaignExpired,
} from "./timer";

describe("timer engine", () => {
  it("calculates active fixed-date timers", () => {
    const state = calculateTimerState(
      {
        mode: "FIXED_DATE",
        endsAt: "2026-06-16T13:00:00.000Z",
      },
      new Date("2026-06-16T12:00:00.000Z"),
      "UTC",
    );

    expect(state.isActive).toBe(true);
    expect(state.isExpired).toBe(false);
    expect(state.remainingMs).toBe(3_600_000);
    expect(formatTimeRemaining(state.remainingMs)).toBe("01:00:00");
  });

  it("calculates expired fixed-date timers", () => {
    const state = calculateTimerState(
      {
        mode: "FIXED_DATE",
        endsAt: "2026-06-16T12:00:00.000Z",
      },
      new Date("2026-06-16T12:00:01.000Z"),
      "UTC",
    );

    expect(state.isActive).toBe(false);
    expect(state.isExpired).toBe(true);
    expect(state.remainingMs).toBe(0);
  });

  it("starts evergreen timers on first visit", () => {
    const state = calculateTimerState(
      {
        mode: "EVERGREEN_SESSION",
        durationMinutes: 15,
        resetBehavior: "ON_SESSION_END",
      },
      new Date("2026-06-16T12:00:00.000Z"),
      "UTC",
    );

    expect(state.isActive).toBe(true);
    expect(state.remainingMs).toBe(900_000);
    expect(state.nextStorageState).toEqual({
      startedAt: "2026-06-16T12:00:00.000Z",
      endsAt: "2026-06-16T12:15:00.000Z",
    });
  });

  it("reuses evergreen timers for returning visits", () => {
    const state = calculateTimerState(
      {
        mode: "EVERGREEN_SESSION",
        durationMinutes: 15,
        resetBehavior: "NEVER",
      },
      new Date("2026-06-16T12:05:00.000Z"),
      "UTC",
      {
        startedAt: "2026-06-16T12:00:00.000Z",
        endsAt: "2026-06-16T12:15:00.000Z",
      },
    );

    expect(state.isActive).toBe(true);
    expect(state.remainingMs).toBe(600_000);
    expect(state.nextStorageState).toEqual({
      startedAt: "2026-06-16T12:00:00.000Z",
      endsAt: "2026-06-16T12:15:00.000Z",
    });
  });

  it("calculates recurring daily timers before cutoff", () => {
    const state = calculateTimerState(
      {
        mode: "RECURRING_DAILY",
        recurringDays: { cutoffHour: 17, cutoffMinute: 30 },
      },
      new Date("2026-06-16T16:00:00.000Z"),
      "UTC",
    );

    expect(state.isActive).toBe(true);
    expect(state.isExpired).toBe(false);
    expect(state.endsAt?.toISOString()).toBe("2026-06-16T17:30:00.000Z");
    expect(state.remainingMs).toBe(5_400_000);
  });

  it("marks recurring daily timers expired after cutoff", () => {
    const state = calculateTimerState(
      {
        mode: "RECURRING_DAILY",
        cutoffHour: 17,
        cutoffMinute: 30,
      },
      new Date("2026-06-16T18:00:00.000Z"),
      "UTC",
    );

    expect(state.isActive).toBe(false);
    expect(state.isExpired).toBe(true);
    expect(state.endsAt?.toISOString()).toBe("2026-06-16T17:30:00.000Z");
  });

  it("calculates recurring weekly timers", () => {
    const state = calculateTimerState(
      {
        mode: "RECURRING_WEEKLY",
        recurringDays: [
          {
            weekday: "FRIDAY",
            cutoffHour: 18,
            cutoffMinute: 0,
          },
        ],
      },
      new Date("2026-06-16T12:00:00.000Z"),
      "UTC",
    );

    expect(state.isActive).toBe(true);
    expect(state.isExpired).toBe(false);
    expect(state.endsAt?.toISOString()).toBe("2026-06-19T18:00:00.000Z");
  });

  it("does not throw for invalid dates", () => {
    const state = calculateTimerState(
      {
        mode: "FIXED_DATE",
        endsAt: "not-a-date",
      },
      new Date("2026-06-16T12:00:00.000Z"),
      "UTC",
    );

    expect(state.isActive).toBe(false);
    expect(state.isExpired).toBe(false);
    expect(isCampaignExpired({ endsAt: "not-a-date" }, new Date())).toBe(false);
  });
});
