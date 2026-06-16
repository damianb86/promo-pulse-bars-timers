export type LowStockMessageSettings = {
  threshold: number;
  showExactQuantity: boolean;
  fallbackMessage?: string | null;
};

export function buildLowStockMessage(
  settings: LowStockMessageSettings,
  inventoryQuantity: number | null | undefined,
  localeText?: string | null,
) {
  const fallbackMessage = normalizeText(settings.fallbackMessage);
  const quantity = normalizeInventoryQuantity(inventoryQuantity);

  if (quantity === null) {
    return fallbackMessage || null;
  }

  if (quantity <= 0) {
    return fallbackMessage || null;
  }

  if (quantity > settings.threshold) {
    return null;
  }

  if (settings.showExactQuantity) {
    return interpolateQuantity(
      normalizeText(localeText) || "Only {{quantity}} left in stock.",
      quantity,
    );
  }

  return fallbackMessage || genericLowStockText(localeText) || "Low stock";
}

function normalizeInventoryQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;

  return Math.floor(value);
}

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function interpolateQuantity(template: string, quantity: number) {
  return template
    .replace(/\{\{\s*quantity\s*\}\}/g, String(quantity))
    .replace(/\{\{\s*count\s*\}\}/g, String(quantity));
}

function genericLowStockText(template: string | null | undefined) {
  const normalizedTemplate = normalizeText(template);

  if (!normalizedTemplate) return "";
  if (/\{\{\s*(quantity|count)\s*\}\}/.test(normalizedTemplate)) return "";

  return normalizedTemplate;
}
