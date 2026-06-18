import { AnalyticsEventType } from "@prisma/client";
import prisma from "../db.server";
import {
  E2E_DEMO_SHOP_DOMAIN,
  requireE2ETestMode,
} from "../services/e2e-test.server";

export const loader = async () => {
  requireE2ETestMode();

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: E2E_DEMO_SHOP_DOMAIN },
    select: { id: true },
  });

  if (!shop) {
    return json({ impressions: 0, clicks: 0, copyCode: 0 });
  }

  const [impressions, clicks, copyCode] = await Promise.all([
    prisma.analyticsEvent.count({
      where: { shopId: shop.id, eventType: AnalyticsEventType.IMPRESSION },
    }),
    prisma.analyticsEvent.count({
      where: { shopId: shop.id, eventType: AnalyticsEventType.CLICK },
    }),
    prisma.analyticsEvent.count({
      where: { shopId: shop.id, eventType: AnalyticsEventType.COPY_CODE },
    }),
  ]);

  return json({ impressions, clicks, copyCode });
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
