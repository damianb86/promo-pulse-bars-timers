import { createHash, randomBytes } from "node:crypto";

import {
  CampaignStatus,
  DiscountCodeGrantStatus,
  DiscountSyncMethod,
  type Campaign,
  type DiscountCodeGrant,
  type DiscountSync,
  type Shop,
} from "@prisma/client";

import prisma from "../db.server";
import {
  createBasicCodeDiscount,
  createFreeShippingCodeDiscount,
  type ShopifyGraphqlClient,
} from "./shopifyDiscounts.server";
import { canUseFeature } from "./planLimits.server";

export type UniqueDiscountCodeIssueInput = {
  shopDomain: string;
  campaignId: string;
  visitorId: string;
  cartToken?: string | null;
  admin?: ShopifyGraphqlClient | null;
  now?: Date;
  createCode?: (prefix: string) => string;
  createRemoteDiscount?: (
    input: CreateRemoteUniqueDiscountInput,
  ) => Promise<CreatedRemoteDiscount>;
};

export type UniqueDiscountCodeIssueResult = {
  campaignId: string;
  code: string;
  expiresAt: string | null;
  autoApply: boolean;
  autoApplyUrl: string | null;
  reused: boolean;
};

export type CreateRemoteUniqueDiscountInput = {
  admin: ShopifyGraphqlClient | null;
  campaign: UniqueDiscountCampaign;
  discountSync: UniqueDiscountSettings;
  code: string;
  startsAt: Date;
  endsAt: Date | null;
};

export type CreatedRemoteDiscount = {
  id: string | null;
};

type UniqueDiscountCampaign = Pick<
  Campaign,
  "id" | "shopId" | "name" | "status" | "startsAt" | "endsAt"
> & {
  shop: Pick<Shop, "plan">;
  discountSync: DiscountSync | null;
};

type UniqueDiscountSettings = DiscountSync & {
  method: "UNIQUE_CODE";
};

export class UniqueDiscountCodeError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UniqueDiscountCodeError";
    this.status = status;
  }
}

export async function issueUniqueDiscountCode({
  shopDomain,
  campaignId,
  visitorId,
  cartToken,
  admin = null,
  now = new Date(),
  createCode = generateUniqueDiscountCode,
  createRemoteDiscount = createShopifyUniqueDiscount,
}: UniqueDiscountCodeIssueInput): Promise<UniqueDiscountCodeIssueResult> {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  const normalizedCampaignId = campaignId.trim();
  const visitorKey = buildVisitorKey(
    normalizedShopDomain,
    normalizedCampaignId,
    visitorId,
  );

  if (!normalizedShopDomain) {
    throw new UniqueDiscountCodeError("shop is required.", 400);
  }

  if (!normalizedCampaignId) {
    throw new UniqueDiscountCodeError("campaignId is required.", 400);
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: normalizedCampaignId,
      shop: {
        shopifyDomain: normalizedShopDomain,
      },
    },
    include: {
      discountSync: true,
      shop: {
        select: {
          plan: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new UniqueDiscountCodeError("Campaign not found.", 404);
  }

  const discountSync = assertCanIssueUniqueCode(campaign, now);
  await expirePastVisitorGrants(campaign.id, visitorKey, now);

  const existingGrant = await findReusableGrant(campaign.id, visitorKey, now);

  if (existingGrant) {
    return buildIssueResult(campaign.id, existingGrant, discountSync, true);
  }

  const startsAt = resolveUniqueCodeStartsAt(campaign, discountSync, now);
  const expiresAt = resolveUniqueCodeExpiresAt(campaign, discountSync, now);
  const prefix = normalizeUniqueCodePrefix(discountSync.uniqueCodePrefix);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createCode(prefix);
    const grant = await reserveGrant({
      shopId: campaign.shopId,
      campaignId: campaign.id,
      visitorKey,
      cartToken,
      code,
      expiresAt,
      claimedAt: now,
    });

    if (!grant) continue;

    try {
      const remoteDiscount = await createRemoteDiscount({
        admin,
        campaign,
        discountSync,
        code,
        startsAt,
        endsAt: expiresAt,
      });
      const savedGrant = await prisma.discountCodeGrant.update({
        where: { id: grant.id },
        data: {
          shopifyDiscountId: remoteDiscount.id,
        },
      });

      return buildIssueResult(campaign.id, savedGrant, discountSync, false);
    } catch (error) {
      await prisma.discountCodeGrant.deleteMany({
        where: { id: grant.id },
      });
      throw error;
    }
  }

  throw new UniqueDiscountCodeError(
    "A unique discount code could not be generated. Try again.",
    409,
  );
}

export async function createShopifyUniqueDiscount({
  admin,
  campaign,
  discountSync,
  code,
  startsAt,
  endsAt,
}: CreateRemoteUniqueDiscountInput): Promise<CreatedRemoteDiscount> {
  if (!admin) {
    throw new UniqueDiscountCodeError(
      "Shopify Admin access is required to issue real unique discount codes.",
      503,
    );
  }

  const title = `${discountSync.title || campaign.name} - ${code}`;

  if (discountSync.valueType === "FREE_SHIPPING") {
    const discount = await createFreeShippingCodeDiscount(admin, {
      title,
      code,
      startsAt,
      endsAt,
      minimumSubtotal: toOptionalNumber(discountSync.minimumSubtotal),
      appliesOncePerCustomer: discountSync.appliesOncePerCustomer,
    });

    return { id: discount.id };
  }

  const discount = await createBasicCodeDiscount(admin, {
    title,
    code,
    valueType:
      discountSync.valueType === "FIXED_AMOUNT"
        ? "FIXED_AMOUNT"
        : "PERCENTAGE",
    value: requirePositiveNumber(discountSync.value, "Discount value"),
    startsAt,
    endsAt,
    appliesOncePerCustomer: discountSync.appliesOncePerCustomer,
  });

  return { id: discount.id };
}

export function generateUniqueDiscountCode(prefix: string) {
  return `${normalizeUniqueCodePrefix(prefix)}-${randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;
}

export function normalizeUniqueCodePrefix(value: string | null | undefined) {
  const normalized = (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 16)
    .replace(/^[-_]+|[-_]+$/g, "");

  return normalized || "PP";
}

export function buildVisitorKey(
  shopDomain: string,
  campaignId: string,
  visitorId: string,
) {
  const normalizedVisitorId = visitorId.trim();

  if (normalizedVisitorId.length < 6 || normalizedVisitorId.length > 200) {
    throw new UniqueDiscountCodeError(
      "visitorId must be between 6 and 200 characters.",
      400,
    );
  }

  return createHash("sha256")
    .update(`${normalizeShopDomain(shopDomain)}:${campaignId}:${normalizedVisitorId}`)
    .digest("hex");
}

export function assertCanIssueUniqueCode(
  campaign: UniqueDiscountCampaign,
  now = new Date(),
): UniqueDiscountSettings {
  const gate = canUseFeature(campaign.shop, "unique_discount_codes");

  if (!gate.allowed) {
    throw new UniqueDiscountCodeError(gate.reason, 403);
  }

  if (campaign.status !== CampaignStatus.ACTIVE) {
    throw new UniqueDiscountCodeError(
      "Unique discount codes can only be issued for active campaigns.",
      409,
    );
  }

  const discountSync = campaign.discountSync;

  if (discountSync?.method !== DiscountSyncMethod.UNIQUE_CODE) {
    throw new UniqueDiscountCodeError(
      "This campaign is not configured for unique discount codes.",
      409,
    );
  }

  if (!discountSync.title?.trim()) {
    throw new UniqueDiscountCodeError(
      "Unique discount code settings are missing a discount title.",
      422,
    );
  }

  if (
    discountSync.valueType !== "PERCENTAGE" &&
    discountSync.valueType !== "FIXED_AMOUNT" &&
    discountSync.valueType !== "FREE_SHIPPING"
  ) {
    throw new UniqueDiscountCodeError(
      "Unique discount code settings are missing a discount type.",
      422,
    );
  }

  if (discountSync.valueType !== "FREE_SHIPPING") {
    requirePositiveNumber(discountSync.value, "Discount value");
  }

  const startsAt = discountSync.uniqueCodeStartsAt ?? campaign.startsAt;

  if (startsAt && startsAt > now) {
    throw new UniqueDiscountCodeError(
      "This campaign has not started issuing unique discount codes yet.",
      409,
    );
  }

  const campaignEndsAt = campaign.endsAt;
  const discountEndsAt = discountSync.uniqueCodeEndsAt;

  if (
    (campaignEndsAt && campaignEndsAt <= now) ||
    (discountEndsAt && discountEndsAt <= now)
  ) {
    throw new UniqueDiscountCodeError(
      "This campaign is no longer issuing unique discount codes.",
      410,
    );
  }

  return discountSync as UniqueDiscountSettings;
}

export function resolveUniqueCodeExpiresAt(
  campaign: Pick<UniqueDiscountCampaign, "endsAt">,
  discountSync: Pick<
    UniqueDiscountSettings,
    "uniqueCodeEndsAt" | "uniqueCodeExpiresMinutes"
  >,
  now = new Date(),
) {
  const candidates = [
    campaign.endsAt,
    discountSync.uniqueCodeEndsAt,
    discountSync.uniqueCodeExpiresMinutes &&
    discountSync.uniqueCodeExpiresMinutes > 0
      ? new Date(now.getTime() + discountSync.uniqueCodeExpiresMinutes * 60_000)
      : null,
  ].filter((date): date is Date => date instanceof Date);

  if (candidates.length === 0) return null;

  return new Date(
    Math.min(...candidates.map((candidate) => candidate.getTime())),
  );
}

function resolveUniqueCodeStartsAt(
  campaign: Pick<UniqueDiscountCampaign, "startsAt">,
  discountSync: Pick<UniqueDiscountSettings, "uniqueCodeStartsAt">,
  now: Date,
) {
  const startsAt = discountSync.uniqueCodeStartsAt ?? campaign.startsAt;

  if (!startsAt || startsAt < now) return now;

  return startsAt;
}

async function expirePastVisitorGrants(
  campaignId: string,
  visitorKey: string,
  now: Date,
) {
  await prisma.discountCodeGrant.updateMany({
    where: {
      campaignId,
      visitorKey,
      status: DiscountCodeGrantStatus.ISSUED,
      expiresAt: {
        lte: now,
      },
    },
    data: {
      status: DiscountCodeGrantStatus.EXPIRED,
    },
  });
}

function findReusableGrant(campaignId: string, visitorKey: string, now: Date) {
  return prisma.discountCodeGrant.findFirst({
    where: {
      campaignId,
      visitorKey,
      status: DiscountCodeGrantStatus.ISSUED,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

async function reserveGrant({
  shopId,
  campaignId,
  visitorKey,
  cartToken,
  code,
  expiresAt,
  claimedAt,
}: {
  shopId: string;
  campaignId: string;
  visitorKey: string;
  cartToken?: string | null;
  code: string;
  expiresAt: Date | null;
  claimedAt: Date;
}) {
  try {
    return await prisma.discountCodeGrant.create({
      data: {
        shopId,
        campaignId,
        visitorKey,
        cartToken: cartToken?.trim() || null,
        code,
        status: DiscountCodeGrantStatus.ISSUED,
        expiresAt,
        claimedAt,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }

    throw error;
  }
}

function buildIssueResult(
  campaignId: string,
  grant: Pick<DiscountCodeGrant, "code" | "expiresAt">,
  discountSync: Pick<UniqueDiscountSettings, "uniqueCodeAutoApply">,
  reused: boolean,
): UniqueDiscountCodeIssueResult {
  return {
    campaignId,
    code: grant.code,
    expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
    autoApply: discountSync.uniqueCodeAutoApply,
    autoApplyUrl: discountSync.uniqueCodeAutoApply
      ? `/discount/${encodeURIComponent(grant.code)}`
      : null,
    reused,
  };
}

function requirePositiveNumber(value: unknown, label: string) {
  const numberValue = toOptionalNumber(value);

  if (!numberValue || numberValue <= 0) {
    throw new UniqueDiscountCodeError(`${label} must be greater than 0.`, 422);
  }

  return numberValue;
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value.toString());

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

function isUniqueConstraintError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
