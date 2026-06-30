import type { Shop } from "@prisma/client";

import type {
  CampaignAiAssetSpec,
  CampaignAiGeneratedAsset,
  CampaignAiReferenceImage,
  CampaignSuggestion,
} from "../../types/ai-campaign";
import { canUseFeature } from "../planLimits.server";
import type { ShopifyGraphqlClient } from "../shopifyDiscounts.server";
import {
  getAssetGenerationProvider,
  type AssetGenerationProvider,
} from "../ai/assetGenerator.server";
import { optimizeGeneratedImageForUpload } from "./imageProcessing.server";
import { hasWriteFilesScope } from "./shopifyScopes.server";
import { uploadFileToShopify } from "./shopifyFiles.server";

export type MaterializedAsset = {
  key: string;
  assetType: string;
  source: CampaignAiAssetSpec["source"];
  shopifyFileId: string;
  shopifyUrl: string;
  modelUsed: string | null;
  promptUsed: string | null;
};

export type MaterializeAssetsResult = {
  // Whether asset generation was requested at all (persisted on the campaign).
  requested: boolean;
  // HTML/CSS with {{asset:key}} placeholders replaced by Shopify URLs.
  html: string;
  css: string;
  // Design settings with supported {{asset:key}} placeholders replaced by
  // Shopify URLs. This lets backgrounds/icons use first-class settings instead
  // of requiring custom HTML/CSS.
  design: CampaignSuggestion["design"];
  assets: MaterializedAsset[];
  // User-facing error. When set, NO assets were applied and the placeholders are
  // left intact so the caller can decide how to surface the failure.
  error: string | null;
};

const PLACEHOLDER = (key: string) => `{{asset:${key}}}`;
const OPTIMIZABLE_BITMAP_ASSET_TYPES = new Set<CampaignAiAssetSpec["type"]>([
  "background",
  "pattern",
  "texture",
  "decoration",
  "image",
]);

// Words (English + Spanish) that signal the merchant's refinement feedback is
// about the visuals/assets. When the feedback mentions none of these, a
// "Regenerate" keeps the previously generated images instead of remaking them.
const ASSET_FEEDBACK_PATTERN =
  /(?<!\p{L})(image|images|img|asset|assets|photo|photos|picture|pictures|background|backdrop|bg|icon|icons|logo|logos|illustration|graphic|graphics|visual|visuals|badge|texture|pattern|imagen|imagenes|im[aá]genes|foto|fotos|fondo|fondos|[ií]cono|iconos|logotipo|ilustraci[oó]n|gr[aá]fico|gr[aá]ficos|insignia|textura|patr[oó]n)(?!\p{L})/iu;

// Whether the merchant's refinement comment asks to change the visuals/assets.
// Empty / unrelated feedback returns false so the existing assets are reused.
export function refineFeedbackMentionsAssets(
  comment: string | undefined,
): boolean {
  if (!comment) return false;
  return ASSET_FEEDBACK_PATTERN.test(comment);
}

// Removes any leftover {{asset:...}} placeholders so a failed/partial asset run
// never renders a literal placeholder on the storefront.
export function stripAssetPlaceholders(text: string): string {
  return text.replace(/\{\{asset:[a-zA-Z0-9_-]+\}\}/g, "");
}

// Inverse of applyAssetUrls: turns baked Shopify URLs back into {{asset:key}}
// placeholders using the known generated assets. Used when refining so the model
// sees placeholders (and can keep referencing the same keys) instead of long
// opaque URLs, which keeps the reuse-by-key path working.
export function dematerializeAssetUrls(
  text: string,
  assets: CampaignAiGeneratedAsset[],
): string {
  let result = text;
  for (const asset of assets) {
    if (asset.key && asset.shopifyUrl) {
      result = result.split(asset.shopifyUrl).join(PLACEHOLDER(asset.key));
    }
  }
  return result;
}

function applyAssetUrls(text: string, byKey: Map<string, string>): string {
  let result = text;
  for (const [key, url] of byKey) {
    result = result.split(PLACEHOLDER(key)).join(url);
  }
  return result;
}

function applyAssetUrlsToDesign(
  design: CampaignSuggestion["design"],
  byKey: Map<string, string>,
): CampaignSuggestion["design"] {
  return {
    ...design,
    backgroundImageUrl: applyAssetUrls(design.backgroundImageUrl ?? "", byKey),
    customIconUrl: applyAssetUrls(design.customIconUrl ?? "", byKey),
  };
}

// Generates the AI's visual assets, uploads them to Shopify Files, and rewrites
// the campaign HTML/CSS to use the Shopify URLs. Enforces (server-side, never
// trusting the client) PRO plan + write_files scope. ANY failure aborts the whole
// asset flow — no partial application, no server-side storage fallback.
export async function materializeCampaignAssets({
  admin,
  shop,
  suggestion,
  referenceImage,
  existingAssets = [],
  regenerateAssets = true,
  provider = getAssetGenerationProvider(),
}: {
  admin: ShopifyGraphqlClient | null;
  shop: Pick<Shop, "plan">;
  suggestion: CampaignSuggestion;
  referenceImage: CampaignAiReferenceImage | null;
  // Previously generated + uploaded assets (from the draft being refined). When
  // regenerateAssets is false they are reused by key instead of being generated
  // and re-uploaded again, so a "Regenerate" that does not touch the visuals
  // keeps the exact same images.
  existingAssets?: CampaignAiGeneratedAsset[];
  // When false, reuse existing assets by key and only generate the ones that are
  // genuinely new (no matching existing key). When true, regenerate everything.
  regenerateAssets?: boolean;
  provider?: AssetGenerationProvider;
}): Promise<MaterializeAssetsResult> {
  const requested = suggestion.input.generateVisualAssets === true;
  const baseHtml = suggestion.structureHtml;
  const baseCss = suggestion.structureCss;
  const baseDesign = suggestion.design;

  const fail = (error: string): MaterializeAssetsResult => ({
    requested,
    html: baseHtml,
    css: baseCss,
    design: baseDesign,
    assets: [],
    error,
  });

  if (!requested) {
    return {
      requested: false,
      html: baseHtml,
      css: baseCss,
      design: baseDesign,
      assets: [],
      error: null,
    };
  }

  // Plan gate (server-side authority).
  if (!canUseFeature({ plan: shop.plan }, "ai_visual_assets").allowed) {
    return fail("Visual asset generation is only available on the Pro plan.");
  }

  // Scope gate (server-side authority).
  if (!admin || !(await hasWriteFilesScope(admin))) {
    return fail(
      "Saving files to Shopify needs the Files permission. Grant it and try again.",
    );
  }

  const specs = suggestion.assets;
  if (specs.length === 0) {
    // Requested but the model proposed no assets — not an error.
    return {
      requested: true,
      html: baseHtml,
      css: baseCss,
      design: baseDesign,
      assets: [],
      error: null,
    };
  }

  const materialized: MaterializedAsset[] = [];
  const urlByKey = new Map<string, string>();

  // Index reusable assets by key so an unchanged "Regenerate" keeps the exact
  // same uploaded files.
  const existingByKey = new Map<string, CampaignAiGeneratedAsset>();
  for (const asset of existingAssets) {
    if (asset.key) existingByKey.set(asset.key, asset);
  }

  for (const spec of specs) {
    // Reuse a previously generated asset with the same key unless the caller
    // explicitly asked to regenerate the visuals.
    const reusable = existingByKey.get(spec.key);
    if (!regenerateAssets && reusable) {
      urlByKey.set(spec.key, reusable.shopifyUrl);
      materialized.push({
        key: reusable.key,
        assetType: reusable.assetType,
        source: reusable.source,
        shopifyFileId: reusable.shopifyFileId,
        shopifyUrl: reusable.shopifyUrl,
        modelUsed: reusable.modelUsed,
        promptUsed: reusable.promptUsed,
      });
      continue;
    }

    try {
      const binary = await provider.generateAsset(spec, referenceImage);
      const uploadBinary =
        spec.source === "svg" || !OPTIMIZABLE_BITMAP_ASSET_TYPES.has(spec.type)
          ? binary
          : await optimizeGeneratedImageForUpload(binary);
      const uploaded = await uploadFileToShopify(admin, {
        bytes: uploadBinary.bytes,
        filename: `cp-${spec.key}.${uploadBinary.extension}`,
        mimeType: uploadBinary.mimeType,
        alt: spec.prompt || spec.type,
      });
      urlByKey.set(spec.key, uploaded.url);
      materialized.push({
        key: spec.key,
        assetType: spec.type,
        source: spec.source,
        shopifyFileId: uploaded.id,
        shopifyUrl: uploaded.url,
        modelUsed: binary.modelUsed,
        promptUsed: spec.prompt || null,
      });
    } catch (error) {
      // Abort entirely — no partial assets, no fallback.
      return fail(
        `Could not generate or save asset "${spec.key}": ${
          (error as Error).message
        }`,
      );
    }
  }

  return {
    requested: true,
    html: applyAssetUrls(baseHtml, urlByKey),
    css: applyAssetUrls(baseCss, urlByKey),
    design: applyAssetUrlsToDesign(baseDesign, urlByKey),
    assets: materialized,
    error: null,
  };
}
