import sharp from "sharp";

import type {
  CampaignAiAssetRegion,
  CampaignAiReferenceImage,
} from "../../types/ai-campaign";

// Server-side image helpers backed by sharp. Used to (a) read the real pixel
// dimensions of an uploaded reference image so the AI can reason about its
// aspect ratio vs. the campaign target width, and (b) crop the exact region
// where an asset lives so the image model can recreate it from a faithful
// visual reference instead of a text description alone.

export type DecodedImage = {
  buffer: Buffer;
  mimeType: string;
};

export type CroppedRegion = {
  bytes: Buffer;
  mimeType: string;
  extension: string;
};

export type OptimizedImageBinary = {
  bytes: Buffer;
  mimeType: string;
  extension: string;
};

const AI_REFERENCE_MAX_DIMENSION = 1600;
const AI_REFERENCE_COMPRESS_ABOVE_BYTES = 900 * 1024;
const AI_REFERENCE_JPEG_QUALITY = 86;
const UPLOAD_WEBP_QUALITY = 88;

// Parses a `data:<mime>;base64,<data>` URI into its raw bytes.
export function decodeDataUrl(dataUrl: string): DecodedImage | null {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  try {
    return { buffer: Buffer.from(match[2], "base64"), mimeType: match[1] };
  } catch {
    return null;
  }
}

// Reads the pixel dimensions of an image buffer. Returns null on any decode
// failure so callers can proceed without dimensions.
export async function readImageDimensions(
  buffer: Buffer,
): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.width && meta.height) {
      return { width: meta.width, height: meta.height };
    }
  } catch {
    // ignore — dimensions are best-effort
  }
  return null;
}

// Returns a copy of the reference image with its real pixel dimensions filled
// in (best-effort). Used right after parsing the upload so the proportion logic
// and crop pipeline have the true aspect ratio to work with.
export async function withImageDimensions(
  image: CampaignAiReferenceImage,
): Promise<CampaignAiReferenceImage> {
  const decoded = decodeDataUrl(image.dataUrl);
  if (!decoded) return image;
  const dims = await readImageDimensions(decoded.buffer);
  return dims ? { ...image, width: dims.width, height: dims.height } : image;
}

// Prepares a merchant-uploaded reference for multimodal analysis. Large
// screenshots are expensive to send and do not need original-resolution pixels
// for layout/color reasoning, so resize/compress only when it materially reduces
// bytes. The original aspect ratio is preserved.
export async function optimizeReferenceImageForAi(
  image: CampaignAiReferenceImage,
): Promise<CampaignAiReferenceImage> {
  const decoded = decodeDataUrl(image.dataUrl);
  if (!decoded) return image;

  try {
    const source = sharp(decoded.buffer).rotate();
    const meta = await source.metadata();
    const width = meta.width ?? image.width;
    const height = meta.height ?? image.height;
    if (!width || !height) return image;

    const shouldResize = Math.max(width, height) > AI_REFERENCE_MAX_DIMENSION;
    const shouldCompress =
      decoded.buffer.byteLength > AI_REFERENCE_COMPRESS_ABOVE_BYTES;

    if (!shouldResize && !shouldCompress) {
      return { ...image, width, height };
    }

    let pipeline = sharp(decoded.buffer).rotate();
    if (shouldResize) {
      pipeline = pipeline.resize({
        width: width >= height ? AI_REFERENCE_MAX_DIMENSION : undefined,
        height: height > width ? AI_REFERENCE_MAX_DIMENSION : undefined,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    const optimized = await pipeline
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: AI_REFERENCE_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    // Keep the original when conversion does not buy a meaningful reduction.
    if (optimized.byteLength >= decoded.buffer.byteLength * 0.9) {
      return { ...image, width, height };
    }

    const dims = await readImageDimensions(optimized);
    return {
      dataUrl: `data:image/jpeg;base64,${optimized.toString("base64")}`,
      mimeType: "image/jpeg",
      width: dims?.width ?? width,
      height: dims?.height ?? height,
    };
  } catch {
    return image;
  }
}

export async function optimizeGeneratedImageForUpload(
  input: OptimizedImageBinary,
): Promise<OptimizedImageBinary> {
  if (
    !input.mimeType.startsWith("image/") ||
    input.mimeType === "image/svg+xml"
  ) {
    return input;
  }

  try {
    const optimized = await sharp(input.bytes)
      .rotate()
      .webp({ quality: UPLOAD_WEBP_QUALITY, effort: 4 })
      .toBuffer();

    if (optimized.byteLength >= input.bytes.byteLength * 0.95) {
      return input;
    }

    return {
      bytes: optimized,
      mimeType: "image/webp",
      extension: "webp",
    };
  } catch {
    return input;
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

// Crops the normalized region from the reference image and returns a clean PNG
// of just that area. Returns null when the image cannot be decoded or the region
// is degenerate (so the caller falls back to text-only generation).
export async function cropReferenceRegion(
  referenceImage: CampaignAiReferenceImage,
  region: CampaignAiAssetRegion,
): Promise<CroppedRegion | null> {
  const decoded = decodeDataUrl(referenceImage.dataUrl);
  if (!decoded) return null;

  try {
    const pipeline = sharp(decoded.buffer);
    const meta = await pipeline.metadata();
    const imgW = meta.width ?? referenceImage.width;
    const imgH = meta.height ?? referenceImage.height;
    if (!imgW || !imgH) return null;

    const x = clamp01(region.x);
    const y = clamp01(region.y);
    const w = clamp01(region.width);
    const h = clamp01(region.height);

    let left = Math.round(x * imgW);
    let top = Math.round(y * imgH);
    let width = Math.round(w * imgW);
    let height = Math.round(h * imgH);

    // Keep the crop inside the image and at least 1px in each dimension.
    width = Math.max(1, Math.min(width, imgW - left));
    height = Math.max(1, Math.min(height, imgH - top));
    left = Math.max(0, Math.min(left, imgW - 1));
    top = Math.max(0, Math.min(top, imgH - 1));

    // A region that covers almost nothing is not a usable reference.
    if (width < 4 || height < 4) return null;

    const bytes = await pipeline
      .extract({ left, top, width, height })
      .png()
      .toBuffer();

    return { bytes, mimeType: "image/png", extension: "png" };
  } catch {
    return null;
  }
}
