import type { Stage2RuleStatus } from "@prisma/client";

export type BadgeProductContext = {
  productId?: string;
  productTags?: string[];
  collectionIds?: string[];
  vendor?: string;
  inventoryQuantity?: number | null;
  discountActive?: boolean;
  price?: number | null;
  compareAtPrice?: number | null;
  metafields?: Record<string, string>;
  market?: string;
  country?: string;
  locale?: string;
};

export type AdvancedBadgeRuleInput = {
  id: string;
  campaignId: string;
  priority: number;
  status: Stage2RuleStatus | string;
  conditions: unknown;
  design: unknown;
};

export type BadgeRuleConditions = {
  productTags?: string[];
  collectionIds?: string[];
  vendors?: string[];
  inventoryBelow?: number | null;
  inventoryAbove?: number | null;
  discountActive?: boolean | null;
  compareAtPriceRequired?: boolean;
  metafields?: Array<{
    namespace?: string;
    key?: string;
    value?: string;
  }>;
  markets?: string[];
  countries?: string[];
  locales?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
};

export type BadgeRuleDesign = {
  text?: string;
  textByLocale?: Record<string, string>;
  shape?: string;
  position?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  fontSize?: number;
  borderRadius?: number;
  url?: string;
};

export type EvaluatedBadge = {
  id: string;
  campaignId: string;
  priority: number;
  text: string;
  design: BadgeRuleDesign;
};

export function evaluateBadgeRules(
  productContext: BadgeProductContext,
  rules: AdvancedBadgeRuleInput[],
  options: { now?: Date; defaultText?: string } = {},
) {
  const now = options.now ?? new Date();
  const defaultText = options.defaultText ?? "Limited offer";

  return sortBadgesByPriority(
    rules
      .filter((rule) => rule.status === "ACTIVE")
      .filter((rule) =>
        matchesBadgeRuleConditions(
          productContext,
          readConditions(rule.conditions),
          now,
        ),
      )
      .map((rule) => {
        const design = readDesign(rule.design);
        const text = resolveBadgeText(design, productContext.locale);

        return {
          id: rule.id,
          campaignId: rule.campaignId,
          priority: normalizePriority(rule.priority),
          text: text || defaultText,
          design,
        };
      }),
  );
}

export function sortBadgesByPriority(badges: EvaluatedBadge[]) {
  const seen = new Set<string>();
  const sorted = [...badges].sort((first, second) => {
    if (second.priority !== first.priority) {
      return second.priority - first.priority;
    }

    return first.id.localeCompare(second.id);
  });

  return sorted.filter((badge) => {
    const key = [
      badge.campaignId,
      badge.text.trim().toLowerCase(),
      normalizeString(badge.design.position),
    ].join(":");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function matchesBadgeRuleConditions(
  productContext: BadgeProductContext,
  conditions: BadgeRuleConditions,
  now = new Date(),
) {
  if (!isWithinSchedule(conditions, now)) return false;

  if (
    !matchesOptionalIntersection(
      conditions.productTags,
      productContext.productTags,
    )
  ) {
    return false;
  }

  if (
    !matchesOptionalIntersection(
      conditions.collectionIds,
      productContext.collectionIds,
    )
  ) {
    return false;
  }

  if (!matchesOptionalExactList(conditions.vendors, productContext.vendor)) {
    return false;
  }

  if (!matchesInventory(conditions, productContext.inventoryQuantity)) {
    return false;
  }

  if (
    typeof conditions.discountActive === "boolean" &&
    productContext.discountActive !== conditions.discountActive
  ) {
    return false;
  }

  if (
    conditions.compareAtPriceRequired &&
    !hasCompareAtPriceDiscount(productContext)
  ) {
    return false;
  }

  if (!matchesMetafields(conditions.metafields, productContext.metafields)) {
    return false;
  }

  if (!matchesOptionalExactList(conditions.markets, productContext.market)) {
    return false;
  }

  if (!matchesOptionalExactList(conditions.countries, productContext.country)) {
    return false;
  }

  if (!matchesOptionalLocaleList(conditions.locales, productContext.locale)) {
    return false;
  }

  return true;
}

export function readConditions(value: unknown): BadgeRuleConditions {
  const input = readObject(value);

  return {
    productTags: readStringList(input.productTags),
    collectionIds: readStringList(input.collectionIds),
    vendors: readStringList(input.vendors ?? input.vendor),
    inventoryBelow: readNullableNumber(input.inventoryBelow),
    inventoryAbove: readNullableNumber(input.inventoryAbove),
    discountActive: readNullableBoolean(input.discountActive),
    compareAtPriceRequired: readBoolean(input.compareAtPriceRequired),
    metafields: readMetafieldConditions(input.metafields),
    markets: readStringList(input.markets),
    countries: readStringList(input.countries).map((country) =>
      country.toUpperCase(),
    ),
    locales: readStringList(input.locales),
    startsAt: readNullableString(input.startsAt),
    endsAt: readNullableString(input.endsAt),
  };
}

export function readDesign(value: unknown): BadgeRuleDesign {
  const input = readObject(value);

  return {
    text: readNullableString(input.text) ?? undefined,
    textByLocale: readTextByLocale(input.textByLocale),
    shape: readNullableString(input.shape) ?? undefined,
    position: readNullableString(input.position) ?? undefined,
    backgroundColor: readHexColor(input.backgroundColor),
    textColor: readHexColor(input.textColor),
    accentColor: readHexColor(input.accentColor),
    fontSize: readNullableNumber(input.fontSize) ?? undefined,
    borderRadius: readNullableNumber(input.borderRadius) ?? undefined,
    url: readSafeUrl(input.url),
  };
}

function resolveBadgeText(design: BadgeRuleDesign, locale: string | undefined) {
  const normalizedLocale = normalizeLocale(locale);
  const language = normalizedLocale.split("-")[0];
  const textByLocale = design.textByLocale ?? {};

  return (
    readNullableString(textByLocale[normalizedLocale]) ||
    readNullableString(textByLocale[language]) ||
    readNullableString(textByLocale.en) ||
    readNullableString(design.text) ||
    ""
  );
}

function isWithinSchedule(conditions: BadgeRuleConditions, now: Date) {
  const startsAt = parseDate(conditions.startsAt);
  const endsAt = parseDate(conditions.endsAt);

  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;

  return true;
}

function matchesInventory(
  conditions: Pick<BadgeRuleConditions, "inventoryAbove" | "inventoryBelow">,
  inventoryQuantity: number | null | undefined,
) {
  if (conditions.inventoryBelow == null && conditions.inventoryAbove == null) {
    return true;
  }

  if (inventoryQuantity == null || !Number.isFinite(inventoryQuantity)) {
    return false;
  }

  if (
    conditions.inventoryBelow != null &&
    inventoryQuantity >= conditions.inventoryBelow
  ) {
    return false;
  }

  if (
    conditions.inventoryAbove != null &&
    inventoryQuantity <= conditions.inventoryAbove
  ) {
    return false;
  }

  return true;
}

function hasCompareAtPriceDiscount(productContext: BadgeProductContext) {
  const price = productContext.price;
  const compareAtPrice = productContext.compareAtPrice;

  return (
    price != null &&
    compareAtPrice != null &&
    Number.isFinite(price) &&
    Number.isFinite(compareAtPrice) &&
    compareAtPrice > price
  );
}

function matchesMetafields(
  conditions: BadgeRuleConditions["metafields"],
  metafields: Record<string, string> | undefined,
) {
  if (!conditions || conditions.length === 0) return true;
  if (!metafields) return false;

  return conditions.every((condition) => {
    const key = [condition.namespace, condition.key].filter(Boolean).join(".");
    const expected = normalizeString(condition.value);
    const actual = normalizeString(metafields[key]);

    if (!key || !actual) return false;

    return expected ? actual === expected : true;
  });
}

function matchesOptionalIntersection(
  expected: string[] | undefined,
  actual: string[] | undefined,
) {
  if (!expected || expected.length === 0) return true;

  const actualSet = new Set((actual ?? []).map(normalizeString));

  return expected.some((value) => actualSet.has(normalizeString(value)));
}

function matchesOptionalExactList(
  expected: string[] | undefined,
  actual: string | undefined,
) {
  if (!expected || expected.length === 0) return true;
  if (!actual) return false;

  const normalizedActual = normalizeString(actual);

  return expected.some((value) => normalizeString(value) === normalizedActual);
}

function matchesOptionalLocaleList(
  expected: string[] | undefined,
  actual: string | undefined,
) {
  if (!expected || expected.length === 0) return true;
  if (!actual) return false;

  const normalizedActual = normalizeLocale(actual);
  const language = normalizedActual.split("-")[0];

  return expected.some((value) => {
    const normalizedValue = normalizeLocale(value);

    return normalizedValue === normalizedActual || normalizedValue === language;
  });
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function readMetafieldConditions(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => readObject(item))
    .map((item) => ({
      namespace: readNullableString(item.namespace) ?? "",
      key: readNullableString(item.key) ?? "",
      value: readNullableString(item.value) ?? undefined,
    }))
    .filter((item) => item.namespace && item.key);
}

function readTextByLocale(value: unknown) {
  const input = readObject(value);
  const output: Record<string, string> = {};

  Object.entries(input).forEach(([locale, text]) => {
    const normalizedLocale = normalizeLocale(locale);
    const value = readNullableString(text);

    if (normalizedLocale && value) {
      output[normalizedLocale] = value;
    }
  });

  return output;
}

function readHexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : undefined;
}

function readSafeUrl(value: unknown) {
  const text = readNullableString(value);
  if (!text) return undefined;

  return text.startsWith("/") || /^https?:\/\//i.test(text) ? text : undefined;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function readNullableNumber(value: unknown) {
  if (value == null || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function readNullableBoolean(value: unknown) {
  if (value == null || value === "") return null;
  return readBoolean(value);
}

function readBoolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLocale(value: string | undefined) {
  return normalizeString(value).replace("_", "-");
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePriority(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? Math.trunc(number) : 0;
}
