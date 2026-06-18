import { randomBytes } from "node:crypto";

import {
  DiscountCodePoolStatus,
  DiscountCodeValueType,
  Prisma,
  UniqueDiscountCodeStatus,
  type Campaign,
  type DiscountCodePool,
  type DiscountSync,
  type Shop,
  type UniqueDiscountCode,
} from "@prisma/client";

import prisma from "../../db.server";
import { isE2ETestMode } from "../e2e-test.server";
import { canUseFeature } from "../planLimits.server";
import {
  createBasicCodeDiscount,
  createFreeShippingCodeDiscount,
  type ShopifyGraphqlClient,
} from "../shopifyDiscounts.server";

export type CreateDiscountCodePoolInput = {
  shopId: string;
  campaignId: string;
  prefix: string;
  discountType: DiscountCodeValueType | `${DiscountCodeValueType}`;
  value?: number | string | null;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  now?: Date;
};

export type GenerateCodeBatchInput = {
  shopId: string;
  campaignId: string;
  poolId?: string | null;
  totalCodes: number;
  admin?: ShopifyGraphqlClient | null;
  now?: Date;
  createCode?: (prefix: string) => string;
  createRemoteDiscount?: (
    input: CreateRemotePoolDiscountInput,
  ) => Promise<CreatedRemoteDiscount>;
};

export type AssignCodeToVisitorInput = {
  shopId: string;
  campaignId: string;
  visitorId: string;
  sessionId?: string | null;
  poolId?: string | null;
  now?: Date;
};

export type VisitorCodeLookupInput = {
  shopId: string;
  campaignId: string;
  visitorId: string;
  now?: Date;
};

export type CodeMutationInput = {
  shopId: string;
  campaignId?: string | null;
  code: string;
  now?: Date;
};

export type MarkCodeUsedInput = CodeMutationInput & {
  orderId?: string | null;
};

export type CreateRemotePoolDiscountInput = {
  admin: ShopifyGraphqlClient | null;
  pool: DiscountCodePool;
  campaign: CampaignForUniqueCodes;
  code: string;
  now: Date;
};

export type CreatedRemoteDiscount = {
  id: string | null;
};

export type GenerateCodeBatchResult = {
  pool: DiscountCodePool;
  codes: UniqueDiscountCode[];
};

export type AssignCodeToVisitorResult = {
  code: UniqueDiscountCode;
  reused: boolean;
};

type CampaignForUniqueCodes = Pick<
  Campaign,
  "id" | "shopId" | "name" | "startsAt" | "endsAt"
> & {
  shop: Pick<Shop, "plan">;
  discountSync: Pick<DiscountSync, "uniqueCodeExpiresMinutes"> | null;
};

type UniqueCodesPrismaClient = typeof prisma | Prisma.TransactionClient;

const maxBatchSize = 500;

export class UniqueCodesError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UniqueCodesError";
    this.status = status;
  }
}

export async function createDiscountCodePool({
  shopId,
  campaignId,
  prefix,
  discountType,
  value,
  startsAt,
  expiresAt,
  now = new Date(),
}: CreateDiscountCodePoolInput) {
  const campaign = await loadCampaignForUniqueCodes(shopId, campaignId);
  const normalizedPrefix = normalizeCodePrefix(prefix);
  const normalizedDiscountType = normalizeDiscountType(discountType);
  const normalizedValue = normalizeDiscountValue(normalizedDiscountType, value);
  const normalizedStartsAt = normalizeOptionalDate(startsAt);
  const normalizedExpiresAt = normalizeOptionalDate(expiresAt);

  assertUniqueCodesAllowed(campaign);

  if (normalizedExpiresAt && normalizedExpiresAt <= now) {
    throw new UniqueCodesError("Pool expiration must be in the future.", 422);
  }

  return prisma.discountCodePool.create({
    data: {
      shopId,
      campaignId,
      prefix: normalizedPrefix,
      discountType: normalizedDiscountType,
      value:
        normalizedValue === null ? null : new Prisma.Decimal(normalizedValue),
      startsAt: normalizedStartsAt,
      expiresAt: normalizedExpiresAt,
      status: DiscountCodePoolStatus.ACTIVE,
    },
  });
}

export async function generateCodeBatch({
  shopId,
  campaignId,
  poolId,
  totalCodes,
  admin = null,
  now = new Date(),
  createCode = generatePoolCode,
  createRemoteDiscount = createShopifyDiscountForCode,
}: GenerateCodeBatchInput): Promise<GenerateCodeBatchResult> {
  const quantity = normalizeBatchSize(totalCodes);
  const [campaign, pool] = await Promise.all([
    loadCampaignForUniqueCodes(shopId, campaignId),
    loadPoolForGeneration({ shopId, campaignId, poolId }),
  ]);

  assertUniqueCodesAllowed(campaign);
  assertPoolCanGenerate(pool, now);

  const generatedCodes: UniqueDiscountCode[] = [];
  let attempts = 0;

  while (generatedCodes.length < quantity && attempts < quantity * 5) {
    attempts += 1;

    const code = createCode(pool.prefix);
    const localCode = await createAvailableCode({
      shopId,
      campaignId,
      code,
      expiresAt: pool.expiresAt,
    });

    if (!localCode) continue;

    try {
      const remoteDiscount = await createRemoteDiscount({
        admin,
        pool,
        campaign,
        code,
        now,
      });
      const savedCode = await prisma.uniqueDiscountCode.update({
        where: { id: localCode.id },
        data: { shopifyDiscountId: remoteDiscount.id },
      });

      generatedCodes.push(savedCode);
    } catch (error) {
      await prisma.uniqueDiscountCode.deleteMany({
        where: { id: localCode.id },
      });
      throw error;
    }
  }

  if (generatedCodes.length < quantity) {
    throw new UniqueCodesError(
      "A unique code batch could not be generated without collisions.",
      409,
    );
  }

  const updatedPool = await prisma.discountCodePool.update({
    where: { id: pool.id },
    data: {
      totalGenerated: { increment: generatedCodes.length },
      status: DiscountCodePoolStatus.ACTIVE,
    },
  });

  return { pool: updatedPool, codes: generatedCodes };
}

export async function assignCodeToVisitor({
  shopId,
  campaignId,
  visitorId,
  sessionId = null,
  poolId = null,
  now = new Date(),
}: AssignCodeToVisitorInput): Promise<AssignCodeToVisitorResult> {
  const normalizedVisitorId = normalizeVisitorId(visitorId);
  const campaign = await loadCampaignForUniqueCodes(shopId, campaignId);

  assertUniqueCodesAllowed(campaign);

  return prisma.$transaction(async (tx) => {
    await expireCampaignCodes(tx, { shopId, campaignId, now });

    const existingCode = await findReusableVisitorCode(tx, {
      shopId,
      campaignId,
      visitorId: normalizedVisitorId,
      now,
    });

    if (existingCode) {
      return { code: existingCode, reused: true };
    }

    const pool = await loadPoolForAssignment(tx, {
      shopId,
      campaignId,
      poolId,
      now,
    });
    const availableCode = await tx.uniqueDiscountCode.findFirst({
      where: {
        shopId,
        campaignId,
        status: UniqueDiscountCodeStatus.AVAILABLE,
        code: { startsWith: `${pool.prefix}-` },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ createdAt: "asc" }],
    });

    if (!availableCode) {
      await tx.discountCodePool.update({
        where: { id: pool.id },
        data: { status: DiscountCodePoolStatus.EXHAUSTED },
      });
      throw new UniqueCodesError(
        "Unique discount code pool is exhausted.",
        409,
      );
    }

    const assignedExpiresAt = resolveAssignedCodeExpiresAt({
      campaign,
      pool,
      now,
    });
    const updated = await tx.uniqueDiscountCode.updateMany({
      where: {
        id: availableCode.id,
        status: UniqueDiscountCodeStatus.AVAILABLE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: {
        status: UniqueDiscountCodeStatus.ASSIGNED,
        visitorId: normalizedVisitorId,
        sessionId: normalizeNullableText(sessionId),
        assignedAt: now,
        expiresAt: assignedExpiresAt,
      },
    });

    if (updated.count !== 1) {
      throw new UniqueCodesError(
        "Unique discount code pool is exhausted.",
        409,
      );
    }

    await tx.discountCodePool.update({
      where: { id: pool.id },
      data: { totalAssigned: { increment: 1 } },
    });

    const assignedCode = await tx.uniqueDiscountCode.findFirst({
      where: { id: availableCode.id },
    });

    if (!assignedCode) {
      throw new UniqueCodesError("Assigned code could not be loaded.", 500);
    }

    return { code: assignedCode, reused: false };
  });
}

export async function getAssignedCodeForVisitor({
  shopId,
  campaignId,
  visitorId,
  now = new Date(),
}: VisitorCodeLookupInput) {
  return findReusableVisitorCode(prisma, {
    shopId,
    campaignId,
    visitorId: normalizeVisitorId(visitorId),
    now,
  });
}

export async function expireVisitorCode({
  shopId,
  campaignId,
  visitorId,
  now = new Date(),
}: VisitorCodeLookupInput) {
  return prisma.uniqueDiscountCode.updateMany({
    where: {
      shopId,
      campaignId,
      visitorId: normalizeVisitorId(visitorId),
      status: UniqueDiscountCodeStatus.ASSIGNED,
    },
    data: {
      status: UniqueDiscountCodeStatus.EXPIRED,
      expiresAt: now,
    },
  });
}

export async function markCodeUsed({
  shopId,
  campaignId,
  code,
  orderId = null,
  now = new Date(),
}: MarkCodeUsedInput) {
  const existingCode = await loadCodeByValue({ shopId, campaignId, code });

  if (existingCode.status === UniqueDiscountCodeStatus.USED) {
    return existingCode;
  }

  if (existingCode.status !== UniqueDiscountCodeStatus.ASSIGNED) {
    throw new UniqueCodesError("Only assigned codes can be marked used.", 409);
  }

  if (existingCode.expiresAt && existingCode.expiresAt <= now) {
    await prisma.uniqueDiscountCode.update({
      where: { id: existingCode.id },
      data: { status: UniqueDiscountCodeStatus.EXPIRED },
    });
    throw new UniqueCodesError("Unique discount code has expired.", 410);
  }

  const usedCode = await prisma.uniqueDiscountCode.update({
    where: { id: existingCode.id },
    data: {
      status: UniqueDiscountCodeStatus.USED,
      usedAt: now,
      orderId: normalizeNullableText(orderId),
    },
  });

  await incrementPoolCounterForCode(usedCode, "totalUsed");

  return usedCode;
}

export async function revokeCode({
  shopId,
  campaignId,
  code,
}: CodeMutationInput) {
  const existingCode = await loadCodeByValue({ shopId, campaignId, code });

  if (existingCode.status === UniqueDiscountCodeStatus.USED) {
    throw new UniqueCodesError("Used codes cannot be revoked.", 409);
  }

  if (existingCode.status === UniqueDiscountCodeStatus.REVOKED) {
    return existingCode;
  }

  return prisma.uniqueDiscountCode.update({
    where: { id: existingCode.id },
    data: { status: UniqueDiscountCodeStatus.REVOKED },
  });
}

export function listDiscountCodePoolsForCampaign(
  shopId: string,
  campaignId: string,
) {
  return prisma.discountCodePool.findMany({
    where: { shopId, campaignId },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function listUniqueCodesForCampaign(
  shopId: string,
  campaignId: string,
  options: { take?: number } = {},
) {
  return prisma.uniqueDiscountCode.findMany({
    where: { shopId, campaignId },
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(Math.max(options.take ?? 100, 1), 250),
  });
}

export async function createShopifyDiscountForCode({
  admin,
  pool,
  campaign,
  code,
  now,
}: CreateRemotePoolDiscountInput): Promise<CreatedRemoteDiscount> {
  if (isE2ETestMode()) {
    return { id: `e2e://${encodeURIComponent(code)}` };
  }

  if (!admin) {
    throw new UniqueCodesError(
      "Shopify Admin access with write_discounts is required to generate real unique codes.",
      503,
    );
  }

  const title = `${campaign.name} - ${code}`;
  const startsAt = pool.startsAt ?? campaign.startsAt ?? now;
  const endsAt = pool.expiresAt ?? campaign.endsAt ?? null;

  if (pool.discountType === DiscountCodeValueType.FREE_SHIPPING) {
    const discount = await createFreeShippingCodeDiscount(admin, {
      title,
      code,
      startsAt,
      endsAt,
      appliesOncePerCustomer: true,
    });

    return { id: discount.id };
  }

  const discount = await createBasicCodeDiscount(admin, {
    title,
    code,
    valueType:
      pool.discountType === DiscountCodeValueType.FIXED_AMOUNT
        ? "FIXED_AMOUNT"
        : "PERCENTAGE",
    value: requirePoolValue(pool),
    startsAt,
    endsAt,
    appliesOncePerCustomer: true,
  });

  return { id: discount.id };
}

export function generatePoolCode(prefix: string) {
  return `${normalizeCodePrefix(prefix)}-${randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;
}

export function normalizeCodePrefix(value: string | null | undefined) {
  const normalized = (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 16)
    .replace(/^[-_]+|[-_]+$/g, "");

  return normalized || "PP";
}

function assertUniqueCodesAllowed(campaign: CampaignForUniqueCodes) {
  const gate = canUseFeature(
    { plan: campaign.shop.plan },
    "unique_discount_codes",
  );

  if (!gate.allowed) {
    throw new UniqueCodesError(gate.reason, 403);
  }
}

async function loadCampaignForUniqueCodes(shopId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId },
    select: {
      id: true,
      shopId: true,
      name: true,
      startsAt: true,
      endsAt: true,
      shop: { select: { plan: true } },
      discountSync: { select: { uniqueCodeExpiresMinutes: true } },
    },
  });

  if (!campaign) {
    throw new UniqueCodesError("Campaign not found.", 404);
  }

  return campaign;
}

async function loadPoolForGeneration({
  shopId,
  campaignId,
  poolId,
}: {
  shopId: string;
  campaignId: string;
  poolId?: string | null;
}) {
  const pool = await prisma.discountCodePool.findFirst({
    where: poolId
      ? { id: poolId, shopId, campaignId }
      : {
          shopId,
          campaignId,
          status: { in: [DiscountCodePoolStatus.ACTIVE] },
        },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!pool) {
    throw new UniqueCodesError("Discount code pool not found.", 404);
  }

  return pool;
}

async function loadPoolForAssignment(
  client: UniqueCodesPrismaClient,
  {
    shopId,
    campaignId,
    poolId,
    now,
  }: {
    shopId: string;
    campaignId: string;
    poolId?: string | null;
    now: Date;
  },
) {
  const pool = await client.discountCodePool.findFirst({
    where: poolId
      ? { id: poolId, shopId, campaignId }
      : {
          shopId,
          campaignId,
          status: DiscountCodePoolStatus.ACTIVE,
        },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!pool) {
    throw new UniqueCodesError("Discount code pool not found.", 404);
  }

  assertPoolCanAssign(pool, now);

  return pool;
}

function assertPoolCanGenerate(pool: DiscountCodePool, now: Date) {
  if (
    pool.status === DiscountCodePoolStatus.ARCHIVED ||
    pool.status === DiscountCodePoolStatus.EXPIRED
  ) {
    throw new UniqueCodesError("Discount code pool is not active.", 409);
  }

  if (pool.expiresAt && pool.expiresAt <= now) {
    throw new UniqueCodesError("Discount code pool has expired.", 410);
  }
}

function assertPoolCanAssign(pool: DiscountCodePool, now: Date) {
  if (pool.status !== DiscountCodePoolStatus.ACTIVE) {
    throw new UniqueCodesError("Discount code pool is not active.", 409);
  }

  if (pool.expiresAt && pool.expiresAt <= now) {
    throw new UniqueCodesError("Discount code pool has expired.", 410);
  }
}

function normalizeDiscountType(value: DiscountCodeValueType | string) {
  if (
    value === DiscountCodeValueType.PERCENTAGE ||
    value === DiscountCodeValueType.FIXED_AMOUNT ||
    value === DiscountCodeValueType.FREE_SHIPPING
  ) {
    return value;
  }

  throw new UniqueCodesError("Discount type is not supported.", 422);
}

function normalizeDiscountValue(
  discountType: DiscountCodeValueType,
  value: number | string | null | undefined,
) {
  if (discountType === DiscountCodeValueType.FREE_SHIPPING) return null;

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new UniqueCodesError("Discount value must be greater than 0.", 422);
  }

  if (discountType === DiscountCodeValueType.PERCENTAGE && numberValue > 100) {
    throw new UniqueCodesError("Percentage discount cannot exceed 100.", 422);
  }

  return numberValue;
}

function normalizeBatchSize(totalCodes: number) {
  if (
    !Number.isInteger(totalCodes) ||
    totalCodes < 1 ||
    totalCodes > maxBatchSize
  ) {
    throw new UniqueCodesError(
      `Generate between 1 and ${maxBatchSize} codes at a time.`,
      422,
    );
  }

  return totalCodes;
}

async function createAvailableCode({
  shopId,
  campaignId,
  code,
  expiresAt,
}: {
  shopId: string;
  campaignId: string;
  code: string;
  expiresAt: Date | null;
}) {
  try {
    return await prisma.uniqueDiscountCode.create({
      data: {
        shopId,
        campaignId,
        code,
        expiresAt,
        status: UniqueDiscountCodeStatus.AVAILABLE,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return null;

    throw error;
  }
}

async function expireCampaignCodes(
  client: UniqueCodesPrismaClient,
  {
    shopId,
    campaignId,
    now,
  }: {
    shopId: string;
    campaignId: string;
    now: Date;
  },
) {
  await client.uniqueDiscountCode.updateMany({
    where: {
      shopId,
      campaignId,
      status: {
        in: [
          UniqueDiscountCodeStatus.AVAILABLE,
          UniqueDiscountCodeStatus.ASSIGNED,
        ],
      },
      expiresAt: { lte: now },
    },
    data: { status: UniqueDiscountCodeStatus.EXPIRED },
  });
}

function findReusableVisitorCode(
  client: UniqueCodesPrismaClient,
  {
    shopId,
    campaignId,
    visitorId,
    now,
  }: {
    shopId: string;
    campaignId: string;
    visitorId: string;
    now: Date;
  },
) {
  return client.uniqueDiscountCode.findFirst({
    where: {
      shopId,
      campaignId,
      visitorId,
      status: UniqueDiscountCodeStatus.ASSIGNED,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
  });
}

function resolveAssignedCodeExpiresAt({
  campaign,
  pool,
  now,
}: {
  campaign: CampaignForUniqueCodes;
  pool: DiscountCodePool;
  now: Date;
}) {
  const durationMinutes = campaign.discountSync?.uniqueCodeExpiresMinutes;
  const candidates = [
    pool.expiresAt,
    campaign.endsAt,
    durationMinutes && durationMinutes > 0
      ? new Date(now.getTime() + durationMinutes * 60_000)
      : null,
  ].filter((date): date is Date => date instanceof Date);

  if (candidates.length === 0) return null;

  return new Date(
    Math.min(...candidates.map((candidate) => candidate.getTime())),
  );
}

async function loadCodeByValue({
  shopId,
  campaignId,
  code,
}: {
  shopId: string;
  campaignId?: string | null;
  code: string;
}) {
  const existingCode = await prisma.uniqueDiscountCode.findFirst({
    where: {
      shopId,
      ...(campaignId ? { campaignId } : {}),
      code: code.trim().toUpperCase(),
    },
  });

  if (!existingCode) {
    throw new UniqueCodesError("Unique discount code not found.", 404);
  }

  return existingCode;
}

async function incrementPoolCounterForCode(
  code: UniqueDiscountCode,
  counter: "totalUsed",
) {
  const prefix = code.code.split("-")[0];

  if (!prefix) return;

  const pool = await prisma.discountCodePool.findFirst({
    where: {
      shopId: code.shopId,
      campaignId: code.campaignId,
      prefix,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!pool) return;

  await prisma.discountCodePool.update({
    where: { id: pool.id },
    data: { [counter]: { increment: 1 } },
  });
}

function requirePoolValue(pool: DiscountCodePool) {
  const value = Number(pool.value?.toString());

  if (!Number.isFinite(value) || value <= 0) {
    throw new UniqueCodesError("Discount value must be greater than 0.", 422);
  }

  return value;
}

function normalizeVisitorId(visitorId: string) {
  const normalized = visitorId.trim();

  if (normalized.length < 6 || normalized.length > 255) {
    throw new UniqueCodesError(
      "visitorId must be between 6 and 255 characters.",
      400,
    );
  }

  return normalized;
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";

  return normalized || null;
}

function normalizeOptionalDate(value: Date | string | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
