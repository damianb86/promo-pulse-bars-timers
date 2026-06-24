import {
  CampaignStatus,
  DiscountSyncMethod,
  type UniqueDiscountCode,
} from "@prisma/client";

import prisma from "../db.server";
import { getShopByDomain } from "../models/shop.server";
import {
  assignCodeToVisitor,
  expireVisitorCode,
  UniqueCodesError,
} from "./discounts/uniqueCodes.server";
import { canUseFeature } from "./planLimits.server";
import {
  buildCorsHeaders,
  type StorefrontAccessOptions,
  verifyStorefrontAccess,
} from "./storefront-security.server";
import { normalizeShopDomain } from "../utils/storefront-campaigns";

type UniqueCodeAssignBody = Record<string, unknown>;

export function loadUniqueCodeAssignResponse(request: Request) {
  if (request.method === "OPTIONS") {
    return jsonResponse(null, { status: 204 });
  }

  return jsonResponse(
    { error: "Use POST to assign a unique discount code." },
    { status: 405 },
  );
}

export async function handleUniqueCodeAssignAction(
  request: Request,
  accessOptions: StorefrontAccessOptions = {},
) {
  if (request.method === "OPTIONS") {
    return jsonResponse(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Use POST to assign a unique discount code." },
      { status: 405 },
    );
  }

  const body = await readJsonBody(request);
  const input = parseAssignInput(body);

  if (!input.shop || !input.campaignId || !input.visitorId) {
    return jsonResponse(
      { error: "shop, campaignId, and visitorId are required." },
      { status: 400 },
    );
  }

  const access = verifyStorefrontAccess(request, input.shop, accessOptions);

  if (!access.ok) {
    return jsonResponse(
      { error: access.error },
      { status: access.status, access },
    );
  }

  try {
    const now = new Date();
    const shop = await getShopByDomain(input.shop);

    if (!shop) {
      return jsonResponse(
        { error: "Shop was not found." },
        { status: 404, access },
      );
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: input.campaignId, shopId: shop.id },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        discountSync: {
          select: {
            method: true,
            uniqueCodeAutoApply: true,
          },
        },
      },
    });

    if (!campaign || !isCampaignActive(campaign, now)) {
      return jsonResponse(
        { error: "Unique discount campaign is not active." },
        { status: 404, access },
      );
    }

    if (campaign.discountSync?.method !== DiscountSyncMethod.UNIQUE_CODE) {
      return jsonResponse(
        { error: "This campaign is not configured for unique codes." },
        { status: 409, access },
      );
    }

    const gate = canUseFeature(shop, "unique_discount_codes");

    if (!gate.allowed) {
      return jsonResponse({ error: gate.reason }, { status: 403, access });
    }

    if (input.action === "expire") {
      await expireVisitorCode({
        shopId: shop.id,
        campaignId: campaign.id,
        visitorId: input.visitorId,
      });

      return jsonResponse(
        { ok: true, expired: true },
        { status: 200, access },
      );
    }

    const result = await assignCodeToVisitor({
      shopId: shop.id,
      campaignId: campaign.id,
      visitorId: input.visitorId,
      sessionId: input.sessionId,
    });

    return jsonResponse(
      {
        ok: true,
        code: result.code.code,
        expiresAt: result.code.expiresAt
          ? result.code.expiresAt.toISOString()
          : null,
        discountApplyUrl: campaign.discountSync.uniqueCodeAutoApply
          ? buildDiscountApplyUrl(result.code, input.redirectPath)
          : null,
        reused: result.reused,
      },
      { status: result.reused ? 200 : 201, access },
    );
  } catch (error) {
    if (error instanceof UniqueCodesError) {
      if ([404, 409, 410].includes(error.status)) {
        return jsonResponse(
          { ok: false, unavailable: true, error: error.message },
          { status: 200, access },
        );
      }

      return jsonResponse(
        { ok: false, error: error.message },
        { status: error.status, access },
      );
    }

    console.error("Failed to assign storefront unique discount code", error);

    return jsonResponse(
      { error: "Unique discount code could not be assigned." },
      { status: 500, access },
    );
  }
}

async function readJsonBody(request: Request): Promise<UniqueCodeAssignBody> {
  try {
    const body = await request.json();

    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as UniqueCodeAssignBody)
      : {};
  } catch {
    return {};
  }
}

function parseAssignInput(body: UniqueCodeAssignBody) {
  return {
    action: readOptionalAction(body.action),
    shop: normalizeShopDomain(readText(body.shop, 255)),
    campaignId: readText(body.campaignId, 255),
    visitorId: readText(body.visitorId, 255),
    sessionId: readNullableText(body.sessionId, 255),
    redirectPath: readSafeRedirectPath(body.redirectPath),
  };
}

function readOptionalAction(value: unknown) {
  return value === "expire" ? value : "assign";
}

function readText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readNullableText(value: unknown, maxLength: number) {
  const text = readText(value, maxLength);

  return text || null;
}

function readSafeRedirectPath(value: unknown) {
  const path = readText(value, 500);

  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";

  return path;
}

function isCampaignActive(
  campaign: {
    status: CampaignStatus;
    startsAt: Date | null;
    endsAt: Date | null;
  },
  now: Date,
) {
  return (
    campaign.status === CampaignStatus.ACTIVE &&
    (!campaign.startsAt || campaign.startsAt <= now) &&
    (!campaign.endsAt || campaign.endsAt > now)
  );
}

function buildDiscountApplyUrl(
  code: Pick<UniqueDiscountCode, "code">,
  redirectPath: string,
) {
  return `/discount/${encodeURIComponent(code.code)}?redirect=${encodeURIComponent(
    redirectPath,
  )}`;
}

function jsonResponse(
  body: unknown,
  options: {
    status: number;
    access?: ReturnType<typeof verifyStorefrontAccess>;
  },
) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...buildCorsHeaders(options.access),
  });

  if (body !== null) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(body === null ? null : JSON.stringify(body), {
    status: options.status,
    headers,
  });
}
