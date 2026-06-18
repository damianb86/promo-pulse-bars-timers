import type { StorefrontCampaignResponseItem } from "../../utils/storefront-campaigns";

export const postPurchaseSurfaces = [
  "THANK_YOU_PAGE",
  "ORDER_STATUS_PAGE",
] as const;

export type PostPurchaseSurface = (typeof postPurchaseSurfaces)[number];

export const postPurchaseCampaignModes = [
  "AUTO_ELIGIBLE",
  "SPECIFIC_CAMPAIGN",
] as const;

export type PostPurchaseCampaignMode =
  (typeof postPurchaseCampaignModes)[number];

export type PostPurchaseMessageKind =
  | "OFFER_USED_SUCCESSFULLY"
  | "NEXT_ORDER_DISCOUNT"
  | "DELIVERY_PROMISE"
  | "SHARE_THIS_OFFER"
  | "LIMITED_TIME_REORDER_DISCOUNT";

export type PostPurchaseCampaignAction = {
  label: string;
  url: string;
};

export type PostPurchaseCampaignTimer = {
  endsAt: string;
  remainingSeconds: number;
};

export type PostPurchaseCampaignViewModel = {
  campaignId: string;
  placement: PostPurchaseSurface;
  kind: PostPurchaseMessageKind;
  title: string;
  body: string;
  compactMode: boolean;
  tone: "info" | "success";
  timer: PostPurchaseCampaignTimer | null;
  discountCode: string | null;
  action: PostPurchaseCampaignAction | null;
};

export type BuildPostPurchaseCampaignViewModelInput = {
  campaign: StorefrontCampaignResponseItem;
  surface: PostPurchaseSurface;
  appliedDiscountCodes?: string[];
  locale: string;
  now?: Date;
  compactMode?: boolean;
  showTimer?: boolean;
};

export type SelectPostPurchaseCampaignInput = Omit<
  BuildPostPurchaseCampaignViewModelInput,
  "campaign"
> & {
  campaigns: StorefrontCampaignResponseItem[];
};

export function buildPostPurchaseCampaignViewModel({
  campaign,
  surface,
  appliedDiscountCodes = [],
  locale,
  now = new Date(),
  compactMode = false,
  showTimer = true,
}: BuildPostPurchaseCampaignViewModelInput): PostPurchaseCampaignViewModel | null {
  const discountCode = readDiscountCode(campaign);
  const appliedDiscountCode = discountCode
    ? findAppliedDiscountCode(discountCode, appliedDiscountCodes)
    : "";

  if (surface === "THANK_YOU_PAGE" && appliedDiscountCode) {
    return {
      campaignId: campaign.id,
      placement: surface,
      kind: "OFFER_USED_SUCCESSFULLY",
      title: "Offer used successfully",
      body: `Your discount code ${appliedDiscountCode} was detected on this order.`,
      compactMode,
      tone: "success",
      timer: null,
      discountCode: appliedDiscountCode,
      action: buildAction(campaign, "Shop again"),
    };
  }

  if (campaign.type === "DELIVERY_CUTOFF" && campaign.deliveryCutoff) {
    const deliveryPromise = buildDeliveryPromise({
      campaign,
      locale,
      now,
      showTimer,
    });

    if (deliveryPromise) {
      return {
        campaignId: campaign.id,
        placement: surface,
        kind: "DELIVERY_PROMISE",
        title: deliveryPromise.title,
        body: deliveryPromise.body,
        compactMode,
        tone: "info",
        timer: deliveryPromise.timer,
        discountCode: null,
        action: buildAction(campaign, "View details"),
      };
    }
  }

  if (discountCode) {
    const timer = buildTimer(campaign.endsAt, now, showTimer);

    if (timer) {
      return {
        campaignId: campaign.id,
        placement: surface,
        kind: "LIMITED_TIME_REORDER_DISCOUNT",
        title: "Limited-time reorder discount",
        body:
          readText(campaign.texts.subheadline) ||
          `Use code ${discountCode} on your next order before this offer ends.`,
        compactMode,
        tone: "info",
        timer,
        discountCode,
        action: buildAction(campaign, "Shop again"),
      };
    }

    return {
      campaignId: campaign.id,
      placement: surface,
      kind: "NEXT_ORDER_DISCOUNT",
      title: "Next order discount",
      body:
        readText(campaign.texts.subheadline) ||
        `Use code ${discountCode} on your next order.`,
      compactMode,
      tone: "info",
      timer: null,
      discountCode,
      action: buildAction(campaign, "Shop again"),
    };
  }

  const action = buildAction(campaign, "Share offer");

  if (action) {
    return {
      campaignId: campaign.id,
      placement: surface,
      kind: "SHARE_THIS_OFFER",
      title: "Share this offer",
      body:
        readText(campaign.texts.subheadline) ||
        readText(campaign.texts.headline) ||
        "Share this promotion with someone who may want it.",
      compactMode,
      tone: "info",
      timer: buildTimer(campaign.endsAt, now, showTimer),
      discountCode: null,
      action,
    };
  }

  return null;
}

export function selectPostPurchaseCampaignViewModel(
  input: SelectPostPurchaseCampaignInput,
) {
  const ranked = input.campaigns
    .map((campaign, index) => ({
      index,
      viewModel: buildPostPurchaseCampaignViewModel({
        ...input,
        campaign,
      }),
    }))
    .filter(
      (
        item,
      ): item is { index: number; viewModel: PostPurchaseCampaignViewModel } =>
        item.viewModel !== null,
    )
    .sort((left, right) => {
      const priority =
        postPurchaseKindPriority(left.viewModel.kind) -
        postPurchaseKindPriority(right.viewModel.kind);

      return priority || left.index - right.index;
    });

  return ranked[0]?.viewModel ?? null;
}

export function normalizePostPurchaseSurface(
  value: string | null | undefined,
): PostPurchaseSurface {
  return value === "ORDER_STATUS_PAGE" ? "ORDER_STATUS_PAGE" : "THANK_YOU_PAGE";
}

export function normalizePostPurchaseCampaignMode(
  value: string | null | undefined,
): PostPurchaseCampaignMode {
  return value === "SPECIFIC_CAMPAIGN" ? "SPECIFIC_CAMPAIGN" : "AUTO_ELIGIBLE";
}

function buildDeliveryPromise({
  campaign,
  locale,
  now,
  showTimer,
}: Pick<
  BuildPostPurchaseCampaignViewModelInput,
  "campaign" | "locale" | "now" | "showTimer"
>) {
  const merchantText =
    readTextWithoutPlaceholders(campaign.texts.deliveryAfterCutoffText) ||
    readTextWithoutPlaceholders(campaign.texts.deliveryBeforeCutoffText);
  const cutoff = campaign.deliveryCutoff;
  const cutoffTime = cutoff
    ? formatCutoffTime(cutoff.cutoffHour, cutoff.cutoffMinute, locale)
    : "";
  const body =
    merchantText ||
    readText(campaign.texts.subheadline) ||
    (cutoffTime
      ? `Delivery cutoff: ${cutoffTime}.`
      : "Delivery timing follows the store's shipping settings for this order.");

  if (!body) return null;

  return {
    title: readText(campaign.texts.headline) || "Delivery promise",
    body,
    timer: buildTimer(campaign.endsAt, now ?? new Date(), showTimer),
  };
}

function buildTimer(
  endsAt: string | null,
  now: Date,
  showTimer: boolean | undefined,
): PostPurchaseCampaignTimer | null {
  const endDate = getFutureDate(endsAt, now);
  if (!showTimer || !endDate) return null;

  return {
    endsAt: endDate.toISOString(),
    remainingSeconds: Math.max(
      0,
      Math.floor((endDate.getTime() - now.getTime()) / 1000),
    ),
  };
}

function getFutureDate(value: string | null, now: Date) {
  if (!value) return null;

  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date <= now) return null;

  return date;
}

function readDiscountCode(campaign: StorefrontCampaignResponseItem) {
  return readText(campaign.discount?.discountCode);
}

function findAppliedDiscountCode(
  expectedCode: string,
  appliedDiscountCodes: string[],
) {
  const expected = expectedCode.trim().toLowerCase();

  return (
    appliedDiscountCodes.find(
      (code) => code.trim().toLowerCase() === expected,
    ) ?? ""
  );
}

function buildAction(
  campaign: StorefrontCampaignResponseItem,
  fallbackLabel: string,
): PostPurchaseCampaignAction | null {
  const url = readText(campaign.texts.ctaUrl);

  if (!url || url === "#") return null;

  return {
    label: readText(campaign.texts.ctaText) || fallbackLabel,
    url,
  };
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readTextWithoutPlaceholders(text: string) {
  const normalized = readText(text);

  return /\{\{\s*[^}]+\s*\}\}/.test(normalized) ? "" : normalized;
}

function formatCutoffTime(
  hour: unknown,
  minute: unknown,
  locale: string,
) {
  const parsedHour = Number(hour);
  const parsedMinute = Number(minute);

  if (
    !Number.isInteger(parsedHour) ||
    !Number.isInteger(parsedMinute) ||
    parsedHour < 0 ||
    parsedHour > 23 ||
    parsedMinute < 0 ||
    parsedMinute > 59
  ) {
    return "";
  }

  try {
    const date = new Date(Date.UTC(2026, 0, 1, parsedHour, parsedMinute, 0));

    return new Intl.DateTimeFormat(locale || "en", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return `${String(parsedHour).padStart(2, "0")}:${String(
      parsedMinute,
    ).padStart(2, "0")}`;
  }
}

function postPurchaseKindPriority(kind: PostPurchaseMessageKind) {
  const priority: Record<PostPurchaseMessageKind, number> = {
    OFFER_USED_SUCCESSFULLY: 0,
    DELIVERY_PROMISE: 1,
    LIMITED_TIME_REORDER_DISCOUNT: 2,
    NEXT_ORDER_DISCOUNT: 3,
    SHARE_THIS_OFFER: 4,
  };

  return priority[kind];
}
