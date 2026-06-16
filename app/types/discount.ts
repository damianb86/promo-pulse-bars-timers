import type { ShopifyDiscountSummary } from "../services/shopifyDiscounts.server";

export const discountModeOptions = [
  { value: "NONE", label: "No discount" },
  { value: "LINK_EXISTING", label: "Link existing discount" },
  { value: "CREATE_NEW", label: "Create new discount" },
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
  syncStartEnd: false,
  title: "",
  valueType: "PERCENTAGE",
  value: "10",
  startsAt: "",
  endsAt: "",
  minimumSubtotal: "",
  appliesOncePerCustomer: false,
};
