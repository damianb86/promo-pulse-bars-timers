import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AppAlert } from "../components/Notifications";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import {
  createSubscription,
  syncSubscriptionStatus,
  type BillingPlanKey,
} from "../services/billing.server";
import {
  formatPlanName,
  getEffectiveShopPlan,
  getPlanLimits,
} from "../services/planLimits.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";

type PlanCard = {
  plan: "FREE" | BillingPlanKey;
  name: string;
  price: string;
  activeCampaigns: string;
  impressions: string;
  features: string[];
};

type LoaderData = {
  currentPlan: string;
  currentPlanLabel: string;
  shopifyDomain: string;
  plans: PlanCard[];
  syncMessage: string;
};

type ActionData = {
  notice?: string;
  error?: string;
};

const planOrder: Array<PlanCard["plan"]> = [
  "FREE",
  "STARTER",
  "GROWTH",
  "PRO",
  "PREMIUM",
  "AGENCY",
];

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const sync = await syncSubscriptionStatus(shop);

  return {
    currentPlan: getEffectiveShopPlan(shop),
    currentPlanLabel: formatPlanName(getEffectiveShopPlan(shop)),
    shopifyDomain: shop.shopifyDomain,
    plans: planOrder.map(buildPlanCard),
    syncMessage: sync.message,
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const formData = await request.formData();
  const plan = String(formData.get("plan") ?? "") as BillingPlanKey;

  if (!["STARTER", "GROWTH", "PRO", "PREMIUM", "AGENCY"].includes(plan)) {
    return { error: "Select a paid plan to start a subscription." };
  }

  const result = await createSubscription(shop, plan);

  return {
    notice:
      result.confirmationUrl ??
      result.message ??
      "Subscription flow is not configured yet.",
  };
};

export default function BillingPage() {
  const { currentPlan, currentPlanLabel, shopifyDomain, plans, syncMessage } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page inlineSize="large" heading="Billing">
      {actionData?.notice && (
        <AppAlert tone="info" title="Billing status">
          <s-paragraph>{actionData.notice}</s-paragraph>
        </AppAlert>
      )}

      {actionData?.error && (
        <AppAlert tone="critical" title="Billing action failed">
          <s-paragraph>{actionData.error}</s-paragraph>
        </AppAlert>
      )}

      <s-section>
        <div className="counterpulse-dashboard-header">
          <div>
            <s-heading>Plans</s-heading>
            <s-paragraph>
              Choose the Promo Pulse plan that matches campaign volume and
              storefront features.
            </s-paragraph>
            <div className="counterpulse-muted">{shopifyDomain}</div>
          </div>
          <div className="counterpulse-dashboard-header__badges">
            <s-badge tone="neutral">Current: {currentPlanLabel}</s-badge>
          </div>
        </div>
      </s-section>

      <s-section heading="Available plans">
        <div className="counterpulse-plan-grid">
          {plans.map((plan) => (
            <s-box
              borderRadius="base"
              borderWidth="base"
              key={plan.plan}
              padding="base"
            >
              <div className="counterpulse-plan-card">
                <div className="counterpulse-plan-card__heading">
                  <div>
                    <div className="counterpulse-plan-card__name">
                      {plan.name}
                    </div>
                    <div className="counterpulse-plan-card__price">
                      {plan.price}
                    </div>
                  </div>
                  {currentPlan === plan.plan && (
                    <s-badge tone="success">Current</s-badge>
                  )}
                </div>

                <div className="counterpulse-muted">
                  {plan.activeCampaigns} · {plan.impressions}
                </div>

                <ul className="counterpulse-plan-card__features">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                {plan.plan === "FREE" ? (
                  <s-button disabled>Included</s-button>
                ) : (
                  <Form method="post">
                    <input name="plan" type="hidden" value={plan.plan} />
                    <button
                      className="counterpulse-button"
                      disabled={isSubmitting || currentPlan === plan.plan}
                      type="submit"
                    >
                      {currentPlan === plan.plan ? "Current plan" : "Select"}
                    </button>
                  </Form>
                )}
              </div>
            </s-box>
          ))}
        </div>
      </s-section>

      <s-section heading="Shopify Billing integration">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <div className="counterpulse-muted">{syncMessage}</div>
        </s-box>
      </s-section>
    </s-page>
  );
}

function buildPlanCard(plan: PlanCard["plan"]): PlanCard {
  const limits = getPlanLimits(plan);

  return {
    plan,
    name: formatPlanName(plan),
    price:
      limits.monthlyPriceUsd === 0 ? "$0" : `$${limits.monthlyPriceUsd}/mo`,
    activeCampaigns:
      limits.activeCampaignLimit === null
        ? "Unlimited active campaigns"
        : `${limits.activeCampaignLimit} active campaign${
            limits.activeCampaignLimit === 1 ? "" : "s"
          }`,
    impressions:
      limits.monthlyImpressionLimit === null
        ? "Reasonable unlimited views"
        : `${limits.monthlyImpressionLimit.toLocaleString()} impressions/mo`,
    features: getPlanFeatureBullets(plan),
  };
}

function getPlanFeatureBullets(plan: PlanCard["plan"]) {
  if (plan === "FREE") {
    return [
      "Countdown bar",
      "Basic product timer",
      "Basic free shipping bar",
      "No custom CSS",
    ];
  }

  if (plan === "STARTER") {
    return [
      "Basic campaigns",
      "Scheduling",
      "Campaign templates",
      "Basic targeting",
    ];
  }

  if (plan === "GROWTH") {
    return [
      "Cart drawer timer",
      "Delivery cutoff",
      "Discount sync",
      "Multi-language",
      "Analytics",
    ];
  }

  if (plan === "PRO") {
    return [
      "Advanced targeting",
      "Product badges",
      "Custom CSS",
      "Better attribution",
      "Reports",
    ];
  }

  if (plan === "PREMIUM") {
    return [
      "Unique visitor codes",
      "A/B testing and auto-winner",
      "Email countdown timers",
      "Advanced reports",
      "Market overrides",
      "Limited AI campaign builder",
    ];
  }

  return [
    "Multi-store workspace",
    "Shared templates",
    "Agency dashboard",
    "Higher limits",
    "Priority agency support label",
  ];
}
