import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { CampaignAiReferenceImage } from "../../types/ai-campaign";
import {
  cropReferenceRegion,
  decodeDataUrl,
  readImageDimensions,
  withImageDimensions,
} from "./imageProcessing.server";

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 10, g: 20, b: 30, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function makeReferenceImage(
  width: number,
  height: number,
): Promise<CampaignAiReferenceImage> {
  const png = await makePng(width, height);
  return {
    dataUrl: `data:image/png;base64,${png.toString("base64")}`,
    mimeType: "image/png",
  };
}

describe("decodeDataUrl", () => {
  it("decodes a base64 data URL", () => {
    const decoded = decodeDataUrl("data:image/png;base64,aGVsbG8=");
    expect(decoded?.mimeType).toBe("image/png");
    expect(decoded?.buffer.toString()).toBe("hello");
  });

  it("returns null for a malformed data URL", () => {
    expect(decodeDataUrl("not-a-data-url")).toBeNull();
  });
});

describe("readImageDimensions", () => {
  it("reads real pixel dimensions", async () => {
    const png = await makePng(640, 120);
    const dims = await readImageDimensions(png);
    expect(dims).toEqual({ width: 640, height: 120 });
  });

  it("returns null for non-image bytes", async () => {
    const dims = await readImageDimensions(Buffer.from("nope"));
    expect(dims).toBeNull();
  });
});

describe("withImageDimensions", () => {
  it("fills in width/height for a valid image", async () => {
    const image = await makeReferenceImage(1000, 200);
    const enriched = await withImageDimensions(image);
    expect(enriched.width).toBe(1000);
    expect(enriched.height).toBe(200);
  });
});

describe("cropReferenceRegion", () => {
  it("crops the normalized region to the right pixel size", async () => {
    const image = await makeReferenceImage(1000, 200);
    const crop = await cropReferenceRegion(image, {
      x: 0.5,
      y: 0,
      width: 0.25,
      height: 1,
    });
    expect(crop).not.toBeNull();
    const dims = await readImageDimensions(crop!.bytes);
    expect(dims).toEqual({ width: 250, height: 200 });
    expect(crop!.mimeType).toBe("image/png");
  });

  it("clamps a region that overflows the image bounds", async () => {
    const image = await makeReferenceImage(400, 400);
    const crop = await cropReferenceRegion(image, {
      x: 0.8,
      y: 0.8,
      width: 0.5,
      height: 0.5,
    });
    expect(crop).not.toBeNull();
    const dims = await readImageDimensions(crop!.bytes);
    // 0.8..1.3 clamps to 0.8..1.0 -> 80px within a 400px image.
    expect(dims).toEqual({ width: 80, height: 80 });
  });

  it("returns null for a degenerate (sub-pixel) region", async () => {
    const image = await makeReferenceImage(100, 100);
    const crop = await cropReferenceRegion(image, {
      x: 0,
      y: 0,
      width: 0.01,
      height: 0.01,
    });
    expect(crop).toBeNull();
  });

  it("returns null when the image cannot be decoded", async () => {
    const crop = await cropReferenceRegion(
      { dataUrl: "not-a-data-url", mimeType: "image/png" },
      { x: 0, y: 0, width: 1, height: 1 },
    );
    expect(crop).toBeNull();
  });
});
