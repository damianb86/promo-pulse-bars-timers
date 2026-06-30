import type {
  CampaignAiAssetSpec,
  CampaignAiImageSize,
  CampaignAiReferenceImage,
} from "../../types/ai-campaign";
import { sanitizeStructureHtml } from "../../utils/structure-html";
import { isE2ETestMode } from "../e2e-test.server";
import { cropReferenceRegion } from "../assets/imageProcessing.server";

// Produces the binary for a single AI asset spec. Image specs go through an
// image model (OpenAI gpt-image-1); svg specs are materialized directly from the
// sanitized markup. There is no fallback — a failure throws so the pipeline
// aborts the whole asset flow.

export class AssetGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetGenerationError";
  }
}

export type GeneratedAssetBinary = {
  bytes: Buffer;
  mimeType: string;
  extension: string;
  modelUsed: string | null;
};

export type AssetGenerationProvider = {
  generateAsset(
    spec: CampaignAiAssetSpec,
    referenceImage: CampaignAiReferenceImage | null,
  ): Promise<GeneratedAssetBinary>;
};

// 1x1 transparent PNG — used by the mock provider so dev/E2E never call OpenAI.
const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const OPENAI_IMAGE_SIZES = new Set<CampaignAiImageSize>([
  "1024x1024",
  "1536x1024",
  "1024x1536",
]);

export function chooseOpenAiImageSize(
  spec: Pick<CampaignAiAssetSpec, "type" | "prompt" | "region" | "imageSize">,
): CampaignAiImageSize {
  if (spec.imageSize && OPENAI_IMAGE_SIZES.has(spec.imageSize)) {
    return spec.imageSize;
  }

  if (spec.region?.width && spec.region?.height) {
    const ratio = spec.region.width / spec.region.height;
    if (ratio >= 1.2) return "1536x1024";
    if (ratio <= 0.82) return "1024x1536";
  }

  const prompt = `${spec.type} ${spec.prompt}`.toLowerCase();

  if (
    spec.type === "icon" ||
    spec.type === "badge" ||
    (spec.type === "pattern" && !/banner|bar|wide|landscape|hero/.test(prompt))
  ) {
    return "1024x1024";
  }

  if (
    /drawer|portrait|vertical|tall|story|mobile|narrow card|side panel/.test(
      prompt,
    )
  ) {
    return "1024x1536";
  }

  if (
    spec.type === "background" ||
    spec.type === "image" ||
    /banner|bar|wide|horizontal|landscape|panoramic|hero|background|cover/.test(
      prompt,
    )
  ) {
    return "1536x1024";
  }

  return "1024x1024";
}

function sizePromptSuffix(
  size: CampaignAiImageSize,
  spec: CampaignAiAssetSpec,
) {
  const orientation =
    size === "1536x1024"
      ? "landscape"
      : size === "1024x1536"
        ? "portrait"
        : "square";
  const textRule =
    spec.type === "background" ||
    spec.type === "pattern" ||
    spec.type === "texture" ||
    spec.type === "decoration"
      ? "Do not render campaign copy, prices, discount text, countdown digits, logos, or readable typography inside the image; Promo Pulse will render live text and controls above it."
      : "Avoid unnecessary readable text unless the asset itself is explicitly a typographic badge.";

  return [
    "",
    `Canvas: ${size} px, ${orientation} composition.`,
    "Compose for that exact aspect ratio with clean crop-safe edges and no important detail pressed against the border.",
    textRule,
    "Leave calm negative space or low-detail areas where campaign text can remain legible.",
  ].join("\n");
}

function assetPrompt(spec: CampaignAiAssetSpec, size: CampaignAiImageSize) {
  return `${spec.prompt || `Campaign ${spec.type} asset`}${sizePromptSuffix(
    size,
    spec,
  )}`;
}

function materializeSvg(spec: CampaignAiAssetSpec): GeneratedAssetBinary {
  const safe = sanitizeStructureHtml(spec.svg ?? "", { pretty: false });
  if (!safe || !safe.toLowerCase().includes("<svg")) {
    throw new AssetGenerationError(
      `Asset "${spec.key}" was marked as SVG but had no valid <svg> markup.`,
    );
  }
  return {
    bytes: Buffer.from(safe, "utf8"),
    mimeType: "image/svg+xml",
    extension: "svg",
    modelUsed: null,
  };
}

export function createMockAssetProvider(): AssetGenerationProvider {
  return {
    async generateAsset(spec) {
      if (spec.source === "svg") return materializeSvg(spec);
      return {
        bytes: Buffer.from(MOCK_PNG_BASE64, "base64"),
        mimeType: "image/png",
        extension: "png",
        modelUsed: "mock-image",
      };
    },
  };
}

function readGeneratedB64(
  payload: { data?: Array<{ b64_json?: string }> },
  key: string,
): string {
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) {
    throw new AssetGenerationError(
      `Image model returned no image for asset "${key}".`,
    );
  }
  return b64;
}

function createOpenAiAssetProvider(apiKey: string): AssetGenerationProvider {
  const imagesUrl =
    process.env.OPENAI_IMAGES_URL?.trim() ||
    "https://api.openai.com/v1/images/generations";
  const editsUrl =
    process.env.OPENAI_IMAGE_EDITS_URL?.trim() ||
    "https://api.openai.com/v1/images/edits";
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";

  // Text-to-image: recreate the asset from the prompt alone (no visual ref).
  async function generateFromPrompt(
    spec: CampaignAiAssetSpec,
  ): Promise<GeneratedAssetBinary> {
    const size = chooseOpenAiImageSize(spec);
    let response: Response;
    try {
      response = await fetch(imagesUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: assetPrompt(spec, size),
          size,
          n: 1,
        }),
      });
    } catch (error) {
      throw new AssetGenerationError(
        `Image generation request failed: ${(error as Error).message}`,
      );
    }

    if (!response.ok) {
      throw new AssetGenerationError(
        `Image model returned status ${response.status} for asset "${spec.key}".`,
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string }>;
    };
    return {
      bytes: Buffer.from(readGeneratedB64(payload, spec.key), "base64"),
      mimeType: "image/png",
      extension: "png",
      modelUsed: model,
    };
  }

  // Image-to-image: crop the exact region of the uploaded reference where the
  // asset lives and have the model recreate it as a clean, isolated asset. This
  // is far more faithful than generating from the text description alone.
  async function generateFromReferenceCrop(
    spec: CampaignAiAssetSpec,
    crop: { bytes: Buffer; mimeType: string },
  ): Promise<GeneratedAssetBinary> {
    const size = chooseOpenAiImageSize(spec);
    const form = new FormData();
    form.set("model", model);
    form.set(
      "prompt",
      assetPrompt(
        {
          ...spec,
          prompt:
            spec.prompt ||
            `Recreate this ${spec.type} as a clean, isolated, high-quality asset ` +
              `faithful to the reference.`,
        },
        size,
      ),
    );
    form.set("size", size);
    form.set("n", "1");
    form.set(
      "image",
      new Blob([new Uint8Array(crop.bytes)], { type: crop.mimeType }),
      `cp-${spec.key}.png`,
    );

    let response: Response;
    try {
      response = await fetch(editsUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch (error) {
      throw new AssetGenerationError(
        `Image edit request failed: ${(error as Error).message}`,
      );
    }

    if (!response.ok) {
      throw new AssetGenerationError(
        `Image model returned status ${response.status} for asset "${spec.key}".`,
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string }>;
    };
    return {
      bytes: Buffer.from(readGeneratedB64(payload, spec.key), "base64"),
      mimeType: "image/png",
      extension: "png",
      modelUsed: model,
    };
  }

  return {
    async generateAsset(spec, referenceImage) {
      if (spec.source === "svg") return materializeSvg(spec);

      // When the asset is visible in the uploaded image, crop that region and use
      // it as a visual reference. Fall back to text-to-image if the crop or the
      // edit call cannot be produced.
      if (spec.region && referenceImage) {
        const crop = await cropReferenceRegion(referenceImage, spec.region);
        if (crop) {
          try {
            return await generateFromReferenceCrop(spec, crop);
          } catch (error) {
            console.error(
              `Reference-crop generation failed for asset "${spec.key}"; ` +
                "falling back to text-to-image",
              error,
            );
          }
        }
      }

      return generateFromPrompt(spec);
    },
  };
}

export function getAssetGenerationProvider(): AssetGenerationProvider {
  if (
    isE2ETestMode() ||
    process.env.PROMO_PULSE_AI_PROVIDER !== "openai" ||
    !process.env.OPENAI_API_KEY
  ) {
    return createMockAssetProvider();
  }
  return createOpenAiAssetProvider(process.env.OPENAI_API_KEY);
}
