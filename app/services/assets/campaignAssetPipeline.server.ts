import type { Shop } from "@prisma/client";

import type {
  CampaignAiAssetSpec,
  CampaignAiReferenceImage,
  CampaignSuggestion,
} from "../../types/ai-campaign";
import { canUseFeature } from "../planLimits.server";
import type { ShopifyGraphqlClient } from "../shopifyDiscounts.server";
import {
  getAssetGenerationProvider,
  type AssetGenerationProvider,
} from "../ai/assetGenerator.server";
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
  assets: MaterializedAsset[];
  // User-facing error. When set, NO assets were applied and the placeholders are
  // left intact so the caller can decide how to surface the failure.
  error: string | null;
};

const PLACEHOLDER = (key: string) => `{{asset:${key}}}`;

// Removes any leftover {{asset:...}} placeholders so a failed/partial asset run
// never renders a literal placeholder on the storefront.
export function stripAssetPlaceholders(text: string): string {
  return text.replace(/\{\{asset:[a-zA-Z0-9_-]+\}\}/g, "");
}

function applyAssetUrls(
  text: string,
  byKey: Map<string, string>,
): string {
  let result = text;
  for (const [key, url] of byKey) {
    result = result.split(PLACEHOLDER(key)).join(url);
  }
  return result;
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
  provider = getAssetGenerationProvider(),
}: {
  admin: ShopifyGraphqlClient | null;
  shop: Pick<Shop, "plan">;
  suggestion: CampaignSuggestion;
  referenceImage: CampaignAiReferenceImage | null;
  provider?: AssetGenerationProvider;
}): Promise<MaterializeAssetsResult> {
  const requested = suggestion.input.generateVisualAssets === true;
  const baseHtml = suggestion.structureHtml;
  const baseCss = suggestion.structureCss;

  const fail = (error: string): MaterializeAssetsResult => ({
    requested,
    html: baseHtml,
    css: baseCss,
    assets: [],
    error,
  });

  if (!requested) {
    return { requested: false, html: baseHtml, css: baseCss, assets: [], error: null };
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
    return { requested: true, html: baseHtml, css: baseCss, assets: [], error: null };
  }

  const materialized: MaterializedAsset[] = [];
  const urlByKey = new Map<string, string>();

  for (const spec of specs) {
    try {
      const binary = await provider.generateAsset(spec, referenceImage);
      const uploaded = await uploadFileToShopify(admin, {
        bytes: binary.bytes,
        filename: `cp-${spec.key}.${binary.extension}`,
        mimeType: binary.mimeType,
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
    assets: materialized,
    error: null,
  };
}
