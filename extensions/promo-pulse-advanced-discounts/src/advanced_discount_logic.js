const activeStatus = "ACTIVE";

const ruleTypes = new Set([
  "SPEND_X_GET_Y",
  "TIERED_DISCOUNT",
  "FREE_GIFT",
  "PRODUCT_SHIPPING_COMBO",
  "CART_CONTENTS",
]);

export function calculateCartLineDiscountOperations(input) {
  const config = readFunctionConfig(input);
  const lines = Array.isArray(input?.cart?.lines) ? input.cart.lines : [];
  const discountClasses = input?.discount?.discountClasses ?? [];

  if (!config || lines.length === 0) {
    return { operations: [] };
  }

  const subtotal = getCartSubtotal(input.cart);
  const productDiscount = buildProductDiscountCandidate(
    config,
    lines,
    subtotal,
  );
  const orderDiscount = buildOrderDiscountCandidate(config, lines, subtotal);
  const operations = [];

  if (orderDiscount && discountClasses.includes("ORDER")) {
    operations.push({
      orderDiscountsAdd: {
        candidates: [orderDiscount],
        selectionStrategy: "FIRST",
      },
    });
  }

  if (productDiscount && discountClasses.includes("PRODUCT")) {
    operations.push({
      productDiscountsAdd: {
        candidates: [productDiscount],
        selectionStrategy: "FIRST",
      },
    });
  }

  return { operations };
}

export function calculateDeliveryDiscountOperations(input) {
  const config = readFunctionConfig(input);
  const discountClasses = input?.discount?.discountClasses ?? [];
  const deliveryGroups = Array.isArray(input?.cart?.deliveryGroups)
    ? input.cart.deliveryGroups
    : [];

  if (
    !config ||
    deliveryGroups.length === 0 ||
    !discountClasses.includes("SHIPPING") ||
    !config.shippingDiscountValue
  ) {
    return { operations: [] };
  }

  const subtotal = getCartSubtotal(input.cart);
  const lines = Array.isArray(input?.cart?.lines) ? input.cart.lines : [];

  if (!meetsSubtotalThreshold(config, subtotal)) {
    return { operations: [] };
  }

  if (
    hasProductOrCollectionFilters(config) &&
    getEligibleLines(config, lines).length === 0
  ) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: [
            {
              message: config.title,
              targets: deliveryGroups.map((deliveryGroup) => ({
                deliveryGroup: { id: deliveryGroup.id },
              })),
              value: buildDiscountValue(config.shippingDiscountValue),
            },
          ],
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}

export function readFunctionConfig(input) {
  const rawMetafield =
    input?.discount?.metafield ??
    input?.discountNode?.metafield ??
    input?.discountNode?.discount?.metafield ??
    null;
  const rawValue = rawMetafield?.jsonValue ?? rawMetafield?.value ?? null;
  const parsed = parseJsonConfig(rawValue);

  return normalizeAdvancedDiscountConfig(parsed);
}

export function normalizeAdvancedDiscountConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const ruleType = readString(value.ruleType);
  const status = readString(value.status) || activeStatus;

  if (!ruleTypes.has(ruleType) || status !== activeStatus) {
    return null;
  }

  const discountValue = normalizeDiscountValue(
    value.discountValue,
    value.discountValueType,
  );
  const shippingDiscountValue = normalizeDiscountValue(
    value.shippingDiscountValue,
    value.shippingDiscountValueType,
  );

  return {
    campaignId: readString(value.campaignId),
    collectionIds: normalizeIdList(value.collectionIds),
    discountValue,
    productIds: normalizeIdList(value.productIds),
    ruleType,
    shippingDiscountValue,
    status,
    thresholds: normalizeThresholds(value.thresholds),
    title: readString(value.title) || "Promo Pulse advanced discount",
  };
}

function buildOrderDiscountCandidate(config, lines, subtotal) {
  if (
    config.ruleType !== "SPEND_X_GET_Y" &&
    config.ruleType !== "TIERED_DISCOUNT"
  ) {
    return null;
  }

  if (hasProductOrCollectionFilters(config)) {
    return null;
  }

  const threshold = selectThreshold(config, subtotal);
  const discountValue = threshold?.discountValue ?? config.discountValue;

  if (!threshold || !discountValue || lines.length === 0) {
    return null;
  }

  return {
    message: config.title,
    targets: [
      {
        orderSubtotal: {
          excludedCartLineIds: [],
        },
      },
    ],
    value: buildDiscountValue(discountValue),
  };
}

function buildProductDiscountCandidate(config, lines, subtotal) {
  if (config.ruleType === "FREE_GIFT") {
    const threshold = selectThreshold(config, subtotal);
    const eligibleLines = getEligibleLines(config, lines);

    if (!threshold || eligibleLines.length === 0) {
      return null;
    }

    return {
      message: config.title || "Promo Pulse free gift",
      targets: eligibleLines.map((line) => ({ cartLine: { id: line.id } })),
      value: { percentage: { value: 100 } },
    };
  }

  if (config.ruleType === "CART_CONTENTS") {
    const eligibleLines = getEligibleLines(config, lines);

    if (eligibleLines.length === 0 || !config.discountValue) {
      return null;
    }

    return {
      message: config.title,
      targets: eligibleLines.map((line) => ({ cartLine: { id: line.id } })),
      value: buildDiscountValue(config.discountValue),
    };
  }

  if (config.ruleType === "PRODUCT_SHIPPING_COMBO") {
    const threshold = selectThreshold(config, subtotal);
    const eligibleLines = getEligibleLines(config, lines);

    if (!threshold || eligibleLines.length === 0 || !config.discountValue) {
      return null;
    }

    return {
      message: config.title,
      targets: eligibleLines.map((line) => ({ cartLine: { id: line.id } })),
      value: buildDiscountValue(config.discountValue),
    };
  }

  if (
    config.ruleType !== "SPEND_X_GET_Y" &&
    config.ruleType !== "TIERED_DISCOUNT"
  ) {
    return null;
  }

  if (!hasProductOrCollectionFilters(config)) {
    return null;
  }

  const threshold = selectThreshold(config, subtotal);
  const discountValue = threshold?.discountValue ?? config.discountValue;
  const eligibleLines = getEligibleLines(config, lines);

  if (!threshold || !discountValue || eligibleLines.length === 0) {
    return null;
  }

  return {
    message: config.title,
    targets: eligibleLines.map((line) => ({ cartLine: { id: line.id } })),
    value: buildDiscountValue(discountValue),
  };
}

function selectThreshold(config, subtotal) {
  if (config.thresholds.length === 0) {
    return { minimumSubtotal: 0, discountValue: config.discountValue };
  }

  const qualified = config.thresholds
    .filter((threshold) => subtotal >= threshold.minimumSubtotal)
    .sort((left, right) => right.minimumSubtotal - left.minimumSubtotal);

  return qualified[0] ?? null;
}

function meetsSubtotalThreshold(config, subtotal) {
  return Boolean(selectThreshold(config, subtotal));
}

function getEligibleLines(config, lines) {
  if (!hasProductOrCollectionFilters(config)) return lines;

  return lines.filter((line) => {
    const variantId = readString(line?.merchandise?.id);
    const productId = readString(line?.merchandise?.product?.id);
    const lineCollectionIds = [
      ...normalizeIdList(line?.collectionIds),
      ...normalizeIdList(line?.merchandise?.collectionIds),
      ...normalizeIdList(line?.merchandise?.product?.collectionIds),
    ];

    return (
      config.productIds.includes(variantId) ||
      config.productIds.includes(productId) ||
      config.collectionIds.some((collectionId) =>
        lineCollectionIds.includes(collectionId),
      )
    );
  });
}

function hasProductOrCollectionFilters(config) {
  return config.productIds.length > 0 || config.collectionIds.length > 0;
}

function buildDiscountValue(discountValue) {
  if (discountValue.type === "FIXED_AMOUNT") {
    return {
      fixedAmount: {
        amount: discountValue.value,
        appliesToEachItem: false,
      },
    };
  }

  return {
    percentage: {
      value: discountValue.value,
    },
  };
}

function getCartSubtotal(cart) {
  const cartSubtotal = readNumber(cart?.cost?.subtotalAmount?.amount);

  if (cartSubtotal !== null) return cartSubtotal;

  return (cart?.lines ?? []).reduce(
    (total, line) =>
      total + (readNumber(line?.cost?.subtotalAmount?.amount) ?? 0),
    0,
  );
}

function normalizeThresholds(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((threshold) => {
      if (typeof threshold === "number" || typeof threshold === "string") {
        const minimumSubtotal = readNumber(threshold);

        return minimumSubtotal === null
          ? null
          : { minimumSubtotal, discountValue: null };
      }

      if (!threshold || typeof threshold !== "object") return null;

      const minimumSubtotal =
        readNumber(threshold.minimumSubtotal) ??
        readNumber(threshold.subtotal) ??
        readNumber(threshold.amount);
      const discountValue = normalizeDiscountValue(
        threshold.discountValue ?? threshold.value,
        threshold.discountValueType,
      );

      if (minimumSubtotal === null || minimumSubtotal < 0) return null;

      return {
        minimumSubtotal,
        discountValue,
      };
    })
    .filter(Boolean);
}

function normalizeDiscountValue(value, valueType) {
  const type =
    readString(value?.type) ||
    readString(value?.valueType) ||
    readString(valueType) ||
    "PERCENTAGE";
  const amount =
    readNumber(value?.value) ??
    readNumber(value?.amount) ??
    readNumber(value?.percentage) ??
    readNumber(value);

  if (amount === null || amount <= 0) return null;

  if (type === "FIXED_AMOUNT") {
    return { type, value: amount };
  }

  return {
    type: "PERCENTAGE",
    value: Math.min(amount, 100),
  };
}

function normalizeIdList(value) {
  if (Array.isArray(value)) {
    return value.map(readString).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseJsonConfig(value) {
  if (!value) return null;

  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function readNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}
