import type { Shop, ShopPlan } from "@prisma/client";

import {
  canUseFeature,
  getPlanLimits,
  type PlanFeatureKey,
  PlanGateError,
} from "./planLimits.server";

export type BillingPlanKey = Exclude<ShopPlan, "FREE">;

export type BillingSubscriptionResult = {
  confirmationUrl: string | null;
  message: string;
};

const billingPlanNames: Record<BillingPlanKey, string> = {
  STARTER: "Promo Pulse Starter",
  GROWTH: "Promo Pulse Growth",
  PRO: "Promo Pulse Pro",
  PREMIUM: "Promo Pulse Premium",
  AGENCY: "Promo Pulse Agency",
};

export function requirePlan(
  shop: Pick<Shop, "plan">,
  featureKey: PlanFeatureKey,
) {
  const gate = canUseFeature(shop, featureKey);

  if (!gate.allowed) {
    throw new PlanGateError(gate.reason, gate.requiredPlan);
  }
}

export async function createSubscription(
  _shop: Pick<Shop, "id" | "shopifyDomain" | "plan">,
  plan: BillingPlanKey,
): Promise<BillingSubscriptionResult> {
  const limits = getPlanLimits(plan);

  return {
    confirmationUrl: null,
    message: `${billingPlanNames[plan]} is configured at $${limits.monthlyPriceUsd}/month. Shopify Billing creation is not connected in this local placeholder yet.`,
  };
}

export async function cancelSubscription(
  shop: Pick<Shop, "id" | "shopifyDomain" | "plan">,
): Promise<BillingSubscriptionResult> {
  return {
    confirmationUrl: null,
    message: `Subscription cancellation for ${shop.shopifyDomain} requires a Shopify Billing charge id and will be connected when billing records are added.`,
  };
}

export async function syncSubscriptionStatus(
  shop: Pick<Shop, "id" | "shopifyDomain" | "plan">,
) {
  return {
    plan: shop.plan,
    message:
      "Billing sync placeholder returned the local Shop.plan value. Connect Shopify Billing charge lookup before production.",
  };
}
