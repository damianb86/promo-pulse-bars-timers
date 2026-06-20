import { isE2ETestMode } from "./e2e-test.server";
import type { ShopifyGraphqlClient } from "./shopifyDiscounts.server";
import type {
  CampaignDesignImageOption,
  CampaignDesignMediaOptions,
} from "../types/campaign-design";

type ShopifyImageFileNode = {
  __typename?: string;
  id?: string | null;
  alt?: string | null;
  mimeType?: string | null;
  url?: string | null;
  image?: {
    url?: string | null;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  preview?: {
    image?: {
      url?: string | null;
    } | null;
  } | null;
};

type ShopifyFilesResponse = {
  data?: {
    files?: {
      nodes?: Array<ShopifyImageFileNode | null> | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

type ShopifyFileResponse = {
  data?: {
    node?: ShopifyImageFileNode | null;
  };
  errors?: Array<{ message?: string }>;
};

type DesignFileUsage = "background" | "icon";

export async function loadCampaignDesignMediaOptions(
  admin?: ShopifyGraphqlClient | null,
): Promise<CampaignDesignMediaOptions> {
  if (isE2ETestMode() || !admin) {
    return {
      images: [],
    };
  }

  const response = await admin.graphql(
    `#graphql
      query CounterPulseDesignImages($first: Int!, $query: String!) {
        files(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          nodes {
            ... on MediaImage {
              id
              alt
              image {
                url
                altText
                width
                height
              }
              preview {
                image {
                  url
                }
              }
            }
          }
        }
      }`,
    { variables: { first: 24, query: "media_type:IMAGE" } },
  );
  const body = (await response.json()) as ShopifyFilesResponse;

  if (!response.ok || body.errors?.length) {
    throw new Error(
      body.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join(" ") || "Campaign design images could not be loaded.",
    );
  }

  return {
    images: readImageOptions(body),
  };
}

export async function loadCampaignDesignFileOption(
  admin: ShopifyGraphqlClient,
  fileId: string,
  usage: DesignFileUsage,
) {
  const response = await admin.graphql(
    `#graphql
      query CounterPulseDesignFile($id: ID!) {
        node(id: $id) {
          __typename
          ... on MediaImage {
            id
            alt
            image {
              url
              altText
              width
              height
            }
            preview {
              image {
                url
              }
            }
          }
          ... on GenericFile {
            id
            alt
            mimeType
            url
            preview {
              image {
                url
              }
            }
          }
        }
      }`,
    { variables: { id: fileId } },
  );
  const body = (await response.json()) as ShopifyFileResponse;

  if (!response.ok || body.errors?.length) {
    throw new Error(
      body.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join(" ") || "Selected file could not be loaded.",
    );
  }

  const option = readImageOption(body.data?.node, usage);

  if (!option) {
    throw new Error("Choose a supported Shopify image file.");
  }

  return option;
}

function readImageOptions(body: ShopifyFilesResponse) {
  return (body.data?.files?.nodes ?? [])
    .map((node) => readImageOption(node, "background"))
    .filter((option): option is CampaignDesignImageOption => Boolean(option));
}

function readImageOption(
  node: ShopifyImageFileNode | null | undefined,
  usage: DesignFileUsage,
): CampaignDesignImageOption | null {
  const id = node?.id?.trim() ?? "";
  const mimeType = node?.mimeType?.trim().toLowerCase() ?? "";
  const mediaImageUrl = node?.image?.url?.trim() ?? "";
  const genericFileUrl = node?.url?.trim() ?? "";
  const url = mediaImageUrl || genericFileUrl;
  const previewUrl = node?.preview?.image?.url?.trim() || url;
  const alt = node?.image?.altText?.trim() || node?.alt?.trim() || "";
  const label =
    alt ||
    buildImageLabel(node?.image?.width, node?.image?.height) ||
    "Shopify image";

  if (!id || !isSafeImageUrl(url)) return null;

  if (
    usage === "icon" &&
    node?.__typename === "GenericFile" &&
    !isSupportedIconMimeType(mimeType)
  ) {
    return null;
  }

  return {
    id,
    label,
    url,
    previewUrl: isSafeImageUrl(previewUrl) ? previewUrl : url,
    ...(alt ? { alt } : {}),
  };
}

function isSupportedIconMimeType(mimeType: string) {
  return ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"].includes(
    mimeType,
  );
}

function buildImageLabel(width?: number | null, height?: number | null) {
  if (!width || !height) return "";
  return `${width}x${height}`;
}

function isSafeImageUrl(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}
