import type {
  CampaignAiAssetSpec,
  CampaignAiReferenceImage,
} from "../../types/ai-campaign";
import { sanitizeStructureHtml } from "../../utils/structure-html";
import { isE2ETestMode } from "../e2e-test.server";

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

function createOpenAiAssetProvider(apiKey: string): AssetGenerationProvider {
  const imagesUrl =
    process.env.OPENAI_IMAGES_URL?.trim() ||
    "https://api.openai.com/v1/images/generations";
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";

  return {
    async generateAsset(spec, _referenceImage) {
      if (spec.source === "svg") return materializeSvg(spec);

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
            prompt: spec.prompt || `Campaign ${spec.type} asset`,
            size: "1024x1024",
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
        data?: Array<{ b64_json?: string; url?: string }>;
      };
      const b64 = payload.data?.[0]?.b64_json;
      if (!b64) {
        throw new AssetGenerationError(
          `Image model returned no image for asset "${spec.key}".`,
        );
      }
      return {
        bytes: Buffer.from(b64, "base64"),
        mimeType: "image/png",
        extension: "png",
        modelUsed: model,
      };
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
