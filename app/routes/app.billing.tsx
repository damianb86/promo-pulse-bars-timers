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

type PlanCardPlan = "FREE" | BillingPlanKey;

type PlanCard = {
  plan: PlanCardPlan;
  name: string;
  price: string;
  activeCampaigns: string;
  impressions: string;
  tagline: string;
  recommended: boolean;
  features: string[];
};

type ComparisonRow = {
  feature: string;
  values: Record<PlanCardPlan, string>;
};

type LoaderData = {
  currentPlan: string;
  currentPlanLabel: string;
  shopifyDomain: string;
  plans: PlanCard[];
  comparisonRows: ComparisonRow[];
  syncMessage: string;
};

type ActionData = {
  notice?: string;
  error?: string;
};

const planOrder: PlanCardPlan[] = ["FREE", "STARTER", "GROWTH", "PRO"];

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
    comparisonRows: buildComparisonRows(),
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

  if (!["STARTER", "GROWTH", "PRO"].includes(plan)) {
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
  const {
    currentPlan,
    currentPlanLabel,
    shopifyDomain,
    plans,
    comparisonRows,
    syncMessage,
  } = useLoaderData<typeof loader>();
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
              <div
                className={
                  plan.recommended
                    ? "counterpulse-plan-card counterpulse-plan-card--recommended"
                    : "counterpulse-plan-card"
                }
              >
                <div className="counterpulse-plan-card__heading">
                  <div>
                    <div className="counterpulse-plan-card__name">
                      {plan.name}
                    </div>
                    <div className="counterpulse-plan-card__price">
                      {plan.price}
                    </div>
                  </div>
                  <div className="counterpulse-plan-card__badges">
                    {plan.recommended && (
                      <s-badge tone="info">Recommended</s-badge>
                    )}
                    {plan.plan === "PRO" && (
                      <s-badge tone="success">Everything included</s-badge>
                    )}
                    {currentPlan === plan.plan && (
                      <s-badge tone="success">Current</s-badge>
                    )}
                  </div>
                </div>

                <div className="counterpulse-muted">
                  {plan.activeCampaigns} · {plan.impressions}
                </div>
                <div className="counterpulse-plan-card__tagline">
                  {plan.tagline}
                </div>

                <ul className="counterpulse-plan-card__features">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                {plan.plan === "FREE" ? (
                  <s-button disabled>
                    {currentPlan === "FREE" ? "Current plan" : "Included"}
                  </s-button>
                ) : (
                  <Form method="post">
                    <input name="plan" type="hidden" value={plan.plan} />
                    <button
                      className="counterpulse-button"
                      disabled={isSubmitting || currentPlan === plan.plan}
                      type="submit"
                    >
                      {getPlanButtonLabel(currentPlan, plan.plan)}
                    </button>
                  </Form>
                )}
              </div>
            </s-box>
          ))}
        </div>
      </s-section>

      <s-section heading="Feature comparison">
        <div className="counterpulse-pricing-table-wrap">
          <table className="counterpulse-table counterpulse-pricing-table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                {plans.map((plan) => (
                  <th key={plan.plan} scope="col">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  {plans.map((plan) => (
                    <td data-label={plan.name} key={plan.plan}>
                      {row.values[plan.plan]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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

function buildPlanCard(plan: PlanCardPlan): PlanCard {
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
    tagline: getPlanTagline(plan),
    recommended: plan === "GROWTH",
    features: getPlanFeatureBullets(plan),
  };
}

function getPlanTagline(plan: PlanCardPlan) {
  if (plan === "FREE") return "Try Promo Pulse with real storefront limits.";
  if (plan === "STARTER") return "Practical usage for small stores.";
  if (plan === "GROWTH") return "Optimization and reporting for growing stores.";
  return "Everything included for high-volume teams.";
}

function getPlanFeatureBullets(plan: PlanCardPlan) {
  if (plan === "FREE") {
    return [
      "2 active campaigns and unlimited drafts",
      "Countdown bars, product timer, free shipping goal",
      "Basic badges, cart drawer, delivery cutoff",
      "Basic targeting and 2 storefront languages",
      "25 unique codes and 1 A/B test",
      "7-day basic analytics",
      "No custom CSS",
      "No AI",
    ];
  }

  if (plan === "STARTER") {
    return [
      "5 active campaigns and unlimited drafts",
      "All basic campaign types",
      "Templates and cart drawer timer",
      "Basic targeting",
      "3 discount sync campaigns",
      "500 unique codes and 2 A/B tests",
      "30-day analytics and basic reports",
      "Standard email support",
    ];
  }

  if (plan === "GROWTH") {
    return [
      "25 active campaigns",
      "All campaign types",
      "Market overrides and advanced targeting",
      "Unlimited reasonable languages and discount sync",
      "5,000 unique codes and 10 A/B tests",
      "90-day analytics, advanced reports, CSV export",
      "5 email countdown timers",
      "Limited AI and custom CSS",
    ];
  }

  return [
    "Unlimited active campaigns, reasonable usage",
    "All campaign types and placements",
    "Custom selectors and advanced cart drawer",
    "50,000 unique codes or high reasonable usage",
    "Unlimited reasonable A/B testing with auto-winner",
    "Unlimited reasonable email countdown timers",
    "Full AI Campaign Builder",
    "Multi-store workspace and shared templates",
    "Priority support, setup help, early access",
  ];
}

function buildComparisonRows(): ComparisonRow[] {
  return [
    buildComparisonRow("Impressions/month", (limits) =>
      limits.monthlyImpressionLimit === null
        ? "Reasonable unlimited"
        : limits.monthlyImpressionLimit.toLocaleString(),
    ),
    buildComparisonRow("Active campaigns", (limits) =>
      limits.activeCampaignLimit === null
        ? "Unlimited reasonable"
        : String(limits.activeCampaignLimit),
    ),
    buildComparisonRow("Storefront languages", (limits) =>
      limits.storefrontLanguageLimit === null
        ? "Unlimited reasonable"
        : String(limits.storefrontLanguageLimit),
    ),
    buildComparisonRow("Discount sync", (limits) =>
      limits.discountSyncCampaignLimit === null
        ? "Unlimited reasonable"
        : `${limits.discountSyncCampaignLimit} campaign${
            limits.discountSyncCampaignLimit === 1 ? "" : "s"
          }`,
    ),
    buildComparisonRow("Unique codes/month", (limits) =>
      limits.monthlyUniqueCodeLimit === null
        ? "Reasonable high usage"
        : limits.monthlyUniqueCodeLimit.toLocaleString(),
    ),
    buildComparisonRow("A/B testing", (limits) =>
      limits.activeAbTestLimit === null
        ? "Unlimited reasonable"
        : `${limits.activeAbTestLimit} active, ${limits.abTestVariantLimit} variants`,
    ),
    buildComparisonRow(
      "Analytics retention",
      (limits) => `${limits.analyticsRetentionDays} days`,
    ),
    buildComparisonRow("Email countdown timers", (limits) =>
      limits.emailCountdownTimerLimit === null
        ? "Unlimited reasonable"
        : String(limits.emailCountdownTimerLimit),
    ),
    buildComparisonRow("AI Campaign Builder", (limits) => {
      if (limits.aiCampaignBuilder === "none") return "No";
      if (limits.aiCampaignBuilder === "limited") return "Limited";
      return "Full";
    }),
    buildComparisonRow("Custom CSS", (limits) =>
      limits.features.custom_css ? "Yes" : "No",
    ),
    buildComparisonRow("Auto-winner", (_limits, plan) =>
      plan === "PRO" ? "Yes" : "No",
    ),
    buildComparisonRow("Support", (limits) => limits.supportLevel),
  ];
}

function buildComparisonRow(
  feature: string,
  readValue: (limits: ReturnType<typeof getPlanLimits>, plan: PlanCardPlan) => string,
): ComparisonRow {
  return {
    feature,
    values: Object.fromEntries(
      planOrder.map((plan) => [plan, readValue(getPlanLimits(plan), plan)]),
    ) as Record<PlanCardPlan, string>,
  };
}

function getPlanButtonLabel(currentPlan: string, plan: PlanCardPlan) {
  if (currentPlan === plan) return "Manage plan";

  return planOrder.indexOf(plan) > planOrder.indexOf(currentPlan as PlanCardPlan)
    ? "Upgrade"
    : "Select plan";
}
