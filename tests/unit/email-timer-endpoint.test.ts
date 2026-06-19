import { EmailTimerExpiredBehavior, EmailTimerMode } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  analyticsEvent: {
    create: vi.fn(),
  },
  emailTimer: {
    findUnique: vi.fn(),
  },
}));

vi.mock("../../app/db.server", () => ({
  default: prismaMock,
}));

import {
  loadEmailTimerImageResponse,
  readPngToken,
} from "../../app/services/email-timers/emailTimerEndpoint.server";

const validToken = "public-token-1234567890";
const now = new Date("2026-06-18T12:00:00.000Z");

describe("email timer image endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.analyticsEvent.create.mockResolvedValue({ id: "event-1" });
  });

  it("returns a PNG for a valid public token", async () => {
    prismaMock.emailTimer.findUnique.mockResolvedValue(
      emailTimerFixture({
        endsAt: new Date("2026-06-18T12:10:00.000Z"),
      }),
    );

    const response = await loadEmailTimerImageResponse(
      `${validToken}.png`,
      now,
    );
    const body = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(prismaMock.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: "campaign-1",
          eventType: "IMPRESSION",
          shopId: "shop-1",
        }),
      }),
    );
    expect(body.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  });

  it("rejects an invalid token without querying the database", async () => {
    const response = await loadEmailTimerImageResponse("short.png", now);

    expect(response.status).toBe(404);
    expect(prismaMock.emailTimer.findUnique).not.toHaveBeenCalled();
  });

  it("renders a different PNG as time changes", async () => {
    prismaMock.emailTimer.findUnique.mockResolvedValue(
      emailTimerFixture({
        endsAt: new Date("2026-06-18T12:01:00.000Z"),
      }),
    );

    const first = await loadEmailTimerImageResponse(`${validToken}.png`, now);
    const second = await loadEmailTimerImageResponse(
      `${validToken}.png`,
      new Date("2026-06-18T12:00:05.000Z"),
    );

    expect(Buffer.from(await first.arrayBuffer())).not.toEqual(
      Buffer.from(await second.arrayBuffer()),
    );
  });

  it("renders the expired fallback image", async () => {
    prismaMock.emailTimer.findUnique.mockResolvedValue(
      emailTimerFixture({
        endsAt: new Date("2026-06-18T11:59:00.000Z"),
        expiredBehavior: EmailTimerExpiredBehavior.SHOW_EXPIRED,
      }),
    );

    const response = await loadEmailTimerImageResponse(
      `${validToken}.png`,
      now,
    );
    const body = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(readPngDimensions(body)).toEqual({ width: 600, height: 180 });
  });

  it("can hide an expired timer with a transparent pixel", async () => {
    prismaMock.emailTimer.findUnique.mockResolvedValue(
      emailTimerFixture({
        endsAt: new Date("2026-06-18T11:59:00.000Z"),
        expiredBehavior: EmailTimerExpiredBehavior.HIDE,
      }),
    );

    const response = await loadEmailTimerImageResponse(
      `${validToken}.png`,
      now,
    );
    const body = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(readPngDimensions(body)).toEqual({ width: 1, height: 1 });
  });

  it("extracts only PNG route tokens", () => {
    expect(readPngToken(`${validToken}.png`)).toBe(validToken);
    expect(readPngToken(`${validToken}.jpg`)).toBe("");
    expect(readPngToken("invalid token.png")).toBe("");
  });
});

function emailTimerFixture(
  overrides: Partial<{
    endsAt: Date;
    expiredBehavior: EmailTimerExpiredBehavior;
  }> = {},
) {
  return {
    id: "email-timer-1",
    shopId: "shop-1",
    campaignId: "campaign-1",
    publicToken: validToken,
    mode: EmailTimerMode.FIXED_DATE,
    startsAt: new Date("2026-06-18T11:00:00.000Z"),
    endsAt: overrides.endsAt ?? new Date("2026-06-18T13:00:00.000Z"),
    timezone: "UTC",
    expiredBehavior:
      overrides.expiredBehavior ?? EmailTimerExpiredBehavior.SHOW_EXPIRED,
    design: {
      width: 600,
      height: 180,
    },
    createdAt: new Date("2026-06-18T11:00:00.000Z"),
    updatedAt: new Date("2026-06-18T11:00:00.000Z"),
    campaign: {
      design: {
        backgroundColor: "#111827",
        textColor: "#FFFFFF",
        accentColor: "#F97316",
      },
      translations: [],
    },
  };
}

function readPngDimensions(buffer: Buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}
