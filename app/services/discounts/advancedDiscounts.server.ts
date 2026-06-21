import {
  AdvancedDiscountRuleStatus,
  AdvancedDiscountRuleType,
  Prisma,
  type AdvancedDiscountRule,
} from "@prisma/client";

import prisma from "../../db.server";
import { isE2ETestMode } from "../e2e-test.server";
import { canUsePremiumFeature } from "../premiumFeatures.server";
import {
  SHOPIFY_DISCOUNT_SCOPE_MESSAGE,
  type ShopifyGraphqlClient,
} from "../shopifyDiscounts.server";

export const ADVANCED_DISCOUNT_FUNCTION_HANDLE =
  process.env.SHOPIFY_ADVANCED_DISCOUNT_FUNCTION_HANDLE ||
  "promo-pulse-advanced-discounts";
export const ADVANCED_DISCOUNT_FUNCTION_ID =
  process.env.SHOPIFY_ADVANCED_DISCOUNT_FUNCTION_ID || "";
export const ADVANCED_DISCOUNT_METAFIELD_NAMESPACE =
  process.env.SHOPIFY_ADVANCED_DISCOUNT_METAFIELD_NAMESPACE ||
  "$app:promo-pulse";
export const ADVANCED_DISCOUNT_METAFIELD_KEY =
  process.env.SHOPIFY_ADVANCED_DISCOUNT_METAFIELD_KEY ||
  "advanced-discount-config";

export type AdvancedDiscountRuleInput = {
  title: string;
  ruleType: AdvancedDiscountRuleType;
  thresholds?: unknown;
  productIds?: string[];
  collectionIds?: string[];
  discountValue?: number | null;
  shippingDiscountValue?: number | null;
  status?: AdvancedDiscountRuleStatus;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
};

export type AppDiscountMutationResult = {
  rule: AdvancedDiscountRule;
  remoteCreated: boolean;
  remoteDeleted?: boolean;
  warning?: string;
};

export class AdvancedDiscountsError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AdvancedDiscountsError";
  }
}

export async function createAppDiscount({
  admin,
  campaignId,
  functionHandle = ADVANCED_DISCOUNT_FUNCTION_HANDLE,
  functionId = ADVANCED_DISCOUNT_FUNCTION_ID,
  input,
  shopId,
}: {
  admin?: ShopifyGraphqlClient | null;
  campaignId?: string | null;
  functionHandle?: string;
  functionId?: string;
  input: AdvancedDiscountRuleInput;
  shopId: string;
}): Promise<AppDiscountMutationResult> {
  await assertAdvancedDiscountsAllowed(shopId);
  await assertCampaignBelongsToShop(shopId, campaignId);

  const normalizedInput = normalizeAdvancedDiscountRuleInput(input);
  const shouldCreateRemote =
    normalizedInput.status === AdvancedDiscountRuleStatus.ACTIVE;
  const canCreateRemote =
    shouldCreateRemote &&
    (isE2ETestMode() || Boolean(admin && (functionHandle || functionId)));
  const initialStatus = canCreateRemote
    ? AdvancedDiscountRuleStatus.DRAFT
    : normalizedInput.status === AdvancedDiscountRuleStatus.ACTIVE
      ? AdvancedDiscountRuleStatus.DRAFT
      : normalizedInput.status;

  let rule = await prisma.advancedDiscountRule.create({
    data: {
      ...toPrismaCreateData(shopId, campaignId, normalizedInput),
      status: initialStatus,
      functionId: functionId || null,
    },
  });

  if (!shouldCreateRemote) {
    return { rule, remoteCreated: false };
  }

  if (isE2ETestMode()) {
    rule = await prisma.advancedDiscountRule.update({
      where: { id: rule.id },
      data: {
        shopifyDiscountId: `e2e://advanced-discount/${rule.id}`,
        status: AdvancedDiscountRuleStatus.ACTIVE,
      },
    });

    return { rule, remoteCreated: true };
  }

  if (!admin || (!functionHandle && !functionId)) {
    return {
      rule,
      remoteCreated: false,
      warning:
        "Rule saved as draft. Configure SHOPIFY_ADVANCED_DISCOUNT_FUNCTION_HANDLE or SHOPIFY_ADVANCED_DISCOUNT_FUNCTION_ID to create the Shopify app discount.",
    };
  }

  const remoteDiscount = await createRemoteAutomaticAppDiscount(admin, rule, {
    functionHandle,
    functionId,
  });
  rule = await prisma.advancedDiscountRule.update({
    where: { id: rule.id },
    data: {
      functionId: (remoteDiscount.functionId ?? functionId) || null,
      shopifyDiscountId: remoteDiscount.discountId,
      status: AdvancedDiscountRuleStatus.ACTIVE,
    },
  });

  return { rule, remoteCreated: true };
}

export async function updateAppDiscount({
  admin,
  functionHandle = ADVANCED_DISCOUNT_FUNCTION_HANDLE,
  functionId = ADVANCED_DISCOUNT_FUNCTION_ID,
  input,
  ruleId,
  shopId,
}: {
  admin?: ShopifyGraphqlClient | null;
  functionHandle?: string;
  functionId?: string;
  input: AdvancedDiscountRuleInput;
  ruleId: string;
  shopId: string;
}): Promise<AppDiscountMutationResult> {
  await assertAdvancedDiscountsAllowed(shopId);
  const existingRule = await loadRuleForShop(shopId, ruleId);
  const normalizedInput = normalizeAdvancedDiscountRuleInput(input);
  let rule = await prisma.advancedDiscountRule.update({
    where: { id: existingRule.id },
    data: {
      title: normalizedInput.title,
      ruleType: normalizedInput.ruleType,
      thresholds: toNullableJson(normalizedInput.thresholds),
      productIds: normalizedInput.productIds,
      collectionIds: normalizedInput.collectionIds,
      discountValue: toNullableDecimal(normalizedInput.discountValue),
      shippingDiscountValue: toNullableDecimal(
        normalizedInput.shippingDiscountValue,
      ),
      startsAt: toNullableDate(normalizedInput.startsAt),
      endsAt: toNullableDate(normalizedInput.endsAt),
      status:
        normalizedInput.status === AdvancedDiscountRuleStatus.ACTIVE &&
        !existingRule.shopifyDiscountId &&
        !isE2ETestMode() &&
        (!admin || (!functionHandle && !functionId))
          ? AdvancedDiscountRuleStatus.DRAFT
          : normalizedInput.status,
      functionId: functionId || existingRule.functionId,
    },
  });

  if (normalizedInput.status !== AdvancedDiscountRuleStatus.ACTIVE) {
    if (
      admin &&
      !isE2ETestMode() &&
      rule.shopifyDiscountId?.startsWith("gid://shopify/Discount")
    ) {
      await deleteRemoteAutomaticDiscount(admin, rule.shopifyDiscountId);
      rule = await prisma.advancedDiscountRule.update({
        where: { id: rule.id },
        data: {
          shopifyDiscountId: null,
          status: normalizedInput.status,
        },
      });
    } else if (isE2ETestMode() && rule.shopifyDiscountId) {
      rule = await prisma.advancedDiscountRule.update({
        where: { id: rule.id },
        data: {
          shopifyDiscountId: null,
          status: normalizedInput.status,
        },
      });
    }

    return { rule, remoteCreated: false };
  }

  if (isE2ETestMode()) {
    rule = await prisma.advancedDiscountRule.update({
      where: { id: rule.id },
      data: {
        shopifyDiscountId:
          rule.shopifyDiscountId ?? `e2e://advanced-discount/${rule.id}`,
        status: AdvancedDiscountRuleStatus.ACTIVE,
      },
    });

    return { rule, remoteCreated: !existingRule.shopifyDiscountId };
  }

  if (!admin || (!functionHandle && !functionId)) {
    return {
      rule,
      remoteCreated: false,
      warning:
        "Rule saved as draft. Configure the Shopify Function handle or ID before activating it in Shopify.",
    };
  }

  if (rule.shopifyDiscountId?.startsWith("gid://shopify/Discount")) {
    const remoteDiscount = await updateRemoteAutomaticAppDiscount(admin, rule, {
      functionHandle,
      functionId,
    });
    rule = await prisma.advancedDiscountRule.update({
      where: { id: rule.id },
      data: {
        functionId:
          (remoteDiscount.functionId ?? functionId) || rule.functionId,
        shopifyDiscountId: remoteDiscount.discountId,
        status: AdvancedDiscountRuleStatus.ACTIVE,
      },
    });

    return { rule, remoteCreated: false };
  }

  const remoteDiscount = await createRemoteAutomaticAppDiscount(admin, rule, {
    functionHandle,
    functionId,
  });
  rule = await prisma.advancedDiscountRule.update({
    where: { id: rule.id },
    data: {
      functionId: (remoteDiscount.functionId ?? functionId) || rule.functionId,
      shopifyDiscountId: remoteDiscount.discountId,
      status: AdvancedDiscountRuleStatus.ACTIVE,
    },
  });

  return { rule, remoteCreated: true };
}

export async function deleteAppDiscount({
  admin,
  ruleId,
  shopId,
}: {
  admin?: ShopifyGraphqlClient | null;
  ruleId: string;
  shopId: string;
}): Promise<AppDiscountMutationResult> {
  await assertAdvancedDiscountsAllowed(shopId);
  const rule = await loadRuleForShop(shopId, ruleId);
  let remoteDeleted = false;

  if (
    admin &&
    !isE2ETestMode() &&
    rule.shopifyDiscountId?.startsWith("gid://shopify/Discount")
  ) {
    await deleteRemoteAutomaticDiscount(admin, rule.shopifyDiscountId);
    remoteDeleted = true;
  } else if (isE2ETestMode() && rule.shopifyDiscountId) {
    remoteDeleted = true;
  }

  await prisma.advancedDiscountRule.delete({ where: { id: rule.id } });

  return { rule, remoteCreated: false, remoteDeleted };
}

export function listAdvancedDiscountRulesForCampaign(
  shopId: string,
  campaignId: string,
) {
  return prisma.advancedDiscountRule.findMany({
    where: { shopId, campaignId },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function buildAdvancedDiscountFunctionConfig(
  rule: Pick<
    AdvancedDiscountRule,
    | "campaignId"
    | "collectionIds"
    | "discountValue"
    | "id"
    | "productIds"
    | "ruleType"
    | "shippingDiscountValue"
    | "status"
    | "thresholds"
    | "title"
  >,
) {
  return {
    schemaVersion: 1,
    ruleId: rule.id,
    campaignId: rule.campaignId,
    ruleType: rule.ruleType,
    title: rule.title,
    status: rule.status,
    thresholds: readJsonArray(rule.thresholds),
    productIds: readJsonArray(rule.productIds),
    collectionIds: readJsonArray(rule.collectionIds),
    discountValue: decimalToNumber(rule.discountValue),
    discountValueType: "PERCENTAGE",
    shippingDiscountValue: decimalToNumber(rule.shippingDiscountValue),
    shippingDiscountValueType: "PERCENTAGE",
  };
}

function normalizeAdvancedDiscountRuleInput(input: AdvancedDiscountRuleInput) {
  const title = input.title.trim();

  if (!title) {
    throw new AdvancedDiscountsError("Rule title is required.", 422);
  }

  if (!Object.values(AdvancedDiscountRuleType).includes(input.ruleType)) {
    throw new AdvancedDiscountsError(
      "Advanced discount rule type is invalid.",
      422,
    );
  }

  const discountValue = normalizePercentage(input.discountValue);
  const shippingDiscountValue = normalizePercentage(
    input.shippingDiscountValue,
  );
  const thresholds = normalizeThresholds(input.thresholds);

  if (
    input.ruleType !== AdvancedDiscountRuleType.FREE_GIFT &&
    !discountValue &&
    !shippingDiscountValue
  ) {
    throw new AdvancedDiscountsError(
      "Set a discount value or shipping discount value.",
      422,
    );
  }

  if (
    input.ruleType === AdvancedDiscountRuleType.FREE_GIFT &&
    normalizeStringArray(input.productIds).length === 0
  ) {
    throw new AdvancedDiscountsError(
      "Free gift rules require at least one product or variant ID.",
      422,
    );
  }

  return {
    collectionIds: normalizeStringArray(input.collectionIds),
    discountValue,
    endsAt: input.endsAt ?? null,
    productIds: normalizeStringArray(input.productIds),
    ruleType: input.ruleType,
    shippingDiscountValue,
    startsAt: input.startsAt ?? null,
    status: input.status ?? AdvancedDiscountRuleStatus.DRAFT,
    thresholds,
    title,
  };
}

function toPrismaCreateData(
  shopId: string,
  campaignId: string | null | undefined,
  input: ReturnType<typeof normalizeAdvancedDiscountRuleInput>,
): Prisma.AdvancedDiscountRuleUncheckedCreateInput {
  return {
    shopId,
    campaignId: campaignId || null,
    title: input.title,
    ruleType: input.ruleType,
    thresholds: toNullableJson(input.thresholds),
    productIds: input.productIds,
    collectionIds: input.collectionIds,
    discountValue: toNullableDecimal(input.discountValue),
    shippingDiscountValue: toNullableDecimal(input.shippingDiscountValue),
    status: input.status,
    startsAt: toNullableDate(input.startsAt),
    endsAt: toNullableDate(input.endsAt),
  };
}

async function createRemoteAutomaticAppDiscount(
  admin: ShopifyGraphqlClient,
  rule: AdvancedDiscountRule,
  functionRef: { functionHandle?: string; functionId?: string },
) {
  const response = await executeGraphql<{
    discountAutomaticAppCreate?: AutomaticAppDiscountPayload;
  }>(
    admin,
    `#graphql
    mutation PromoPulseCreateAdvancedAppDiscount($automaticAppDiscount: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
        automaticAppDiscount {
          discountId
          status
          appDiscountType {
            functionId
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      automaticAppDiscount: buildAutomaticAppDiscountInput(rule, functionRef),
    },
  );

  return parseAutomaticAppDiscountPayload(response.discountAutomaticAppCreate);
}

async function updateRemoteAutomaticAppDiscount(
  admin: ShopifyGraphqlClient,
  rule: AdvancedDiscountRule,
  functionRef: { functionHandle?: string; functionId?: string },
) {
  if (!rule.shopifyDiscountId) {
    throw new AdvancedDiscountsError(
      "Advanced discount has no Shopify discount ID.",
      409,
    );
  }

  const response = await executeGraphql<{
    discountAutomaticAppUpdate?: AutomaticAppDiscountPayload;
  }>(
    admin,
    `#graphql
    mutation PromoPulseUpdateAdvancedAppDiscount($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
      discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
        automaticAppDiscount {
          discountId
          status
          appDiscountType {
            functionId
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      id: rule.shopifyDiscountId,
      automaticAppDiscount: buildAutomaticAppDiscountInput(rule, functionRef),
    },
  );

  return parseAutomaticAppDiscountPayload(response.discountAutomaticAppUpdate);
}

async function deleteRemoteAutomaticDiscount(
  admin: ShopifyGraphqlClient,
  discountId: string,
) {
  const response = await executeGraphql<{
    discountAutomaticDelete?: {
      deletedAutomaticDiscountId?: string | null;
      userErrors?: ShopifyUserError[];
    };
  }>(
    admin,
    `#graphql
    mutation PromoPulseDeleteAdvancedAppDiscount($id: ID!) {
      discountAutomaticDelete(id: $id) {
        deletedAutomaticDiscountId
        userErrors {
          field
          message
        }
      }
    }`,
    { id: discountId },
  );

  const userErrors = response.discountAutomaticDelete?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(formatUserErrors(userErrors));
  }

  return (
    response.discountAutomaticDelete?.deletedAutomaticDiscountId ?? discountId
  );
}

function buildAutomaticAppDiscountInput(
  rule: AdvancedDiscountRule,
  functionRef: { functionHandle?: string; functionId?: string },
) {
  const input: Record<string, unknown> = {
    title: rule.title,
    startsAt: rule.startsAt?.toISOString() ?? new Date().toISOString(),
    endsAt: rule.endsAt?.toISOString() ?? null,
    discountClasses: getDiscountClasses(rule),
    combinesWith: {
      orderDiscounts: true,
      productDiscounts: true,
      shippingDiscounts: Boolean(rule.shippingDiscountValue),
    },
    metafields: [
      {
        namespace: ADVANCED_DISCOUNT_METAFIELD_NAMESPACE,
        key: ADVANCED_DISCOUNT_METAFIELD_KEY,
        type: "json",
        value: JSON.stringify(buildAdvancedDiscountFunctionConfig(rule)),
      },
    ],
  };

  if (functionRef.functionHandle) {
    input.functionHandle = functionRef.functionHandle;
  } else if (functionRef.functionId) {
    input.functionId = functionRef.functionId;
  }

  return input;
}

function getDiscountClasses(rule: AdvancedDiscountRule) {
  const classes = new Set<string>();
  const hasProductFilters =
    readJsonArray(rule.productIds).length > 0 ||
    readJsonArray(rule.collectionIds).length > 0;

  if (
    rule.ruleType === AdvancedDiscountRuleType.FREE_GIFT ||
    rule.ruleType === AdvancedDiscountRuleType.CART_CONTENTS ||
    rule.ruleType === AdvancedDiscountRuleType.PRODUCT_SHIPPING_COMBO ||
    hasProductFilters
  ) {
    classes.add("PRODUCT");
  }

  if (
    rule.ruleType === AdvancedDiscountRuleType.SPEND_X_GET_Y ||
    rule.ruleType === AdvancedDiscountRuleType.TIERED_DISCOUNT
  ) {
    classes.add(hasProductFilters ? "PRODUCT" : "ORDER");
  }

  if (rule.shippingDiscountValue) {
    classes.add("SHIPPING");
  }

  return Array.from(classes);
}

async function assertAdvancedDiscountsAllowed(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { plan: true },
  });

  if (!shop) {
    throw new AdvancedDiscountsError("Shop not found.", 404);
  }

  const gate = canUsePremiumFeature(shop, "ADVANCED_DISCOUNTS");

  if (!gate.allowed) {
    throw new AdvancedDiscountsError(gate.reason, 403);
  }
}

async function assertCampaignBelongsToShop(
  shopId: string,
  campaignId: string | null | undefined,
) {
  if (!campaignId) return;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId },
    select: { id: true },
  });

  if (!campaign) {
    throw new AdvancedDiscountsError("Campaign not found.", 404);
  }
}

async function loadRuleForShop(shopId: string, ruleId: string) {
  const rule = await prisma.advancedDiscountRule.findFirst({
    where: { id: ruleId, shopId },
  });

  if (!rule) {
    throw new AdvancedDiscountsError("Advanced discount rule not found.", 404);
  }

  return rule;
}

type AutomaticAppDiscountPayload = {
  automaticAppDiscount?: {
    discountId?: string | null;
    appDiscountType?: {
      functionId?: string | null;
    } | null;
  } | null;
  userErrors?: ShopifyUserError[];
};

type ShopifyUserError = {
  field?: string[] | string | null;
  message?: string | null;
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

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(formatGraphqlErrors(payload.errors));
  }

  return (payload.data ?? {}) as T;
}

function parseAutomaticAppDiscountPayload(
  payload: AutomaticAppDiscountPayload | undefined,
) {
  const userErrors = payload?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(formatUserErrors(userErrors));
  }

  const discountId = payload?.automaticAppDiscount?.discountId;

  if (!discountId) {
    throw new Error("Shopify did not return the created app discount.");
  }

  return {
    discountId,
    functionId:
      payload?.automaticAppDiscount?.appDiscountType?.functionId ?? null,
  };
}

function formatUserErrors(errors: ShopifyUserError[]) {
  return (
    errors
      .map((error) => error.message)
      .filter(Boolean)
      .join(" ") || "Shopify Admin API returned an unknown discount error."
  );
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

function normalizeThresholds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const minimumSubtotal = normalizePositiveNumber(
        record.minimumSubtotal ?? record.subtotal ?? record.amount,
      );
      const discountValue = normalizePercentage(
        record.discountValue ?? record.value,
      );

      if (minimumSubtotal === null) return null;

      return {
        minimumSubtotal,
        ...(discountValue ? { discountValue } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function normalizePercentage(value: unknown) {
  const number = normalizePositiveNumber(value);

  if (number === null) return null;

  return Math.min(number, 100);
}

function normalizePositiveNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function readJsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toNullableJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;

  return value as Prisma.InputJsonValue;
}

function toNullableDecimal(value: number | null | undefined) {
  return value ? new Prisma.Decimal(value) : null;
}

function toNullableDate(value: Date | string | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined,
) {
  if (value === null || value === undefined) return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}
