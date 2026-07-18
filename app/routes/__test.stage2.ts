import { EmailTimerExpiredBehavior } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import prisma from "../db.server";
import { expireVisitorCode } from "../services/discounts/uniqueCodes.server";
import {
  E2E_DEMO_SHOP_DOMAIN,
  requireE2ETestMode,
} from "../services/e2e-test.server";
import { normalizeShopDomain } from "../utils/storefront-campaigns";

type Stage2TestBody = Record<string, unknown>;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  requireE2ETestMode();

  const url = new URL(request.url);

  if (url.searchParams.get("resource") !== "experiments-and-offers") {
    return json({ error: "Unsupported Stage 2 test resource." }, 400);
  }

  return readExperimentsAndOffersState(url.searchParams.get("campaignId"));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  requireE2ETestMode();

  if (request.method !== "POST") {
    return json({ error: "Use POST for Stage 2 test mutations." }, 405);
  }

  const body = await readJsonBody(request);
  const actionName = readText(body.action);

  if (actionName === "expireUniqueCode") {
    return expireUniqueCode(body);
  }

  if (actionName === "expireEmailTimer") {
    return expireEmailTimer(body);
  }

  return json({ error: "Unsupported Stage 2 test mutation." }, 400);
};

async function expireUniqueCode(body: Stage2TestBody) {
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: normalizeShopDomain(readText(body.shop)) },
    select: { id: true },
  });

  if (!shop) return json({ error: "Shop not found." }, 404);

  const result = await expireVisitorCode({
    shopId: shop.id,
    campaignId: readText(body.campaignId),
    visitorId: readText(body.visitorId),
    now: new Date(),
  });

  return json({ ok: true, expired: result.count }, 200);
}

async function expireEmailTimer(body: Stage2TestBody) {
  const expiredBehavior = readEmailTimerExpiredBehavior(body.expiredBehavior);
  const result = await prisma.emailTimer.updateMany({
    where: { publicToken: readText(body.publicToken) },
    data: {
      endsAt: new Date(Date.now() - 1000),
      ...(expiredBehavior ? { expiredBehavior } : {}),
    },
  });

  return json({ ok: true, expired: result.count }, result.count ? 200 : 404);
}

async function readExperimentsAndOffersState(campaignId: string | null) {
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: E2E_DEMO_SHOP_DOMAIN },
    select: { id: true },
  });

  if (!shop) {
    return json({ campaigns: [] }, 200);
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      shopId: shop.id,
      ...(campaignId ? { id: campaignId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      publishedAt: true,
      publishedSnapshot: true,
      translations: {
        orderBy: { locale: "asc" },
        select: {
          locale: true,
          headline: true,
          subheadline: true,
          ctaText: true,
          ctaUrl: true,
        },
      },
      discountSync: true,
      experiments: {
        orderBy: { createdAt: "asc" },
        include: { variants: { orderBy: { createdAt: "asc" } } },
      },
      advancedDiscountRules: { orderBy: { createdAt: "asc" } },
      discountCodePools: {
        orderBy: { createdAt: "asc" },
        include: {
          codes: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              code: true,
              status: true,
              visitorId: true,
              sessionId: true,
              assignedAt: true,
              expiresAt: true,
              usedAt: true,
            },
          },
        },
      },
      attributionTouches: {
        orderBy: { occurredAt: "asc" },
        select: {
          id: true,
          experimentId: true,
          variantId: true,
          visitorId: true,
          sessionId: true,
          eventType: true,
          placementType: true,
          occurredAt: true,
        },
      },
      conversions: {
        orderBy: { occurredAt: "asc" },
        select: {
          id: true,
          experimentId: true,
          variantId: true,
          visitorId: true,
          sessionId: true,
          orderId: true,
          revenueAmount: true,
          currencyCode: true,
          occurredAt: true,
        },
      },
      analyticsEvents: {
        orderBy: { occurredAt: "asc" },
        select: {
          id: true,
          eventType: true,
          placementType: true,
          sessionId: true,
          cartToken: true,
          orderId: true,
          occurredAt: true,
        },
      },
    },
  });

  return json({ campaigns }, 200);
}

async function readJsonBody(request: Request): Promise<Stage2TestBody> {
  try {
    const body = await request.json();

    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Stage2TestBody)
      : {};
  } catch {
    return {};
  }
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readEmailTimerExpiredBehavior(value: unknown) {
  if (
    value === EmailTimerExpiredBehavior.SHOW_EXPIRED ||
    value === EmailTimerExpiredBehavior.SHOW_ZERO ||
    value === EmailTimerExpiredBehavior.HIDE
  ) {
    return value;
  }

  return null;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
