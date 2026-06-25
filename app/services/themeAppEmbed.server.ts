import { isE2ETestMode } from "./e2e-test.server";
import type { ShopifyGraphqlClient } from "./shopifyDiscounts.server";

const EXTENSION_UID = "07333e7d-52b3-bfc5-0ef1-b67701f5552ae39da71d";
const EMBED_BLOCK_NAME = "promo-pulse-embed";
const PRODUCT_BLOCK_NAME = "product-timer";
const CART_BLOCK_NAME = "cart-timer";

export type ThemeAppBlockStatus = {
  appEmbedEnabled: boolean;
  productBlockAdded: boolean;
  cartBlockAdded: boolean;
};

const emptyStatus: ThemeAppBlockStatus = {
  appEmbedEnabled: false,
  productBlockAdded: false,
  cartBlockAdded: false,
};

type ThemeFilesResponse = {
  data?: {
    themes?: {
      nodes?: Array<{
        files?: {
          nodes?: Array<{
            filename?: string | null;
            body?: { content?: string | null } | null;
          } | null> | null;
        } | null;
      } | null> | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

export async function detectThemeAppBlockStatus(
  admin?: ShopifyGraphqlClient | null,
): Promise<ThemeAppBlockStatus> {
  if (isE2ETestMode() || !admin) {
    return emptyStatus;
  }

  try {
    const response = await admin.graphql(
      `#graphql
        query PromoPulseThemeAppBlockStatus {
          themes(first: 1, roles: [MAIN]) {
            nodes {
              files(
                filenames: [
                  "config/settings_data.json"
                  "templates/product.json"
                  "templates/cart.json"
                ]
              ) {
                nodes {
                  filename
                  body {
                    ... on OnlineStoreThemeFileBodyText {
                      content
                    }
                  }
                }
              }
            }
          }
        }`,
    );

    if (!response.ok) return emptyStatus;

    const body = (await response.json()) as ThemeFilesResponse;
    if (body.errors?.length) return emptyStatus;

    const files = body.data?.themes?.nodes?.[0]?.files?.nodes ?? [];
    const settingsData = files.find(
      (file) => file?.filename === "config/settings_data.json",
    )?.body?.content;
    const productTemplate = files.find(
      (file) => file?.filename === "templates/product.json",
    )?.body?.content;
    const cartTemplate = files.find(
      (file) => file?.filename === "templates/cart.json",
    )?.body?.content;

    return {
      appEmbedEnabled: hasEnabledEmbedBlock(settingsData),
      productBlockAdded: hasEnabledTemplateBlock(productTemplate),
      cartBlockAdded: hasEnabledTemplateBlock(cartTemplate),
    };
  } catch (error) {
    console.error("Failed to detect theme app block status", error);
    return emptyStatus;
  }
}

function hasEnabledEmbedBlock(content: string | null | undefined): boolean {
  const parsed = parseJson(content) as {
    current?: { blocks?: unknown };
  } | null;
  const blocks = parsed?.current?.blocks;
  if (!blocks || typeof blocks !== "object") return false;

  return Object.values(blocks as Record<string, unknown>).some((block) =>
    isMatchingEnabledBlock(block, EMBED_BLOCK_NAME),
  );
}

function hasEnabledTemplateBlock(
  content: string | null | undefined,
): boolean {
  const parsed = parseJson(content) as { sections?: unknown } | null;
  const sections = parsed?.sections;
  if (!sections || typeof sections !== "object") return false;

  return Object.values(sections as Record<string, unknown>).some(
    (section) => {
      if (!section || typeof section !== "object") return false;
      const blocks = (section as Record<string, unknown>).blocks;
      if (!blocks || typeof blocks !== "object") return false;

      return Object.values(blocks as Record<string, unknown>).some(
        (block) =>
          isMatchingEnabledBlock(block, PRODUCT_BLOCK_NAME) ||
          isMatchingEnabledBlock(block, CART_BLOCK_NAME),
      );
    },
  );
}

function isMatchingEnabledBlock(block: unknown, blockName: string): boolean {
  if (!block || typeof block !== "object") return false;

  const { type, disabled } = block as { type?: unknown; disabled?: unknown };
  if (typeof type !== "string") return false;
  if (disabled === true) return false;

  return type.includes(EXTENSION_UID) && type.includes(`/${blockName}/`);
}

function parseJson(content: string | null | undefined): unknown {
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
