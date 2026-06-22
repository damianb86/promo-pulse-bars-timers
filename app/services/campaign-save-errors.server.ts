import type {
  CampaignFormErrors,
  CampaignFormValues,
} from "../types/campaign-form";

const REQUIRED_DISCOUNT_SCOPES = ["read_discounts", "write_discounts"] as const;

export function buildMissingDiscountScopesError(
  scope: string | null | undefined,
): CampaignFormErrors | null {
  const grantedScopes = parseScopes(scope);

  if (grantedScopes.size === 0) return null;

  const missingScopes = REQUIRED_DISCOUNT_SCOPES.filter(
    (requiredScope) => !grantedScopes.has(requiredScope),
  );

  if (missingScopes.length === 0) return null;

  const detail = `Shopify has not granted ${missingScopes.join(
    ", ",
  )} to this app installation. Reauthorize Promo Pulse so Shopify grants the discount permissions, then save again.`;

  return {
    form: `Free shipping automatic discount could not be configured. ${detail}`,
    freeShippingAutoDiscount: detail,
  };
}

export function buildCampaignPersistenceError(
  error: unknown,
  options: {
    action: "create" | "publish" | "save";
    values: CampaignFormValues;
  },
): CampaignFormErrors {
  const detail = sanitizeErrorMessage(
    error instanceof Error ? error.message : String(error),
  );
  const prefix =
    options.action === "create"
      ? "Campaign could not be created"
      : options.action === "publish"
        ? "Campaign could not be published"
        : "Campaign draft could not be saved";

  if (isDiscountPermissionError(detail)) {
    return {
      form: `${prefix}. Shopify automatic free shipping failed because discount permissions are missing. ${detail}`,
      freeShippingAutoDiscount:
        "Shopify did not allow Promo Pulse to create or update the automatic free shipping discount. Reauthorize the app with read_discounts and write_discounts, then save again.",
    };
  }

  if (isExistingDiscountLookupError(detail)) {
    return {
      form: `${prefix}. The linked Shopify free shipping discount could not be found or is not a free shipping discount. ${detail}`,
      freeShippingExistingDiscount: detail,
    };
  }

  if (isFreeShippingDiscountError(detail, options.values)) {
    return {
      form: `${prefix}. Free shipping automatic discount could not be configured. ${detail}`,
      freeShippingAutoDiscount: detail,
    };
  }

  return {
    form: `${prefix}. ${detail || "The server returned an unknown error."}`,
  };
}

function parseScopes(scope: string | null | undefined) {
  return new Set(
    String(scope ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function sanitizeErrorMessage(message: string) {
  return message
    .replace(/shpat_[A-Za-z0-9_]+/g, "[redacted Shopify token]")
    .replace(/shpss_[A-Za-z0-9_]+/g, "[redacted Shopify secret]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted API key]")
    .trim();
}

function isDiscountPermissionError(message: string) {
  return /read_discounts|write_discounts|scope|access|permission|denied/i.test(
    message,
  );
}

function isExistingDiscountLookupError(message: string) {
  return /existing Shopify free shipping discount|not found|Link an existing Shopify free shipping discount/i.test(
    message,
  );
}

function isFreeShippingDiscountError(
  message: string,
  values: CampaignFormValues,
) {
  if (
    values.freeShippingAutoDiscount &&
    (values.type === "FREE_SHIPPING_GOAL" || values.goal === "FREE_SHIPPING")
  ) {
    return true;
  }

  return /free shipping|DiscountAutomaticFreeShipping|discountAutomaticFreeShipping|minimumRequirement|destination/i.test(
    message,
  );
}
