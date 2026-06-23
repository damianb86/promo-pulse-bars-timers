import type { APIRequestContext } from "@playwright/test";

import {
  DISCOUNT_CODE_PREFIX,
  E2E_PREFIX,
  e2eProductTitle,
  getConfig,
} from "./env";

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function ensureTestProductHandle(request: APIRequestContext) {
  const config = getConfig();
  if (config.productHandle) return config.productHandle;
  if (!config.adminAccessToken) return "";

  const existing = await findPrefixedProduct(request);
  if (existing?.handle) return existing.handle;

  const handle = `pp-e2e-test-product-${Date.now()}`;
  const mutation = `
    mutation CreateRealE2EProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product {
          id
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const result = await adminGraphql<{
    productCreate: {
      product: { id: string; handle: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(request, mutation, {
    product: {
      handle,
      productType: "Real E2E",
      status: "ACTIVE",
      tags: ["pp-e2e"],
      title: e2eProductTitle(),
      vendor: "Promo Pulse",
    },
  });

  const errors = result.data?.productCreate.userErrors ?? [];
  if (errors.length > 0 || !result.data?.productCreate.product) {
    throw new Error(
      `Shopify Admin API could not create ${E2E_PREFIX} product: ${errors
        .map((error) => error.message)
        .join(", ")}`,
    );
  }

  await publishProductBestEffort(request, result.data.productCreate.product.id);
  return result.data.productCreate.product.handle;
}

export async function cleanupE2EProducts(request: APIRequestContext) {
  const config = getConfig();
  if (!config.adminAccessToken || !config.cleanup) return;

  const existing = await findPrefixedProduct(request);
  if (!existing?.id || !existing.title.startsWith(E2E_PREFIX)) return;

  const mutation = `
    mutation DeleteRealE2EProduct($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        deletedProductId
        userErrors {
          field
          message
        }
      }
    }
  `;

  await adminGraphql(request, mutation, { input: { id: existing.id } });
}

export async function cleanupE2EDiscounts(request: APIRequestContext) {
  const config = getConfig();
  if (!config.adminAccessToken || !config.cleanup) return;

  const query = `
    query RealE2EDiscounts($query: String!) {
      codeDiscountNodes(first: 20, query: $query) {
        nodes {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              codes(first: 1) {
                nodes {
                  code
                }
              }
            }
            ... on DiscountCodeFreeShipping {
              title
              codes(first: 1) {
                nodes {
                  code
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await adminGraphql<{
    codeDiscountNodes: {
      nodes: Array<{
        id: string;
        codeDiscount?: {
          title?: string;
          codes?: { nodes: Array<{ code: string }> };
        };
      }>;
    };
  }>(request, query, { query: DISCOUNT_CODE_PREFIX });

  const discountIds =
    result.data?.codeDiscountNodes.nodes
      .filter((node) => {
        const code = node.codeDiscount?.codes?.nodes[0]?.code ?? "";
        const title = node.codeDiscount?.title ?? "";
        return (
          code.startsWith(DISCOUNT_CODE_PREFIX) || title.startsWith(E2E_PREFIX)
        );
      })
      .map((node) => node.id) ?? [];

  for (const id of discountIds) {
    await adminGraphql(
      request,
      `
        mutation DeleteRealE2EDiscount($id: ID!) {
          discountCodeDelete(id: $id) {
            deletedCodeDiscountId
            userErrors {
              field
              message
            }
          }
        }
      `,
      { id },
    );
  }
}

export async function createE2EOrder(request: APIRequestContext) {
  const orderLabel = `${E2E_PREFIX} Generated Order ${Date.now()}`;
  const email = `pp-e2e+${Date.now()}@example.com`;
  const amount = 12.34;
  const currencyCode = "USD";
  const mutation = `
    mutation CreateRealE2EOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
      orderCreate(order: $order, options: $options) {
        order {
          id
          email
          statusPageUrl
          displayFinancialStatus
          lineItems(first: 5) {
            nodes {
              title
              quantity
            }
          }
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const result = await adminGraphql<{
    orderCreate: {
      order: {
        displayFinancialStatus: string;
        email: string | null;
        id: string;
        statusPageUrl: string | null;
        lineItems: { nodes: Array<{ quantity: number; title: string }> };
        totalPriceSet: {
          shopMoney: { amount: string; currencyCode: string };
        };
      } | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(request, mutation, {
    order: {
      currency: currencyCode,
      email,
      lineItems: [
        {
          priceSet: {
            shopMoney: {
              amount,
              currencyCode,
            },
          },
          quantity: 1,
          title: orderLabel,
        },
      ],
      transactions: [
        {
          amountSet: {
            shopMoney: {
              amount,
              currencyCode,
            },
          },
          kind: "SALE",
          status: "SUCCESS",
        },
      ],
    },
    options: {
      sendFulfillmentReceipt: false,
      sendReceipt: false,
    },
  });

  const errors = result.data?.orderCreate.userErrors ?? [];
  if (errors.length > 0 || !result.data?.orderCreate.order) {
    throw new Error(
      `Shopify Admin API could not create ${E2E_PREFIX} order: ${errors
        .map((error) => error.message)
        .join(", ")}`,
    );
  }

  return result.data.orderCreate.order;
}

async function findPrefixedProduct(request: APIRequestContext) {
  const result = await adminGraphql<{
    products: {
      nodes: Array<{ handle: string; id: string; title: string }>;
    };
  }>(
    request,
    `
      query RealE2EProducts($query: String!) {
        products(first: 10, query: $query) {
          nodes {
            id
            handle
            title
          }
        }
      }
    `,
    { query: `title:'${e2eProductTitle()}'` },
  );

  return (
    result.data?.products.nodes.find((product) =>
      product.title.startsWith(E2E_PREFIX),
    ) ?? null
  );
}

async function publishProductBestEffort(
  request: APIRequestContext,
  productId: string,
) {
  const publications = await adminGraphql<{
    publications: { nodes: Array<{ id: string; name: string }> };
  }>(
    request,
    `
      query RealE2EPublications {
        publications(first: 10) {
          nodes {
            id
            name
          }
        }
      }
    `,
  );

  const onlineStore = publications.data?.publications.nodes.find(
    (publication) => /online store/i.test(publication.name),
  );

  if (!onlineStore) return;

  await adminGraphql(
    request,
    `
      mutation PublishRealE2EProduct($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors {
            field
            message
          }
        }
      }
    `,
    { id: productId, input: [{ publicationId: onlineStore.id }] },
  );
}

export async function adminGraphql<T>(
  request: APIRequestContext,
  query: string,
  variables: Record<string, unknown> = {},
) {
  const config = getConfig();
  const response = await request.post(
    `https://${config.shopDomain}/admin/api/${config.adminApiVersion}/graphql.json`,
    {
      data: { query, variables },
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.adminAccessToken,
      },
    },
  );
  const json = (await response.json()) as GraphqlResponse<T>;

  if (!response.ok() || json.errors?.length) {
    throw new Error(
      `Shopify Admin GraphQL failed: ${
        json.errors?.map((error) => error.message).join(", ") ??
        response.statusText()
      }`,
    );
  }

  return json;
}
