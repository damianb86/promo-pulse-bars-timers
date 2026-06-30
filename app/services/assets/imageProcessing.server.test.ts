import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { CampaignAiReferenceImage } from "../../types/ai-campaign";
import {
  cropReferenceRegion,
  decodeDataUrl,
  optimizeGeneratedImageForUpload,
  optimizeReferenceImageForAi,
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

async function makeNoisyPng(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  let seed = 123456789;
  for (let i = 0; i < raw.length; i += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    raw[i] = (seed >>> 16) & 255;
  }
  return sharp(raw, {
    raw: { width, height, channels: 3 },
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

describe("optimizeReferenceImageForAi", () => {
  it("resizes and compresses large reference images for the multimodal request", async () => {
    const png = await makeNoisyPng(2200, 1200);
    const optimized = await optimizeReferenceImageForAi({
      dataUrl: `data:image/png;base64,${png.toString("base64")}`,
      mimeType: "image/png",
    });

    expect(optimized.mimeType).toBe("image/jpeg");
    expect(optimized.width).toBeLessThanOrEqual(1600);
    expect(optimized.height).toBeLessThanOrEqual(1600);
    expect(decodeDataUrl(optimized.dataUrl)!.buffer.byteLength).toBeLessThan(
      png.byteLength,
    );
  });

  it("keeps small reference images unchanged apart from dimensions", async () => {
    const image = await makeReferenceImage(640, 180);
    const optimized = await optimizeReferenceImageForAi(image);

    expect(optimized.mimeType).toBe("image/png");
    expect(optimized.width).toBe(640);
    expect(optimized.height).toBe(180);
  });
});

describe("optimizeGeneratedImageForUpload", () => {
  it("converts large bitmap assets to smaller webp uploads", async () => {
    const png = await makeNoisyPng(720, 420);
    const optimized = await optimizeGeneratedImageForUpload({
      bytes: png,
      mimeType: "image/png",
      extension: "png",
    });

    expect(optimized.mimeType).toBe("image/webp");
    expect(optimized.extension).toBe("webp");
    expect(optimized.bytes.byteLength).toBeLessThan(png.byteLength);
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
