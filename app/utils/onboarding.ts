import type { PlacementTypeValue } from "../types/campaign-options";
import type {
  OnboardingGoalValue,
  OnboardingLocationValue,
  StarterCampaignDefaults,
} from "../types/onboarding";
import { getDefaultCampaignTranslationValues } from "./campaign-localization";

export function getStarterCampaignDefaults(
  goal: OnboardingGoalValue,
  location: OnboardingLocationValue = "TOP_BAR",
): StarterCampaignDefaults {
  const placementType = getPlacementTypeForLocation(location);

  if (goal === "FREE_SHIPPING") {
    const copy = getDefaultCampaignTranslationValues(
      "FREE_SHIPPING",
      "FREE_SHIPPING_GOAL",
      "en",
    );

    return {
      goal: "FREE_SHIPPING",
      type: "FREE_SHIPPING_GOAL",
      placementType,
      name: "Free Shipping Goal",
      templateKey: "free-shipping",
      headline: copy.headline,
      subheadline: copy.subheadline,
      ctaText: copy.ctaText,
      ctaUrl: "/collections/all",
    };
  }

  if (goal === "DELIVERY_CUTOFF") {
    const copy = getDefaultCampaignTranslationValues(
      "DELIVERY_CUTOFF",
      "DELIVERY_CUTOFF",
      "en",
    );

    return {
      goal: "DELIVERY_CUTOFF",
      type: "DELIVERY_CUTOFF",
      placementType,
      name: "Delivery Cutoff",
      templateKey: "delivery-cutoff",
      headline: copy.headline,
      subheadline: copy.subheadline,
      ctaText: copy.ctaText,
      ctaUrl: "/collections/all",
    };
  }

  if (goal === "CART_RESCUE") {
    const copy = getDefaultCampaignTranslationValues(
      "CART_RESCUE",
      "CART_TIMER",
      "en",
    );

    return {
      goal: "CART_RESCUE",
      type: "CART_TIMER",
      placementType: location === "TOP_BAR" ? "CART_PAGE" : placementType,
      name: "Cart Rescue Timer",
      templateKey: "premium-dark",
      headline: copy.headline,
      subheadline: copy.subheadline,
      ctaText: copy.ctaText,
      ctaUrl: "/cart",
    };
  }

  const copy = getDefaultCampaignTranslationValues(
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    "en",
  );

  return {
    goal: "FLASH_SALE",
    type: "COUNTDOWN_BAR",
    placementType,
    name: "Flash Sale Countdown",
    templateKey: "flash-sale",
    headline: copy.headline,
    subheadline: copy.subheadline,
    ctaText: copy.ctaText,
    ctaUrl: "/collections/sale",
  };
}

export function buildThemeEditorUrl(
  shopifyDomain: string | null | undefined,
  placementType?: PlacementTypeValue,
) {
  const domain = normalizeShopifyDomain(shopifyDomain);

  if (!domain) return "";

  const url = new URL(`https://${domain}/admin/themes/current/editor`);
  url.searchParams.set("context", "apps");

  if (placementType === "PRODUCT_PAGE") {
    url.searchParams.set("template", "product");
  }

  if (placementType === "CART_PAGE" || placementType === "CART_DRAWER") {
    url.searchParams.set("template", "cart");
  }

  return url.toString();
}

function getPlacementTypeForLocation(
  location: OnboardingLocationValue,
): PlacementTypeValue {
  if (location === "PRODUCT_PAGE") return "PRODUCT_PAGE";
  if (location === "CART") return "CART_PAGE";
  return "TOP_BAR";
}

function normalizeShopifyDomain(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}
