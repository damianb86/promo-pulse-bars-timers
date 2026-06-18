import {
  DiscountCodePoolStatus,
  Prisma,
  UniqueDiscountCodeStatus,
} from "@prisma/client";

import prisma from "../../db.server";
import {
  deactivateCodeDiscount,
  type ShopifyGraphqlClient,
} from "../shopifyDiscounts.server";

type UniqueCodesPrismaClient = typeof prisma | Prisma.TransactionClient;

export type ExpireOldAssignedCodesInput = {
  shopId?: string;
  campaignId?: string;
  now?: Date;
};

export type ReconcileUsedCodesFromOrdersInput = {
  shopId?: string;
  shopDomain?: string;
  order: Record<string, unknown>;
  occurredAt?: Date;
};

export type ReconcileUsedCodesFromOrdersResult = {
  orderId: string | null;
  discountCodes: string[];
  matched: number;
  used: number;
  alreadyUsed: number;
  notFound: string[];
  shopFound: boolean;
};

export type RevokeExpiredShopifyCodesInput = {
  shopId?: string;
  campaignId?: string;
  admin?: ShopifyGraphqlClient | null;
  now?: Date;
  take?: number;
  revokeRemoteDiscount?: (shopifyDiscountId: string) => Promise<void>;
};

export async function expireOldAssignedCodes({
  shopId,
  campaignId,
  now = new Date(),
}: ExpireOldAssignedCodesInput = {}) {
  const expiredCodes = await prisma.uniqueDiscountCode.updateMany({
    where: {
      ...(shopId ? { shopId } : {}),
      ...(campaignId ? { campaignId } : {}),
      status: UniqueDiscountCodeStatus.ASSIGNED,
      expiresAt: { lte: now },
    },
    data: { status: UniqueDiscountCodeStatus.EXPIRED },
  });
  const expiredPools = await prisma.discountCodePool.updateMany({
    where: {
      ...(shopId ? { shopId } : {}),
      ...(campaignId ? { campaignId } : {}),
      status: DiscountCodePoolStatus.ACTIVE,
      expiresAt: { lte: now },
    },
    data: { status: DiscountCodePoolStatus.EXPIRED },
  });

  return {
    expiredCodes: expiredCodes.count,
    expiredPools: expiredPools.count,
  };
}

export async function reconcileUsedCodesFromOrders({
  shopId,
  shopDomain,
  order,
  occurredAt,
}: ReconcileUsedCodesFromOrdersInput): Promise<ReconcileUsedCodesFromOrdersResult> {
  const discountCodes = readOrderDiscountCodes(order);
  const orderId = readOrderId(order);
  const usedAt = occurredAt ?? readOrderOccurredAt(order) ?? new Date();
  const result: ReconcileUsedCodesFromOrdersResult = {
    orderId,
    discountCodes,
    matched: 0,
    used: 0,
    alreadyUsed: 0,
    notFound: [],
    shopFound: true,
  };

  if (discountCodes.length === 0) {
    return result;
  }

  const resolvedShopId = shopId ?? (await resolveShopId(shopDomain));

  if (!resolvedShopId) {
    return {
      ...result,
      shopFound: false,
      notFound: discountCodes,
    };
  }

  for (const code of discountCodes) {
    const existingCode = await prisma.uniqueDiscountCode.findFirst({
      where: { shopId: resolvedShopId, code },
      orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
    });

    if (!existingCode) {
      result.notFound.push(code);
      continue;
    }

    result.matched += 1;

    if (existingCode.status === UniqueDiscountCodeStatus.USED) {
      result.alreadyUsed += 1;
      continue;
    }

    const marked = await prisma.$transaction(async (tx) => {
      const updated = await tx.uniqueDiscountCode.updateMany({
        where: {
          id: existingCode.id,
          status: { not: UniqueDiscountCodeStatus.USED },
        },
        data: {
          status: UniqueDiscountCodeStatus.USED,
          usedAt,
          orderId,
        },
      });

      if (updated.count !== 1) return false;

      await incrementPoolCounterForCode(tx, existingCode);
      return true;
    });

    if (marked) {
      result.used += 1;
    } else {
      result.alreadyUsed += 1;
    }
  }

  return result;
}

export async function revokeExpiredShopifyCodes({
  shopId,
  campaignId,
  admin = null,
  take = 100,
  revokeRemoteDiscount,
}: RevokeExpiredShopifyCodesInput = {}) {
  const deactivator =
    revokeRemoteDiscount ??
    (admin
      ? async (shopifyDiscountId: string) => {
          await deactivateCodeDiscount(admin, shopifyDiscountId);
        }
      : null);
  const codes = await prisma.uniqueDiscountCode.findMany({
    where: {
      ...(shopId ? { shopId } : {}),
      ...(campaignId ? { campaignId } : {}),
      status: UniqueDiscountCodeStatus.EXPIRED,
      shopifyDiscountId: { not: null },
    },
    orderBy: [{ expiresAt: "asc" }, { updatedAt: "asc" }],
    take: Math.min(Math.max(take, 1), 250),
  });

  if (!deactivator) {
    return {
      revoked: 0,
      skipped: codes.length,
      failed: [] as Array<{ code: string; error: string }>,
    };
  }

  const failed: Array<{ code: string; error: string }> = [];
  let revoked = 0;

  for (const code of codes) {
    if (!code.shopifyDiscountId) continue;

    try {
      await deactivator(code.shopifyDiscountId);
      await prisma.uniqueDiscountCode.update({
        where: { id: code.id },
        data: { status: UniqueDiscountCodeStatus.REVOKED },
      });
      revoked += 1;
    } catch (error) {
      failed.push({
        code: code.code,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    revoked,
    skipped: 0,
    failed,
  };
}

async function resolveShopId(shopDomain: string | null | undefined) {
  const shopifyDomain = normalizeShopDomain(shopDomain);

  if (!shopifyDomain) return null;

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain },
    select: { id: true },
  });

  return shop?.id ?? null;
}

async function incrementPoolCounterForCode(
  client: UniqueCodesPrismaClient,
  code: {
    shopId: string;
    campaignId: string;
    code: string;
  },
) {
  const prefix = code.code.split("-")[0];

  if (!prefix) return;

  const pool = await client.discountCodePool.findFirst({
    where: {
      shopId: code.shopId,
      campaignId: code.campaignId,
      prefix,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!pool) return;

  await client.discountCodePool.update({
    where: { id: pool.id },
    data: { totalUsed: { increment: 1 } },
  });
}

function readOrderDiscountCodes(order: Record<string, unknown>) {
  const codes = new Set<string>();
  const discountCodes = Array.isArray(order.discount_codes)
    ? order.discount_codes
    : [];
  const discountApplications = Array.isArray(order.discount_applications)
    ? order.discount_applications
    : [];

  discountCodes.forEach((discount) => {
    if (isRecord(discount)) {
      addDiscountCode(codes, discount.code);
    }
  });

  discountApplications.forEach((application) => {
    if (!isRecord(application)) return;

    const type = readString(application.type).toLowerCase();
    if (type && type !== "discount_code") return;

    addDiscountCode(codes, application.code || application.title);
  });

  return Array.from(codes);
}

function addDiscountCode(codes: Set<string>, value: unknown) {
  const code = normalizeDiscountCode(value);

  if (code) codes.add(code);
}

function readOrderId(order: Record<string, unknown>) {
  return (
    readString(order.admin_graphql_api_id) ||
    readString(order.id) ||
    readString(order.order_number) ||
    readString(order.name) ||
    null
  );
}

function readOrderOccurredAt(order: Record<string, unknown>) {
  return (
    parseDate(order.processed_at) ||
    parseDate(order.created_at) ||
    parseDate(order.updated_at)
  );
}

function normalizeDiscountCode(value: unknown) {
  const code = readString(value).toUpperCase();

  return code.length <= 255 ? code : code.slice(0, 255);
}

function normalizeShopDomain(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

function readString(value: unknown) {
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: unknown) {
  const text = readString(value);
  const date = text ? new Date(text) : null;

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
