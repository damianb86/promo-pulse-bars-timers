export const campaignStatusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
] as const;

export const campaignEditableStatusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "EXPIRED", label: "Expired" },
] as const;

export const campaignListStatusOptions = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "DRAFT", label: "Draft" },
  { value: "EXPIRED", label: "Expired" },
] as const;

export const campaignGoalOptions = [
  { value: "FLASH_SALE", label: "Flash sale" },
  { value: "FREE_SHIPPING", label: "Free shipping" },
  { value: "CART_RESCUE", label: "Cart rescue" },
  { value: "DELIVERY_CUTOFF", label: "Delivery cutoff" },
  { value: "LOW_STOCK_URGENCY", label: "Low stock urgency" },
  { value: "PRODUCT_BADGE", label: "Product badge" },
  { value: "ANNOUNCEMENT", label: "Announcement" },
] as const;

export const campaignTypeOptions = [
  { value: "COUNTDOWN_BAR", label: "Countdown bar" },
  { value: "PRODUCT_TIMER", label: "Product timer" },
  { value: "CART_TIMER", label: "Cart timer" },
  { value: "FREE_SHIPPING_GOAL", label: "Free shipping goal" },
  { value: "DELIVERY_CUTOFF", label: "Delivery cutoff" },
  { value: "LOW_STOCK", label: "Low stock message" },
  { value: "PRODUCT_BADGE", label: "Product badge" },
] as const;

export const placementTypeOptions = [
  {
    value: "TOP_BAR",
    label: "Top bar",
    description: "Global bar injected at the top of the storefront.",
  },
  {
    value: "BOTTOM_BAR",
    label: "Bottom bar",
    description: "Global bar injected at the bottom of the storefront.",
  },
  {
    value: "PRODUCT_PAGE",
    label: "Product page",
    description: "Product detail page block or automatic product-page surface.",
  },
  {
    value: "PRODUCT_PAGE_BADGE",
    label: "Product page badge",
    description: "Badge over product media on product detail pages only.",
  },
  {
    value: "COLLECTION_CARD",
    label: "Collection card badge",
    description: "Badge rendered on product cards in collection/search grids.",
  },
  {
    value: "CART_PAGE",
    label: "Cart page",
    description: "Cart page module.",
  },
  {
    value: "CART_DRAWER",
    label: "Cart drawer",
    description: "Cart drawer module.",
  },
  {
    value: "THANK_YOU_PAGE",
    label: "Thank you page",
    description: "Post-purchase thank you page extension.",
  },
  {
    value: "ORDER_STATUS_PAGE",
    label: "Order status page",
    description: "Order status page extension.",
  },
  {
    value: "PASSWORD_PAGE",
    label: "Password page",
    description: "Password page announcement surface.",
  },
  {
    value: "CUSTOM_SELECTOR",
    label: "Custom HTML slot",
    description: "Renders into a configured selector or Campaign ID snippet.",
  },
] as const;

export type CampaignStatusValue =
  (typeof campaignListStatusOptions)[number]["value"] extends infer Value
    ? Exclude<Value, "">
    : never;
export type EditableCampaignStatusValue =
  (typeof campaignEditableStatusOptions)[number]["value"];
export type CampaignGoalValue = (typeof campaignGoalOptions)[number]["value"];
export type CampaignTypeValue = (typeof campaignTypeOptions)[number]["value"];
export type PlacementTypeValue = (typeof placementTypeOptions)[number]["value"];

export function getDefaultPlacementForCampaignType(
  type: CampaignTypeValue,
): PlacementTypeValue {
  if (type === "COUNTDOWN_BAR") return "TOP_BAR";
  if (type === "CART_TIMER") return "CART_DRAWER";
  if (type === "FREE_SHIPPING_GOAL") return "CART_DRAWER";
  if (type === "PRODUCT_BADGE") return "COLLECTION_CARD";
  return "PRODUCT_PAGE";
}

export function formatCampaignOption(value: string) {
  if (value === "PRODUCT_PAGE_BADGE") return "Product Page Badge";
  if (value === "COLLECTION_CARD") return "Collection Card Badge";
  if (value === "CUSTOM_SELECTOR") return "Custom HTML Slot";

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
