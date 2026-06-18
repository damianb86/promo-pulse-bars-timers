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
    return json({
      impressions: 0,
      clicks: 0,
      copyCode: 0,
      uniqueCodeAssigned: 0,
      applyCodeClicked: 0,
    });
  }

  const [impressions, clicks, copyCode, uniqueCodeAssigned, applyCodeClicked] =
    await Promise.all([
      prisma.analyticsEvent.count({
        where: { shopId: shop.id, eventType: AnalyticsEventType.IMPRESSION },
      }),
      prisma.analyticsEvent.count({
        where: { shopId: shop.id, eventType: AnalyticsEventType.CLICK },
      }),
      prisma.analyticsEvent.count({
        where: { shopId: shop.id, eventType: AnalyticsEventType.COPY_CODE },
      }),
      prisma.analyticsEvent.count({
        where: {
          shopId: shop.id,
          eventType: AnalyticsEventType.UNIQUE_CODE_ASSIGNED,
        },
      }),
      prisma.analyticsEvent.count({
        where: {
          shopId: shop.id,
          eventType: AnalyticsEventType.APPLY_CODE_CLICKED,
        },
      }),
    ]);

  return json({
    impressions,
    clicks,
    copyCode,
    uniqueCodeAssigned,
    applyCodeClicked,
  });
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
