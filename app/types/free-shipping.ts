export const freeShippingProgressStyleOptions = [
  { value: "BAR", label: "Bar" },
  { value: "COMPACT", label: "Compact" },
  { value: "CIRCULAR", label: "Circular" },
] as const;

export type FreeShippingProgressStyleValue =
  (typeof freeShippingProgressStyleOptions)[number]["value"];

export type FreeShippingSettingsValues = {
  thresholdAmount: string;
  currencyCode: string;
  includeDiscountedSubtotal: boolean;
  emptyCartMessage: string;
  successMessage: string;
  progressStyle: FreeShippingProgressStyleValue;
  thresholdRulesJson: string;
};

export type FreeShippingSettingsErrors = Partial<
  Record<keyof FreeShippingSettingsValues, string>
> & {
  form?: string;
};

export const defaultFreeShippingSettingsValues: FreeShippingSettingsValues = {
  thresholdAmount: "75.00",
  currencyCode: "USD",
  includeDiscountedSubtotal: true,
  emptyCartMessage: "Your cart is empty. Add items to unlock free shipping.",
  successMessage: "You've unlocked free shipping!",
  progressStyle: "BAR",
  thresholdRulesJson: "",
};
