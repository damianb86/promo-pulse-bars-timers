import prisma from "../db.server";

type PrismaLike = typeof prisma;

type CountableModel = {
  count?: (args: { where: Record<string, unknown> }) => Promise<number>;
  deleteMany?: (args: { where: Record<string, unknown> }) => Promise<{
    count: number;
  }>;
  findMany?: (args: Record<string, unknown>) => Promise<unknown[]>;
};

type ShopRecord = {
  id: string;
  shopifyDomain: string;
};

export type PromoPulseDataCounts = {
  shopRecords: number;
  sessions: number;
  settings: number;
  onboarding: number;
  campaigns: number;
  analyticsEvents: number;
  discountRecords: number;
  experiments: number;
  attributionRows: number;
  emailTimers: number;
  advancedRules: number;
  marketRules: number;
  recommendations: number;
  agencyAccesses: number;
  contactRequests: number;
};

export type PromoPulseDeletionResult = {
  shopDomain: string;
  shopId: string | null;
  deleted: Array<{
    model: string;
    count: number;
    skipped?: boolean;
  }>;
};

const zeroCounts: PromoPulseDataCounts = {
  shopRecords: 0,
  sessions: 0,
  settings: 0,
  onboarding: 0,
  campaigns: 0,
  analyticsEvents: 0,
  discountRecords: 0,
  experiments: 0,
  attributionRows: 0,
  emailTimers: 0,
  advancedRules: 0,
  marketRules: 0,
  recommendations: 0,
  agencyAccesses: 0,
  contactRequests: 0,
};

export async function getPromoPulseDataCounts(
  shopDomain: string,
  prismaClient: PrismaLike = prisma,
): Promise<PromoPulseDataCounts> {
  const shop = await findShopByDomain(prismaClient, shopDomain);

  const sessions = await countRows(prismaClient, "session", {
    shop: shopDomain,
  });
  const contactRequestsByDomain = await countRows(
    prismaClient,
    "contactRequest",
    {
      shopDomain,
    },
  );

  if (!shop) {
    return {
      ...zeroCounts,
      sessions,
      contactRequests: contactRequestsByDomain,
    };
  }

  const shopId = shop.id;
  const [
    shopRecords,
    settings,
    onboarding,
    campaigns,
    analyticsEvents,
    discountCodeGrants,
    uniqueDiscountCodes,
    discountCodePools,
    advancedDiscountRules,
    experiments,
    attributionTouches,
    attributionConversions,
    emailTimers,
    advancedBadgeRules,
    marketRules,
    recommendations,
    agencyAccesses,
    contactRequests,
  ] = await Promise.all([
    countRows(prismaClient, "shop", { id: shopId }),
    countRows(prismaClient, "shopSettings", { shopId }),
    countRows(prismaClient, "shopOnboardingChecklist", { shopId }),
    countRows(prismaClient, "campaign", { shopId }),
    countRows(prismaClient, "analyticsEvent", { shopId }),
    countRows(prismaClient, "discountCodeGrant", { shopId }),
    countRows(prismaClient, "uniqueDiscountCode", { shopId }),
    countRows(prismaClient, "discountCodePool", { shopId }),
    countRows(prismaClient, "advancedDiscountRule", { shopId }),
    countRows(prismaClient, "experiment", { shopId }),
    countRows(prismaClient, "attributionTouch", { shopId }),
    countRows(prismaClient, "attributionConversion", { shopId }),
    countRows(prismaClient, "emailTimer", { shopId }),
    countRows(prismaClient, "advancedBadgeRule", { shopId }),
    countRows(prismaClient, "marketCampaignRule", { shopId }),
    countRows(prismaClient, "campaignRecommendation", { shopId }),
    countRows(prismaClient, "agencyShopAccess", { shopId }),
    countRows(prismaClient, "contactRequest", { shopId }),
  ]);

  return {
    shopRecords,
    sessions,
    settings,
    onboarding,
    campaigns,
    analyticsEvents,
    discountRecords:
      discountCodeGrants +
      uniqueDiscountCodes +
      discountCodePools +
      advancedDiscountRules,
    experiments,
    attributionRows: attributionTouches + attributionConversions,
    emailTimers,
    advancedRules: advancedDiscountRules + advancedBadgeRules,
    marketRules,
    recommendations,
    agencyAccesses,
    contactRequests,
  };
}

export async function deletePromoPulseShopData(
  shopDomain: string,
  prismaClient: PrismaLike = prisma,
): Promise<PromoPulseDeletionResult> {
  const shop = await findShopByDomain(prismaClient, shopDomain);
  const deleted: PromoPulseDeletionResult["deleted"] = [];
  const agencyIds = shop
    ? await findAgencyIdsForShop(prismaClient, shop.id)
    : [];

  deleted.push(
    await deleteRows(prismaClient, "session", {
      shop: shopDomain,
    }),
  );

  if (!shop) {
    deleted.push(
      await deleteRows(prismaClient, "contactRequest", {
        shopDomain,
      }),
    );

    return {
      shopDomain,
      shopId: null,
      deleted,
    };
  }

  deleted.push(
    await deleteRows(prismaClient, "shop", {
      id: shop.id,
    }),
  );

  if (agencyIds.length > 0) {
    deleted.push(
      await deleteRows(prismaClient, "agencyAccount", {
        id: { in: agencyIds },
        shopAccesses: { none: {} },
      }),
    );
  }

  return {
    shopDomain: shop.shopifyDomain,
    shopId: shop.id,
    deleted,
  };
}

async function findShopByDomain(
  prismaClient: PrismaLike,
  shopDomain: string,
): Promise<ShopRecord | null> {
  try {
    return await prismaClient.shop.findUnique({
      where: { shopifyDomain: shopDomain },
      select: { id: true, shopifyDomain: true },
    });
  } catch (error) {
    if (isMissingPrismaTargetError(error)) return null;
    throw error;
  }
}

async function findAgencyIdsForShop(prismaClient: PrismaLike, shopId: string) {
  const model = getModel(prismaClient, "agencyShopAccess");
  if (!model?.findMany) return [];

  try {
    const rows = await model.findMany({
      where: { shopId },
      select: { agencyId: true },
    });

    return rows
      .map((row) =>
        typeof row === "object" && row && "agencyId" in row
          ? String(row.agencyId)
          : "",
      )
      .filter(Boolean);
  } catch (error) {
    if (isMissingPrismaTargetError(error)) return [];
    throw error;
  }
}

async function countRows(
  prismaClient: PrismaLike,
  modelName: string,
  where: Record<string, unknown>,
) {
  const model = getModel(prismaClient, modelName);
  if (!model?.count) return 0;

  try {
    return await model.count({ where });
  } catch (error) {
    if (isMissingPrismaTargetError(error)) return 0;
    throw error;
  }
}

async function deleteRows(
  prismaClient: PrismaLike,
  modelName: string,
  where: Record<string, unknown>,
) {
  const model = getModel(prismaClient, modelName);
  if (!model?.deleteMany) {
    return { model: modelName, count: 0, skipped: true };
  }

  try {
    const result = await model.deleteMany({ where });

    return { model: modelName, count: result.count || 0 };
  } catch (error) {
    if (isMissingPrismaTargetError(error)) {
      console.warn(`[privacy] Skipping missing ${modelName} storage.`);
      return { model: modelName, count: 0, skipped: true };
    }

    throw error;
  }
}

function getModel(prismaClient: PrismaLike, modelName: string) {
  return (prismaClient as unknown as Record<string, CountableModel>)[modelName];
}

function isMissingPrismaTargetError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String((error as Error | null)?.message || "");

  return (
    code === "P2021" ||
    code === "P2022" ||
    /table .* does not exist|column .* does not exist|no such table/i.test(
      message,
    )
  );
}
