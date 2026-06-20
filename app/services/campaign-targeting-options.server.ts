import { isE2ETestMode } from "./e2e-test.server";
import type { ShopifyGraphqlClient } from "./shopifyDiscounts.server";
import type {
  CampaignCountryOption,
  CampaignTargetingOptions,
} from "../types/campaign-form";

type TargetingOptionsResponse = {
  data?: {
    productTags?: {
      edges?: Array<{ node?: string | null } | null> | null;
      nodes?: Array<string | null> | null;
    } | null;
    markets?: {
      nodes?: Array<{
        regions?: {
          nodes?: Array<{
            code?: string | null;
            name?: string | null;
          } | null> | null;
        } | null;
      } | null> | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

export async function loadCampaignTargetingOptions(
  admin?: ShopifyGraphqlClient | null,
): Promise<CampaignTargetingOptions> {
  if (isE2ETestMode() || !admin) {
    return {
      countries: demoCountries(),
      productTags: ["sale", "limited", "preorder", "new-arrival"],
    };
  }

  const response = await admin.graphql(
    `#graphql
      query CounterPulseCampaignTargetingOptions($tagsFirst: Int!, $marketsFirst: Int!) {
        productTags(first: $tagsFirst) {
          edges {
            node
          }
        }
        markets(first: $marketsFirst) {
          nodes {
            regions(first: 50) {
              nodes {
                ... on MarketRegionCountry {
                  code
                  name
                }
              }
            }
          }
        }
      }`,
    { variables: { tagsFirst: 250, marketsFirst: 50 } },
  );
  const body = (await response.json()) as TargetingOptionsResponse;

  if (!response.ok || body.errors?.length) {
    throw new Error(
      body.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join(" ") || "Campaign targeting options could not be loaded.",
    );
  }

  return {
    countries: readCountries(body),
    productTags: readProductTags(body),
  };
}

function readProductTags(body: TargetingOptionsResponse) {
  const productTags = body.data?.productTags;
  const values = [
    ...(productTags?.nodes ?? []),
    ...(productTags?.edges ?? []).map((edge) => edge?.node ?? ""),
  ];

  return uniqueSorted(
    values
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean),
  );
}

function readCountries(body: TargetingOptionsResponse) {
  const countries = new Map<string, CampaignCountryOption>();

  for (const market of body.data?.markets?.nodes ?? []) {
    for (const region of market?.regions?.nodes ?? []) {
      const code = region?.code?.trim().toUpperCase() ?? "";
      const name = region?.name?.trim() ?? code;

      if (code && !countries.has(code)) {
        countries.set(code, { code, name });
      }
    }
  }

  return Array.from(countries.values()).sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((first, second) =>
    first.localeCompare(second),
  );
}

function demoCountries(): CampaignCountryOption[] {
  return [
    { code: "AR", name: "Argentina" },
    { code: "BR", name: "Brazil" },
    { code: "CA", name: "Canada" },
    { code: "GB", name: "United Kingdom" },
    { code: "US", name: "United States" },
  ];
}
