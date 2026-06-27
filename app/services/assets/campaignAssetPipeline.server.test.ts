import { afterEach, describe, expect, it, vi } from "vitest";

import type { CampaignSuggestion } from "../../types/ai-campaign";
import {
  materializeCampaignAssets,
  stripAssetPlaceholders,
} from "./campaignAssetPipeline.server";

function buildSuggestion(
  overrides: Partial<CampaignSuggestion> = {},
): CampaignSuggestion {
  return {
    promptVersion: "test",
    source: "provider",
    referenceImageUsed: true,
    input: { generateVisualAssets: true } as CampaignSuggestion["input"],
    campaign: {} as CampaignSuggestion["campaign"],
    timer: {} as CampaignSuggestion["timer"],
    targeting: {} as CampaignSuggestion["targeting"],
    discount: {} as CampaignSuggestion["discount"],
    freeShipping: {} as CampaignSuggestion["freeShipping"],
    lowStock: {} as CampaignSuggestion["lowStock"],
    badge: {} as CampaignSuggestion["badge"],
    deliveryCutoff: {} as CampaignSuggestion["deliveryCutoff"],
    translations: {} as CampaignSuggestion["translations"],
    design: {} as CampaignSuggestion["design"],
    structureHtml:
      '<section><img src="{{asset:hero}}"></section>',
    structureCss: '.x{background:url("{{asset:hero}}")}',
    assets: [
      { key: "hero", type: "background", source: "generated", prompt: "a bg" },
    ],
    generatedAssets: [],
    variants: [],
    safety: { warnings: [], blockedClaims: [], requiresReview: true },
    ...overrides,
  };
}

// Mock admin whose graphql dispatches by the operation in the query string.
function mockAdmin({ scopes }: { scopes: string[] }) {
  return {
    graphql: vi.fn(async (query: string) => {
      if (query.includes("currentAppInstallation")) {
        return {
          json: async () => ({
            data: {
              currentAppInstallation: {
                accessScopes: scopes.map((handle) => ({ handle })),
              },
            },
          }),
        };
      }
      if (query.includes("stagedUploadsCreate")) {
        return {
          json: async () => ({
            data: {
              stagedUploadsCreate: {
                stagedTargets: [
                  {
                    url: "https://staged.example/upload",
                    resourceUrl: "https://staged.example/resource",
                    parameters: [],
                  },
                ],
                userErrors: [],
              },
            },
          }),
        };
      }
      if (query.includes("fileCreate")) {
        return {
          json: async () => ({
            data: { fileCreate: { files: [{ id: "gid://file/1" }], userErrors: [] } },
          }),
        };
      }
      // file status poll
      return {
        json: async () => ({
          data: {
            node: {
              id: "gid://file/1",
              fileStatus: "READY",
              image: { url: "https://cdn.shopify.com/hero.png" },
            },
          },
        }),
      };
    }),
  } as never;
}

const mockProvider = {
  async generateAsset() {
    return {
      bytes: Buffer.from("x"),
      mimeType: "image/png",
      extension: "png",
      modelUsed: "mock-image",
    };
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("materializeCampaignAssets", () => {
  it("passes through untouched when assets were not requested", async () => {
    const suggestion = buildSuggestion({
      input: { generateVisualAssets: false } as CampaignSuggestion["input"],
    });
    const result = await materializeCampaignAssets({
      admin: mockAdmin({ scopes: ["write_files"] }),
      shop: { plan: "PRO" },
      suggestion,
      referenceImage: null,
      provider: mockProvider,
    });
    expect(result.requested).toBe(false);
    expect(result.error).toBeNull();
    expect(result.assets).toHaveLength(0);
  });

  it("blocks generation when the plan is not Pro", async () => {
    // The dev plan override (.env PROMO_PULSE_DEV_PLAN) only applies outside
    // production; force production here so the real shop plan is used.
    vi.stubEnv("NODE_ENV", "production");
    const result = await materializeCampaignAssets({
      admin: mockAdmin({ scopes: ["write_files"] }),
      shop: { plan: "GROWTH" },
      suggestion: buildSuggestion(),
      referenceImage: null,
      provider: mockProvider,
    });
    vi.unstubAllEnvs();
    expect(result.error).toMatch(/Pro plan/i);
    expect(result.assets).toHaveLength(0);
  });

  it("blocks generation when the write_files scope is missing", async () => {
    const result = await materializeCampaignAssets({
      admin: mockAdmin({ scopes: [] }),
      shop: { plan: "PRO" },
      suggestion: buildSuggestion(),
      referenceImage: null,
      provider: mockProvider,
    });
    expect(result.error).toMatch(/Files permission/i);
    expect(result.assets).toHaveLength(0);
  });

  it("uploads assets and rewrites placeholders to Shopify URLs", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const result = await materializeCampaignAssets({
      admin: mockAdmin({ scopes: ["write_files"] }),
      shop: { plan: "PRO" },
      suggestion: buildSuggestion(),
      referenceImage: null,
      provider: mockProvider,
    });

    expect(result.error).toBeNull();
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      key: "hero",
      assetType: "background",
      source: "generated",
      shopifyFileId: "gid://file/1",
      shopifyUrl: "https://cdn.shopify.com/hero.png",
      modelUsed: "mock-image",
    });
    expect(result.html).toContain("https://cdn.shopify.com/hero.png");
    expect(result.html).not.toContain("{{asset:hero}}");
    expect(result.css).toContain("https://cdn.shopify.com/hero.png");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("aborts with an error (no partial assets) when upload fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    const result = await materializeCampaignAssets({
      admin: mockAdmin({ scopes: ["write_files"] }),
      shop: { plan: "PRO" },
      suggestion: buildSuggestion(),
      referenceImage: null,
      provider: mockProvider,
    });
    expect(result.error).toMatch(/hero/);
    expect(result.assets).toHaveLength(0);
    // Placeholders remain in the returned html; the caller strips them.
    expect(stripAssetPlaceholders(result.html)).not.toContain("{{asset:");
  });
});
