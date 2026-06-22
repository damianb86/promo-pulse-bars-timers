export type ShopifyGraphqlClient = {
  graphql(
    query: string,
    options?: { variables?: Record<string, unknown> },
  ): Promise<Response>;
};

export type ShopifyDiscountSummary = {
  id: string;
  code: string;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  type: string;
};

export type CreateBasicCodeDiscountInput = {
  title: string;
  code: string;
  valueType: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  appliesOncePerCustomer: boolean;
};

export type CreateFreeShippingCodeDiscountInput = {
  title: string;
  code: string;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  minimumSubtotal?: number | null;
  appliesOncePerCustomer: boolean;
};

export type AutomaticFreeShippingDiscountInput = {
  title: string;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  minimumSubtotal?: number | null;
  destinationCountries?: string[];
  maximumShippingPrice?: number | null;
  appliesOnOneTimePurchase?: boolean;
  appliesOnSubscription?: boolean;
  combinesWith?: {
    orderDiscounts?: boolean;
    productDiscounts?: boolean;
  };
};

export type CampaignDateSyncInput = {
  syncStartEnd: boolean;
};

export type SyncedCampaignDates = {
  startsAt: Date | null;
  endsAt: Date | null;
  lastSyncedAt: Date;
};

export const SHOPIFY_DISCOUNT_SCOPE_MESSAGE =
  "Promo Pulse needs read_discounts and write_discounts scopes. Update SCOPES and reinstall or reauthorize the app.";

const DISCOUNT_FIELDS = `#graphql
      __typename
      ... on DiscountCodeBasic {
        title
        status
        startsAt
        endsAt
        codes(first: 1) {
          nodes {
            code
          }
        }
      }
      ... on DiscountCodeFreeShipping {
        title
        status
        startsAt
        endsAt
        codes(first: 1) {
          nodes {
            code
          }
        }
      }
      ... on DiscountCodeBxgy {
        title
        status
        startsAt
        endsAt
        codes(first: 1) {
          nodes {
            code
          }
        }
      }
      ... on DiscountAutomaticFreeShipping {
        title
        status
        startsAt
        endsAt
      }
`;

const DISCOUNT_CODE_NODE_FRAGMENT = `#graphql
  fragment PromoPulseCodeDiscountFields on DiscountCodeNode {
    id
    codeDiscount {
${DISCOUNT_FIELDS}
    }
  }
`;

const DISCOUNT_NODE_FRAGMENT = `#graphql
  fragment PromoPulseDiscountNodeFields on DiscountNode {
    id
    discount {
${DISCOUNT_FIELDS}
    }
  }
`;

const DISCOUNT_AUTOMATIC_NODE_FRAGMENT = `#graphql
  fragment PromoPulseAutomaticDiscountFields on DiscountAutomaticNode {
    id
    automaticDiscount {
${DISCOUNT_FIELDS}
    }
  }
`;

export async function listCodeDiscounts(
  admin: ShopifyGraphqlClient,
  options: { first?: number; query?: string } = {},
) {
  const response = await executeGraphql<{
    discountNodes?: {
      nodes?: DiscountNodeRecord[];
    };
  }>(
    admin,
    `${DISCOUNT_NODE_FRAGMENT}
    query PromoPulseListCodeDiscounts($first: Int!, $query: String) {
      discountNodes(first: $first, query: $query) {
        nodes {
          ...PromoPulseDiscountNodeFields
        }
      }
    }`,
    {
      first: Math.min(Math.max(options.first ?? 20, 1), 50),
      query: options.query || "method:code",
    },
  );

  return (response.discountNodes?.nodes ?? [])
    .map(normalizeDiscountNode)
    .filter(
      (discount): discount is ShopifyDiscountSummary => discount !== null,
    );
}

export async function getDiscountByCodeOrId(
  admin: ShopifyGraphqlClient,
  codeOrId: string,
) {
  const value = codeOrId.trim();

  if (!value) return null;

  if (value.startsWith("gid://shopify/Discount")) {
    const response = await executeGraphql<{
      node?: DiscountNodeRecord | null;
    }>(
      admin,
      `${DISCOUNT_CODE_NODE_FRAGMENT}
      ${DISCOUNT_NODE_FRAGMENT}
      ${DISCOUNT_AUTOMATIC_NODE_FRAGMENT}
      query PromoPulseDiscountById($id: ID!) {
        node(id: $id) {
          ... on DiscountCodeNode {
            ...PromoPulseCodeDiscountFields
          }
          ... on DiscountNode {
            ...PromoPulseDiscountNodeFields
          }
          ... on DiscountAutomaticNode {
            ...PromoPulseAutomaticDiscountFields
          }
        }
      }`,
      { id: value },
    );

    return normalizeDiscountNode(response.node ?? null);
  }

  const response = await executeGraphql<{
    codeDiscountNodeByCode?: DiscountNodeRecord | null;
  }>(
    admin,
    `${DISCOUNT_CODE_NODE_FRAGMENT}
    query PromoPulseDiscountByCode($code: String!) {
      codeDiscountNodeByCode(code: $code) {
        ...PromoPulseCodeDiscountFields
      }
    }`,
    { code: value },
  );

  return normalizeDiscountNode(response.codeDiscountNodeByCode ?? null);
}

export async function createBasicCodeDiscount(
  admin: ShopifyGraphqlClient,
  input: CreateBasicCodeDiscountInput,
) {
  const value =
    input.valueType === "PERCENTAGE"
      ? { percentage: normalizePercentage(input.value) }
      : {
          discountAmount: {
            amount: input.value.toFixed(2),
            appliesOnEachItem: false,
          },
        };
  const response = await executeGraphql<{
    discountCodeBasicCreate?: DiscountMutationPayload;
  }>(
    admin,
    `${DISCOUNT_CODE_NODE_FRAGMENT}
    mutation PromoPulseCreateBasicDiscount($input: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $input) {
        codeDiscountNode {
          ...PromoPulseCodeDiscountFields
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      input: {
        title: input.title,
        code: input.code,
        startsAt: toIsoDate(input.startsAt) ?? new Date().toISOString(),
        endsAt: toIsoDate(input.endsAt),
        customerSelection: { all: true },
        customerGets: {
          value,
          items: { all: true },
        },
        appliesOncePerCustomer: input.appliesOncePerCustomer,
      },
    },
  );

  return parseMutationPayload(response.discountCodeBasicCreate);
}

export async function createFreeShippingCodeDiscount(
  admin: ShopifyGraphqlClient,
  input: CreateFreeShippingCodeDiscountInput,
) {
  const freeShippingCodeDiscount: Record<string, unknown> = {
    title: input.title,
    code: input.code,
    startsAt: toIsoDate(input.startsAt) ?? new Date().toISOString(),
    endsAt: toIsoDate(input.endsAt),
    customerSelection: { all: true },
    destination: { all: true },
    appliesOncePerCustomer: input.appliesOncePerCustomer,
  };

  if (input.minimumSubtotal && input.minimumSubtotal > 0) {
    freeShippingCodeDiscount.minimumRequirement = {
      subtotal: {
        greaterThanOrEqualToSubtotal: input.minimumSubtotal.toFixed(2),
      },
    };
  }

  const response = await executeGraphql<{
    discountCodeFreeShippingCreate?: DiscountMutationPayload;
  }>(
    admin,
    `${DISCOUNT_CODE_NODE_FRAGMENT}
    mutation PromoPulseCreateFreeShippingDiscount($input: DiscountCodeFreeShippingInput!) {
      discountCodeFreeShippingCreate(freeShippingCodeDiscount: $input) {
        codeDiscountNode {
          ...PromoPulseCodeDiscountFields
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      input: freeShippingCodeDiscount,
    },
  );

  return parseMutationPayload(response.discountCodeFreeShippingCreate);
}

export async function createAutomaticFreeShippingDiscount(
  admin: ShopifyGraphqlClient,
  input: AutomaticFreeShippingDiscountInput,
) {
  const response = await executeGraphql<{
    discountAutomaticFreeShippingCreate?: DiscountMutationPayload;
  }>(
    admin,
    `${DISCOUNT_AUTOMATIC_NODE_FRAGMENT}
    mutation PromoPulseCreateAutomaticFreeShippingDiscount($input: DiscountAutomaticFreeShippingInput!) {
      discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $input) {
        automaticDiscountNode {
          ...PromoPulseAutomaticDiscountFields
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      input: buildAutomaticFreeShippingDiscountInput(input),
    },
  );

  return parseMutationPayload(response.discountAutomaticFreeShippingCreate);
}

export async function updateAutomaticFreeShippingDiscount(
  admin: ShopifyGraphqlClient,
  discountId: string,
  input: AutomaticFreeShippingDiscountInput,
) {
  const response = await executeGraphql<{
    discountAutomaticFreeShippingUpdate?: DiscountMutationPayload;
  }>(
    admin,
    `${DISCOUNT_AUTOMATIC_NODE_FRAGMENT}
    mutation PromoPulseUpdateAutomaticFreeShippingDiscount($id: ID!, $input: DiscountAutomaticFreeShippingInput!) {
      discountAutomaticFreeShippingUpdate(id: $id, freeShippingAutomaticDiscount: $input) {
        automaticDiscountNode {
          ...PromoPulseAutomaticDiscountFields
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      id: discountId,
      input: buildAutomaticFreeShippingDiscountInput(input),
    },
  );

  return parseMutationPayload(response.discountAutomaticFreeShippingUpdate);
}

export async function deactivateCodeDiscount(
  admin: ShopifyGraphqlClient,
  discountId: string,
) {
  const response = await executeGraphql<{
    discountCodeDeactivate?: {
      codeDiscountNode?: {
        id?: string | null;
      } | null;
      userErrors?: Array<{
        field?: string[] | string | null;
        message?: string | null;
      }>;
    };
  }>(
    admin,
    `#graphql
    mutation PromoPulseDeactivateCodeDiscount($id: ID!) {
      discountCodeDeactivate(id: $id) {
        codeDiscountNode {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    { id: discountId },
  );
  const userErrors = response.discountCodeDeactivate?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(
      userErrors
        .map((error) => error.message)
        .filter(Boolean)
        .join(" "),
    );
  }

  return {
    id: response.discountCodeDeactivate?.codeDiscountNode?.id ?? discountId,
  };
}

export function syncCampaignDatesFromDiscount(
  campaign: CampaignDateSyncInput,
  discount: Pick<ShopifyDiscountSummary, "startsAt" | "endsAt"> | null,
): SyncedCampaignDates | null {
  if (!campaign.syncStartEnd || !discount) return null;

  return {
    startsAt: parseDate(discount.startsAt),
    endsAt: parseDate(discount.endsAt),
    lastSyncedAt: new Date(),
  };
}

type DiscountNodeRecord = {
  id?: string | null;
  discount?: DiscountCodeRecord | null;
  codeDiscount?: DiscountCodeRecord | null;
  automaticDiscount?: DiscountCodeRecord | null;
};

type DiscountCodeRecord = {
  __typename?: string;
  title?: string | null;
  status?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  codes?: {
    nodes?: Array<{ code?: string | null }>;
  };
};

type DiscountMutationPayload = {
  codeDiscountNode?: DiscountNodeRecord | null;
  automaticDiscountNode?: DiscountNodeRecord | null;
  userErrors?: Array<{
    field?: string[] | string | null;
    message?: string | null;
  }>;
};

async function executeGraphql<T>(
  admin: ShopifyGraphqlClient,
  query: string,
  variables: Record<string, unknown>,
) {
  let response: Response;

  try {
    response = await admin.graphql(query, { variables });
  } catch (error) {
    throw new Error(formatGraphqlTransportError(error));
  }

  let payload: {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  try {
    payload = (await response.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };
  } catch {
    throw new Error(
      `Shopify Admin API returned a non-JSON response while configuring discounts. HTTP status: ${response.status}.`,
    );
  }

  if (payload.errors?.length) {
    throw new Error(formatGraphqlErrors(payload.errors));
  }

  return (payload.data ?? {}) as T;
}

function parseMutationPayload(payload: DiscountMutationPayload | undefined) {
  const userErrors = payload?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(
      userErrors.map(formatDiscountUserError).filter(Boolean).join(" "),
    );
  }

  const discount = normalizeDiscountNode(
    payload?.codeDiscountNode ?? payload?.automaticDiscountNode ?? null,
  );

  if (!discount) {
    throw new Error("Shopify did not return the created discount.");
  }

  return discount;
}

function normalizeDiscountNode(
  node: DiscountNodeRecord | null,
): ShopifyDiscountSummary | null {
  const discount =
    node?.codeDiscount ?? node?.discount ?? node?.automaticDiscount;

  if (!node?.id || !discount) return null;

  const code = discount.codes?.nodes?.[0]?.code ?? "";

  return {
    id: node.id,
    code,
    title: discount.title ?? code,
    status: discount.status ?? "UNKNOWN",
    startsAt: discount.startsAt ?? null,
    endsAt: discount.endsAt ?? null,
    type: discount.__typename ?? "DiscountCode",
  };
}

function formatDiscountUserError(error: {
  field?: string[] | string | null;
  message?: string | null;
}) {
  const message = error.message?.trim();
  if (!message) return "";

  const field = Array.isArray(error.field)
    ? error.field.filter(Boolean).join(".")
    : error.field;

  return field ? `${field}: ${message}` : message;
}

function normalizePercentage(value: number) {
  if (value <= 1) return value;
  return value / 100;
}

function buildAutomaticFreeShippingDiscountInput(
  input: AutomaticFreeShippingDiscountInput,
) {
  const freeShippingAutomaticDiscount: Record<string, unknown> = {
    title: input.title,
    startsAt: toIsoDate(input.startsAt) ?? new Date().toISOString(),
    endsAt: toIsoDate(input.endsAt),
    destination: input.destinationCountries?.length
      ? { countries: { add: input.destinationCountries } }
      : { all: true },
    appliesOnOneTimePurchase: input.appliesOnOneTimePurchase ?? true,
    appliesOnSubscription: input.appliesOnSubscription ?? false,
    combinesWith: {
      orderDiscounts: input.combinesWith?.orderDiscounts ?? true,
      productDiscounts: input.combinesWith?.productDiscounts ?? true,
    },
  };

  if (input.maximumShippingPrice && input.maximumShippingPrice > 0) {
    freeShippingAutomaticDiscount.maximumShippingPrice =
      input.maximumShippingPrice.toFixed(2);
  }

  if (input.minimumSubtotal && input.minimumSubtotal > 0) {
    freeShippingAutomaticDiscount.minimumRequirement = {
      subtotal: {
        greaterThanOrEqualToSubtotal: input.minimumSubtotal.toFixed(2),
      },
    };
  }

  return freeShippingAutomaticDiscount;
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatGraphqlErrors(errors: Array<{ message?: string }>) {
  const message = errors
    .map((error) => error.message)
    .filter(Boolean)
    .join(" ");

  if (/access|scope|permission|denied/i.test(message)) {
    return `${SHOPIFY_DISCOUNT_SCOPE_MESSAGE} Shopify response: ${message}`;
  }

  return message || "Shopify Admin API returned an unknown GraphQL error.";
}

function formatGraphqlTransportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/access|scope|permission|denied/i.test(message)) {
    return `${SHOPIFY_DISCOUNT_SCOPE_MESSAGE} Shopify response: ${message}`;
  }

  return `Shopify Admin API request failed: ${message}`;
}
