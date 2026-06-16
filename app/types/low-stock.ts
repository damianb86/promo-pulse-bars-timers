export type LowStockSettingsValues = {
  threshold: string;
  showExactQuantity: boolean;
  fallbackMessage: string;
};

export type LowStockSettingsErrors = Partial<
  Record<keyof LowStockSettingsValues | "form", string>
>;

export const defaultLowStockSettingsValues: LowStockSettingsValues = {
  threshold: "5",
  showExactQuantity: false,
  fallbackMessage: "Low stock",
};
