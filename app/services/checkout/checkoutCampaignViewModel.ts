import type { StorefrontCampaignResponseItem } from "../../utils/storefront-campaigns";
import {
  buildTimer,
  campaignSurfaceModes,
  formatCutoffTime,
  getFutureDate,
  normalizeCampaignSurfaceMode,
  readDiscountCode,
  readText,
  readTextWithoutPlaceholders,
  selectTopViewModel,
  type CampaignSurfaceMode,
  type CampaignSurfaceTimer,
} from "../campaign-message-view-model";

export const checkoutCampaignModes = campaignSurfaceModes;

export type CheckoutCampaignMode = CampaignSurfaceMode;

export type CheckoutCampaignMessageKind =
  | "FREE_SHIPPING_REMINDER"
  | "DISCOUNT_CODE_EXPIRATION"
  | "DELIVERY_CUTOFF"
  | "LIMITED_TIME_OFFER"
  | "CART_GOAL";

export type CheckoutCampaignProgress = {
  currentAmount: number;
  thresholdAmount: number;
  remainingAmount: number;
  percentComplete: number;
  currencyCode: string;
};

export type CheckoutCampaignTimer = CampaignSurfaceTimer;

export type CheckoutCampaignViewModel = {
  campaignId: string;
  kind: CheckoutCampaignMessageKind;
  title: string;
  body: string;
  compactMode: boolean;
  tone: "info" | "success";
  progress: CheckoutCampaignProgress | null;
  timer: CheckoutCampaignTimer | null;
  discountCode: string | null;
};

export type BuildCheckoutCampaignViewModelInput = {
  campaign: StorefrontCampaignResponseItem;
  cartSubtotal: number | null;
  currencyCode: string;
  locale: string;
  now?: Date;
  compactMode?: boolean;
  showTimer?: boolean;
};

export type SelectCheckoutCampaignInput = Omit<
  BuildCheckoutCampaignViewModelInput,
  "campaign"
> & {
  campaigns: StorefrontCampaignResponseItem[];
};

export function buildCheckoutCampaignViewModel({
  campaign,
  cartSubtotal,
  currencyCode,
  locale,
  now = new Date(),
  compactMode = false,
  showTimer = true,
}: BuildCheckoutCampaignViewModelInput): CheckoutCampaignViewModel | null {
  if (campaign.type === "FREE_SHIPPING_GOAL" && campaign.freeShipping) {
    return buildFreeShippingViewModel({
      campaign,
      cartSubtotal,
      currencyCode,
      locale,
      now,
      compactMode,
      showTimer,
    });
  }

  const discountCode = readDiscountCode(campaign);
  if (discountCode && getFutureDate(campaign.endsAt, now)) {
    return {
      campaignId: campaign.id,
      kind: "DISCOUNT_CODE_EXPIRATION",
      title: readText(campaign.texts.headline) || "Discount code available",
      body:
        readText(campaign.texts.subheadline) ||
        `Use code ${discountCode} before this offer ends.`,
      compactMode,
      tone: "info",
      progress: null,
      timer: buildTimer(campaign.endsAt, now, showTimer),
      discountCode,
    };
  }

  if (campaign.type === "DELIVERY_CUTOFF" && campaign.deliveryCutoff) {
    return buildDeliveryCutoffViewModel({
      campaign,
      now,
      compactMode,
      showTimer,
      locale,
    });
  }

  if (campaign.type === "CART_TIMER" || campaign.goal === "CART_RESCUE") {
    return buildCartGoalViewModel({ campaign, now, compactMode, showTimer });
  }

  if (getFutureDate(campaign.endsAt, now)) {
    return {
      campaignId: campaign.id,
      kind: "LIMITED_TIME_OFFER",
      title: readText(campaign.texts.headline) || "Limited-time offer",
      body: readText(campaign.texts.subheadline),
      compactMode,
      tone: "info",
      progress: null,
      timer: buildTimer(campaign.endsAt, now, showTimer),
      discountCode: null,
    };
  }

  return null;
}

export function selectCheckoutCampaignViewModel(
  input: SelectCheckoutCampaignInput,
) {
  return selectTopViewModel(
    input.campaigns,
    (campaign) => buildCheckoutCampaignViewModel({ ...input, campaign }),
    (viewModel) => checkoutKindPriority(viewModel.kind),
  );
}

export function normalizeCheckoutCampaignMode(
  value: string | null | undefined,
): CheckoutCampaignMode {
  return normalizeCampaignSurfaceMode(value);
}

function buildFreeShippingViewModel(
  input: BuildCheckoutCampaignViewModelInput,
): CheckoutCampaignViewModel | null {
  const { campaign, cartSubtotal, currencyCode, locale, compactMode } = input;
  const thresholdAmount = readPositiveNumber(
    campaign.freeShipping?.thresholdAmount,
  );

  if (!thresholdAmount) return null;

  const currentAmount = Math.max(0, cartSubtotal ?? 0);
  const remainingAmount = Math.max(0, thresholdAmount - currentAmount);
  const resolvedCurrency =
    readText(currencyCode) ||
    readText(campaign.freeShipping?.currencyCode) ||
    "USD";
  const formattedRemaining = formatMoney(
    remainingAmount,
    resolvedCurrency,
    locale,
  );
  const progress: CheckoutCampaignProgress = {
    currentAmount,
    thresholdAmount,
    remainingAmount,
    percentComplete:
      thresholdAmount > 0
        ? Math.min(100, Math.round((currentAmount / thresholdAmount) * 100))
        : 0,
    currencyCode: resolvedCurrency,
  };
  const successText =
    readText(campaign.texts.freeShippingSuccessText) ||
    readText(campaign.freeShipping?.successMessage) ||
    "Free shipping unlocked.";
  const progressText =
    readText(campaign.texts.freeShippingProgressText) ||
    readText(campaign.freeShipping?.emptyCartMessage) ||
    "You're {{remaining_amount}} away from free shipping.";
  const title =
    remainingAmount <= 0
      ? successText
      : replaceAmountPlaceholders(progressText, formattedRemaining);
  const fallbackBody =
    remainingAmount <= 0
      ? readText(campaign.texts.subheadline)
      : readText(campaign.texts.headline);

  return {
    campaignId: campaign.id,
    kind: "FREE_SHIPPING_REMINDER",
    title,
    body: fallbackBody,
    compactMode: Boolean(compactMode),
    tone: remainingAmount <= 0 ? "success" : "info",
    progress,
    timer: buildTimer(campaign.endsAt, input.now ?? new Date(), input.showTimer),
    discountCode: null,
  };
}

function buildDeliveryCutoffViewModel({
  campaign,
  now,
  compactMode,
  showTimer,
  locale,
}: Pick<
  BuildCheckoutCampaignViewModelInput,
  "campaign" | "now" | "compactMode" | "showTimer" | "locale"
>): CheckoutCampaignViewModel | null {
  const cutoff = campaign.deliveryCutoff;
  if (!cutoff) return null;

  const cutoffTime = formatCutoffTime(
    cutoff.cutoffHour,
    cutoff.cutoffMinute,
    locale,
  );
  const body =
    readTextWithoutPlaceholders(campaign.texts.deliveryBeforeCutoffText) ||
    readText(campaign.texts.subheadline) ||
    (cutoffTime
      ? `Delivery cutoff: ${cutoffTime}.`
      : "Delivery cutoff details are available for this order.");

  return {
    campaignId: campaign.id,
    kind: "DELIVERY_CUTOFF",
    title: readText(campaign.texts.headline) || "Delivery cutoff",
    body,
    compactMode: Boolean(compactMode),
    tone: "info",
    progress: null,
    timer: buildTimer(campaign.endsAt, now ?? new Date(), showTimer),
    discountCode: null,
  };
}

function buildCartGoalViewModel({
  campaign,
  now,
  compactMode,
  showTimer,
}: Pick<
  BuildCheckoutCampaignViewModelInput,
  "campaign" | "now" | "compactMode" | "showTimer"
>): CheckoutCampaignViewModel | null {
  const title = readText(campaign.texts.headline) || "Cart offer";
  const body =
    readText(campaign.texts.subheadline) ||
    "Complete checkout while this cart offer is active.";

  return {
    campaignId: campaign.id,
    kind: "CART_GOAL",
    title,
    body,
    compactMode: Boolean(compactMode),
    tone: "info",
    progress: null,
    timer: buildTimer(campaign.endsAt, now ?? new Date(), showTimer),
    discountCode: null,
  };
}

function readPositiveNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function replaceAmountPlaceholders(text: string, amount: string) {
  return text
    .replace(/\{\{\s*amount\s*\}\}/gi, amount)
    .replace(/\{\{\s*remaining_amount\s*\}\}/gi, amount);
}

function formatMoney(amount: number, currencyCode: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale || "en", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

function checkoutKindPriority(kind: CheckoutCampaignMessageKind) {
  const priority: Record<CheckoutCampaignMessageKind, number> = {
    FREE_SHIPPING_REMINDER: 0,
    DISCOUNT_CODE_EXPIRATION: 1,
    DELIVERY_CUTOFF: 2,
    CART_GOAL: 3,
    LIMITED_TIME_OFFER: 4,
  };

  return priority[kind];
}
