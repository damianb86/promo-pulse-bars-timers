export type FreeShippingProgress = {
  threshold: number;
  cartSubtotal: number;
  amountRemaining: number;
  percentage: number;
  unlocked: boolean;
};

export function calculateFreeShippingProgress(
  threshold: number,
  cartSubtotal: number,
): FreeShippingProgress {
  const safeThreshold = normalizeMoneyAmount(threshold);
  const safeSubtotal = normalizeMoneyAmount(cartSubtotal);
  const unlocked = safeThreshold <= 0 || safeSubtotal >= safeThreshold;
  const amountRemaining = unlocked
    ? 0
    : roundCurrency(safeThreshold - safeSubtotal);

  return {
    threshold: safeThreshold,
    cartSubtotal: safeSubtotal,
    amountRemaining,
    percentage:
      safeThreshold <= 0
        ? 100
        : Math.min(100, Math.max(0, (safeSubtotal / safeThreshold) * 100)),
    unlocked,
  };
}

export function formatCurrencyAmount(
  amount: number,
  currencyCode: string,
  locale = "en",
) {
  const safeAmount = normalizeMoneyAmount(amount);
  const normalizedCurrency = /^[A-Z]{3}$/.test(currencyCode)
    ? currencyCode
    : "USD";

  try {
    return new Intl.NumberFormat(locale, {
      currency: normalizedCurrency,
      style: "currency",
    }).format(safeAmount);
  } catch {
    return `${normalizedCurrency} ${safeAmount.toFixed(2)}`;
  }
}

export function interpolateFreeShippingText(
  template: string,
  formattedAmount: string,
) {
  // Canonical token only (no aliases).
  return template.replace(
    /\{\{\s*remaining_amount\s*\}\}/g,
    formattedAmount,
  );
}

// Canonical free-shipping message variables (no aliases). Mirrors the storefront
// builder in free-shipping.js so the preview and the live bar resolve the same
// tokens.
export function buildFreeShippingVariables(
  progress: FreeShippingProgress,
  currencyCode: string,
  locale = "en",
): Record<string, string> {
  const pct = Math.round(progress.percentage);
  return {
    remaining_amount: formatCurrencyAmount(
      progress.amountRemaining,
      currencyCode,
      locale,
    ),
    cart_subtotal: formatCurrencyAmount(
      progress.cartSubtotal,
      currencyCode,
      locale,
    ),
    threshold_amount: formatCurrencyAmount(
      progress.threshold,
      currencyCode,
      locale,
    ),
    progress_percent: `${pct}%`,
    remaining_percent: `${Math.max(0, 100 - pct)}%`,
  };
}

function normalizeMoneyAmount(value: number) {
  return Number.isFinite(value) ? Math.max(0, roundCurrency(value)) : 0;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
