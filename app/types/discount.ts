import type { ShopifyDiscountSummary } from "../services/shopifyDiscounts.server";

export const discountModeOptions = [
  { value: "NONE", label: "No discount" },
  { value: "LINK_EXISTING", label: "Link existing discount" },
  { value: "CREATE_NEW", label: "Create new discount" },
  { value: "UNIQUE_CODES", label: "Unique code per visitor" },
] as const;

export const discountValueTypeOptions = [
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FIXED_AMOUNT", label: "Fixed amount" },
  { value: "FREE_SHIPPING", label: "Free shipping" },
] as const;

export type DiscountModeValue = (typeof discountModeOptions)[number]["value"];
export type DiscountValueTypeValue =
  (typeof discountValueTypeOptions)[number]["value"];

export type DiscountSettingsValues = {
  mode: DiscountModeValue;
  existingCodeOrId: string;
  discountCode: string;
  shopifyDiscountId: string;
  syncStartEnd: boolean;
  title: string;
  valueType: DiscountValueTypeValue;
  value: string;
  startsAt: string;
  endsAt: string;
  minimumSubtotal: string;
  appliesOncePerCustomer: boolean;
  uniqueCodePrefix: string;
  uniqueCodeExpiresMinutes: string;
  uniqueCodeAutoApply: boolean;
  uniqueCodeReassignExpired: boolean;
};

export type DiscountSettingsErrors = Partial<
  Record<keyof DiscountSettingsValues | "form", string>
>;

export type DiscountOption = ShopifyDiscountSummary;

export const defaultDiscountSettingsValues: DiscountSettingsValues = {
  mode: "NONE",
  existingCodeOrId: "",
  discountCode: "",
  shopifyDiscountId: "",
  // On by default so a discount's Schedule and limits (start/end) drives when
  // the campaign — and its code — starts/stops showing on the storefront.
  syncStartEnd: true,
  title: "",
  valueType: "PERCENTAGE",
  value: "10",
  startsAt: "",
  endsAt: "",
  minimumSubtotal: "",
  appliesOncePerCustomer: false,
  uniqueCodePrefix: "PP",
  uniqueCodeExpiresMinutes: "60",
  uniqueCodeAutoApply: true,
  uniqueCodeReassignExpired: false,
};
