import prisma from "../db.server";
import { deletePromoPulseShopData } from "../services/privacy.server";

const complianceTopics = new Set([
  "customers/data_request",
  "customers/redact",
  "shop/redact",
]);

type CompliancePayload = {
  data_request?: { id?: string | number | null };
  orders_requested?: Array<string | number>;
  orders_to_redact?: Array<string | number>;
};

type PrismaLike = typeof prisma;

export function normalizeComplianceTopic(topic: unknown) {
  if (!topic) return "";
  const normalizedTopic = String(topic).toLowerCase();

  if (normalizedTopic === "customers_data_request") {
    return "customers/data_request";
  }

  if (normalizedTopic === "customers_redact") {
    return "customers/redact";
  }

  if (normalizedTopic === "shop_redact") {
    return "shop/redact";
  }

  return normalizedTopic.replace("_", "/");
}

export function isComplianceTopic(topic: unknown) {
  return complianceTopics.has(normalizeComplianceTopic(topic));
}

export function buildShopifyIdVariants(
  ids: Array<string | number> = [],
  resourceName: string,
) {
  const variants = new Set<string>();

  ids.forEach((id) => {
    if (id === null || id === undefined || id === "") return;
    const value = String(id);
    variants.add(value);

    if (!value.startsWith("gid://")) {
      variants.add(`gid://shopify/${resourceName}/${value}`);
    }
  });

  return Array.from(variants);
}

export function getComplianceWebhookSummary({
  topic,
  shop,
  payload = {},
}: {
  topic: unknown;
  shop: string;
  payload?: CompliancePayload;
}) {
  return {
    topic: normalizeComplianceTopic(topic),
    shop,
    ordersRequestedCount: Array.isArray(payload.orders_requested)
      ? payload.orders_requested.length
      : 0,
    ordersToRedactCount: Array.isArray(payload.orders_to_redact)
      ? payload.orders_to_redact.length
      : 0,
    dataRequestId: payload.data_request?.id
      ? String(payload.data_request.id)
      : null,
  };
}

export async function redactCustomerData({
  prismaClient = prisma,
  shop,
  payload = {},
}: {
  prismaClient?: PrismaLike;
  shop: string;
  payload?: CompliancePayload;
}) {
  const orderIds = buildShopifyIdVariants(payload.orders_to_redact, "Order");

  if (!orderIds.length) {
    return {
      analyticsEventsUpdated: 0,
      uniqueDiscountCodesUpdated: 0,
      attributionConversionsDeleted: 0,
    };
  }

  const shopRecord = await prismaClient.shop.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!shopRecord) {
    return {
      analyticsEventsUpdated: 0,
      uniqueDiscountCodesUpdated: 0,
      attributionConversionsDeleted: 0,
    };
  }

  const [analyticsEvents, uniqueDiscountCodes, attributionConversions] =
    await Promise.all([
      prismaClient.analyticsEvent.updateMany({
        where: {
          shopId: shopRecord.id,
          orderId: { in: orderIds },
        },
        data: { orderId: null },
      }),
      prismaClient.uniqueDiscountCode.updateMany({
        where: {
          shopId: shopRecord.id,
          orderId: { in: orderIds },
        },
        data: { orderId: null },
      }),
      prismaClient.attributionConversion.deleteMany({
        where: {
          shopId: shopRecord.id,
          orderId: { in: orderIds },
        },
      }),
    ]);

  return {
    analyticsEventsUpdated: analyticsEvents.count || 0,
    uniqueDiscountCodesUpdated: uniqueDiscountCodes.count || 0,
    attributionConversionsDeleted: attributionConversions.count || 0,
  };
}

export async function redactShopData({
  prismaClient = prisma,
  shop,
}: {
  prismaClient?: PrismaLike;
  shop: string;
}) {
  return deletePromoPulseShopData(shop, prismaClient);
}
