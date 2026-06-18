import "@shopify/ui-extensions/preact";
import {
  useCurrency,
  useDiscountCodes,
  useLanguage,
  useLocalizationCountry,
  useLocalizationMarket,
  useSessionToken,
  useSettings,
  useShop,
  useTranslate,
} from "@shopify/ui-extensions/customer-account/preact";
import { render } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import {
  buildPostPurchaseCampaignRequest,
  formatPostPurchaseTimerLabel,
  readPostPurchaseCode,
  trackPostPurchaseEvent,
} from "./postPurchaseApi";

const SURFACE = "ORDER_STATUS_PAGE";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const settings = useSettings();
  const shop = useShop();
  const sessionToken = useSessionToken();
  const translate = useTranslate();
  const currency = useCurrency();
  const country = useLocalizationCountry();
  const language = useLanguage();
  const market = useLocalizationMarket();
  const discountCodes = useDiscountCodes();
  const [campaign, setCampaign] = useState(null);
  const [timerNow, setTimerNow] = useState(0);
  const appliedDiscountCodes = useMemo(
    () => readAppliedDiscountCodes(discountCodes),
    [discountCodes],
  );
  const request = useMemo(
    () =>
      buildPostPurchaseCampaignRequest({
        settings,
        shopDomain: shop.myshopifyDomain,
        storefrontUrl: shop.storefrontUrl,
        surface: SURFACE,
        currencyCode: readPostPurchaseCode(currency),
        countryCode: readPostPurchaseCode(country),
        locale: readPostPurchaseCode(language),
        marketHandle: readPostPurchaseCode(market),
        appliedDiscountCodes,
      }),
    [
      settings,
      shop.myshopifyDomain,
      shop.storefrontUrl,
      currency,
      country,
      language,
      market,
      appliedDiscountCodes,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCampaign() {
      if (!request.url) {
        setCampaign(null);
        return;
      }

      try {
        const headers = { Accept: "application/json" };

        if (request.requiresSessionToken) {
          headers.Authorization = `Bearer ${await sessionToken.get()}`;
        }

        const response = await fetch(request.url, {
          method: "GET",
          headers,
        });

        if (!response.ok) {
          if (!cancelled) setCampaign(null);
          return;
        }

        const payload = await response.json();

        if (!cancelled) {
          setCampaign(payload?.campaign ?? null);
        }
      } catch {
        if (!cancelled) setCampaign(null);
      }
    }

    loadCampaign();

    return () => {
      cancelled = true;
    };
  }, [
    request.cacheKey,
    request.requiresSessionToken,
    request.url,
    sessionToken,
  ]);

  useEffect(() => {
    if (!campaign?.campaignId) return;

    trackPostPurchaseEvent({
      campaign,
      shopDomain: shop.myshopifyDomain,
      storefrontUrl: shop.storefrontUrl,
      eventType: "POST_PURCHASE_IMPRESSION",
      surface: SURFACE,
      currencyCode: readPostPurchaseCode(currency),
      countryCode: readPostPurchaseCode(country),
      locale: readPostPurchaseCode(language),
    });
  }, [
    campaign,
    campaign?.campaignId,
    shop.myshopifyDomain,
    shop.storefrontUrl,
    currency,
    country,
    language,
  ]);

  const timerEnd = campaign?.timer?.endsAt ?? "";

  useEffect(() => {
    if (!timerEnd) return undefined;

    setTimerNow(Date.now());
    const intervalId = setInterval(() => setTimerNow(Date.now()), 1000);

    return () => clearInterval(intervalId);
  }, [timerEnd]);

  const handleActionClick = useCallback(() => {
    if (!campaign?.campaignId) return;

    trackPostPurchaseEvent({
      campaign,
      shopDomain: shop.myshopifyDomain,
      storefrontUrl: shop.storefrontUrl,
      eventType: "REORDER_OFFER_CLICK",
      surface: SURFACE,
      currencyCode: readPostPurchaseCode(currency),
      countryCode: readPostPurchaseCode(country),
      locale: readPostPurchaseCode(language),
    });
  }, [
    campaign,
    shop.myshopifyDomain,
    shop.storefrontUrl,
    currency,
    country,
    language,
  ]);

  if (!campaign) return null;

  const remainingSeconds = getRemainingSeconds(
    timerEnd,
    timerNow,
    campaign.timer?.remainingSeconds,
  );

  if (timerEnd && remainingSeconds <= 0) return null;

  const timerLabel =
    timerEnd && remainingSeconds > 0
      ? translate("postPurchaseTimerLabel", {
          time: formatPostPurchaseTimerLabel(remainingSeconds),
        })
      : "";
  const discountLabel = campaign.discountCode
    ? translate("discountCode", {
        code: campaign.discountCode,
      })
    : "";

  return (
    <s-banner
      heading={campaign.title}
      tone={campaign.tone === "success" ? "success" : "info"}
    >
      <s-stack gap={campaign.compactMode ? "small" : "base"}>
        {campaign.body ? <s-text>{campaign.body}</s-text> : null}
        {discountLabel ? <s-text type="emphasis">{discountLabel}</s-text> : null}
        {timerLabel ? <s-text type="emphasis">{timerLabel}</s-text> : null}
        {campaign.action?.url ? (
          <s-link href={campaign.action.url} onClick={handleActionClick}>
            {campaign.action.label}
          </s-link>
        ) : null}
      </s-stack>
    </s-banner>
  );
}

function readAppliedDiscountCodes(discountCodes) {
  return Array.isArray(discountCodes)
    ? discountCodes.map((discountCode) => discountCode?.code).filter(Boolean)
    : [];
}

function getRemainingSeconds(endsAt, nowMs, fallbackSeconds) {
  if (!endsAt) return 0;
  if (!nowMs) return Math.max(0, Number(fallbackSeconds) || 0);

  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(endMs)) return 0;

  return Math.max(0, Math.floor((endMs - nowMs) / 1000));
}
