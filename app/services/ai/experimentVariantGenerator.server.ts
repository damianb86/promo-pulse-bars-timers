import {
  campaignDesignTemplates,
  defaultCampaignDesignValues,
  designBackgroundTypeOptions,
  designBannerAnimationOptions,
  designFontFamilyOptions,
  designLayoutOptions,
  designTimerFormatOptions,
  designTimerStyleOptions,
  designTimerTickAnimationOptions,
  type CampaignDesignValues,
} from "../../types/campaign-design";
import {
  placementTypeOptions,
  type PlacementTypeValue,
} from "../../types/campaign-options";

export type ExperimentVariantAiStrategy =
  | "urgency"
  | "benefit"
  | "trust"
  | "gentle"
  | "premium"
  | "visual";

export type ExperimentVariantAiDesignIntensity =
  | "copy_only"
  | "balanced"
  | "bold";

export type ExperimentVariantAiPlacementIntent =
  | "inherit"
  | "engagement"
  | "product"
  | "cart";

export type ExperimentVariantAiText = {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  expiredText: string;
  freeShippingEmptyText: string;
  freeShippingProgressText: string;
  freeShippingSuccessText: string;
  deliveryBeforeCutoffText: string;
  deliveryAfterCutoffText: string;
  lowStockText: string;
  badgeText: string;
};

export type ExperimentVariantAiPlacement = {
  placementType: PlacementTypeValue | "";
  customSelector: string;
};

export type ExperimentVariantAiSuggestion = {
  name: string;
  rationale: string;
  hypothesis: string;
  text: Partial<ExperimentVariantAiText>;
  design: Partial<CampaignDesignValues>;
  placement: Partial<ExperimentVariantAiPlacement>;
};

export type ExperimentVariantAiProvider = {
  source: "mock" | "provider";
  generate(
    input: ExperimentVariantAiInput,
  ): Promise<Partial<ExperimentVariantAiSuggestion>>;
};

export type ExperimentVariantAiInput = {
  strategy: ExperimentVariantAiStrategy;
  designIntensity: ExperimentVariantAiDesignIntensity;
  placementIntent: ExperimentVariantAiPlacementIntent;
  notes: string;
  campaign: {
    name: string;
    type: string;
    goal: string;
    status: string;
    placements: string[];
    basePlacement: string;
    text: ExperimentVariantAiText;
    design: CampaignDesignValues;
  };
  existingVariants: Array<{
    name: string;
    weight: number;
    text: Partial<ExperimentVariantAiText>;
    design: Partial<CampaignDesignValues>;
    placement: Partial<ExperimentVariantAiPlacement>;
  }>;
};

export type ParsedExperimentVariantAiForm = {
  errors: { form?: string };
  input: ExperimentVariantAiInput;
};

type ExperimentVariantAiGenerationOptions = {
  provider?: ExperimentVariantAiProvider;
};

const strategyValues: ExperimentVariantAiStrategy[] = [
  "urgency",
  "benefit",
  "trust",
  "gentle",
  "premium",
  "visual",
];
const designIntensityValues: ExperimentVariantAiDesignIntensity[] = [
  "copy_only",
  "balanced",
  "bold",
];
const placementIntentValues: ExperimentVariantAiPlacementIntent[] = [
  "inherit",
  "engagement",
  "product",
  "cart",
];
const textKeys: Array<keyof ExperimentVariantAiText> = [
  "headline",
  "subheadline",
  "ctaText",
  "ctaUrl",
  "expiredText",
  "freeShippingEmptyText",
  "freeShippingProgressText",
  "freeShippingSuccessText",
  "deliveryBeforeCutoffText",
  "deliveryAfterCutoffText",
  "lowStockText",
  "badgeText",
];
const colorKeys: Array<keyof CampaignDesignValues> = [
  "backgroundColor",
  "gradientStartColor",
  "gradientEndColor",
  "textColor",
  "accentColor",
  "buttonColor",
  "buttonTextColor",
  "closeButtonColor",
  "borderColor",
  "titleColor",
  "subheadingColor",
  "timerColor",
  "legendColor",
  "timerSurfaceColor",
  "timerSurfaceBorderColor",
];
const numberLimits: Partial<
  Record<keyof CampaignDesignValues, { min: number; max: number }>
> = {
  gradientAngle: { min: 0, max: 360 },
  fontSize: { min: 10, max: 22 },
  titleFontSize: { min: 12, max: 42 },
  subheadingFontSize: { min: 10, max: 24 },
  timerFontSize: { min: 12, max: 64 },
  legendFontSize: { min: 9, max: 18 },
  borderRadius: { min: 0, max: 32 },
  borderSize: { min: 0, max: 8 },
  timerSurfaceBorderSize: { min: 0, max: 6 },
  timerSurfaceRadius: { min: 0, max: 28 },
  paddingBlock: { min: 4, max: 48 },
  paddingInline: { min: 8, max: 64 },
  contentGap: { min: 4, max: 40 },
  contentMaxWidth: { min: 320, max: 1440 },
  animationDurationMs: { min: 80, max: 1200 },
  iconSize: { min: 12, max: 48 },
};
const booleanDesignKeys: Array<keyof CampaignDesignValues> = [
  "timerShowLabels",
  "timerShowSeconds",
  "timerHideZeroDays",
  "fullWidth",
  "positionSticky",
  "showCloseButton",
  "showButton",
  "showProgressBar",
  "showIcon",
  "mobileEnabled",
];
const stringDesignKeys: Array<keyof CampaignDesignValues> = [
  "backgroundImageUrl",
  "timerDaysLabel",
  "timerHoursLabel",
  "timerMinutesLabel",
  "timerSecondsLabel",
  "customCss",
  "customIconUrl",
];

const templateKeys = campaignDesignTemplates.map(
  (template) => template.templateKey,
);
const placementValues = placementTypeOptions.map((option) => option.value);
const designEnums = {
  layout: designLayoutOptions.map((option) => option.value),
  backgroundType: designBackgroundTypeOptions.map((option) => option.value),
  fontFamily: designFontFamilyOptions.map((option) => option.value),
  timerStyle: designTimerStyleOptions.map((option) => option.value),
  timerFormat: designTimerFormatOptions.map((option) => option.value),
  entranceAnimation: designBannerAnimationOptions.map((option) => option.value),
  exitAnimation: designBannerAnimationOptions.map((option) => option.value),
  timerTickAnimation: designTimerTickAnimationOptions.map(
    (option) => option.value,
  ),
  alignment: ["LEFT", "CENTER", "RIGHT"],
  positionMode: ["FLOW", "OVERLAY"],
  icon: ["FIRE", "CLOCK", "TRUCK", "GIFT", "TAG", "CUSTOM", "NONE"],
} as const;

export function parseExperimentVariantAiFormData(
  formData: FormData,
): ParsedExperimentVariantAiForm {
  const campaign = readJsonRecord(formData.get("campaignJson"));
  const existingVariants = readJsonArray(formData.get("variantsJson"));
  const campaignText = readTextRecord(campaign.text);
  const campaignDesign = sanitizeDesignRecord(
    readRecord(campaign.design),
    defaultCampaignDesignValues,
  );
  const input: ExperimentVariantAiInput = {
    strategy: readEnum(
      formData.get("strategy"),
      strategyValues,
      "benefit",
    ),
    designIntensity: readEnum(
      formData.get("designIntensity"),
      designIntensityValues,
      "balanced",
    ),
    placementIntent: readEnum(
      formData.get("placementIntent"),
      placementIntentValues,
      "inherit",
    ),
    notes: readString(formData.get("notes")).slice(0, 800),
    campaign: {
      name: readString(campaign.name).slice(0, 120),
      type: readString(campaign.type).slice(0, 80),
      goal: readString(campaign.goal).slice(0, 80),
      status: readString(campaign.status).slice(0, 80),
      placements: readStringArray(campaign.placements).slice(0, 12),
      basePlacement: readString(campaign.basePlacement).slice(0, 80),
      text: campaignText,
      design: campaignDesign,
    },
    existingVariants: existingVariants.slice(0, 20).map((variant) => {
      const record = readRecord(variant);

      return {
        name: readString(record.name).slice(0, 120),
        weight: clampNumber(record.weight, 0, 100, 0),
        text: readPartialTextRecord(record.text),
        design: sanitizePartialDesignRecord(
          readRecord(record.design),
          campaignDesign,
        ),
        placement: sanitizePlacementRecord(readRecord(record.placement)),
      };
    }),
  };
  const hasBaseCopy = textKeys.some((key) => input.campaign.text[key].trim());

  return {
    errors: hasBaseCopy
      ? {}
      : {
          form: "Add campaign copy before generating an AI variant.",
        },
    input,
  };
}

export async function generateExperimentVariantSuggestion(
  input: ExperimentVariantAiInput,
  options: ExperimentVariantAiGenerationOptions = {},
): Promise<{
  source: ExperimentVariantAiProvider["source"];
  variant: ExperimentVariantAiSuggestion;
}> {
  const provider = options.provider ?? getDefaultExperimentVariantAiProvider();
  const output = await provider.generate(input);

  return {
    source: provider.source,
    variant: sanitizeVariantSuggestion(input, output),
  };
}

export function createMockExperimentVariantAiProvider(): ExperimentVariantAiProvider {
  return {
    source: "mock",
    async generate(input) {
      return buildMockSuggestion(input);
    },
  };
}

function getDefaultExperimentVariantAiProvider(): ExperimentVariantAiProvider {
  if (
    process.env.E2E_TEST_MODE === "true" ||
    process.env.PROMO_PULSE_AI_PROVIDER !== "openai" ||
    !process.env.OPENAI_API_KEY
  ) {
    return createMockExperimentVariantAiProvider();
  }

  return createOpenAiExperimentVariantProvider(process.env.OPENAI_API_KEY);
}

function createOpenAiExperimentVariantProvider(
  apiKey: string,
): ExperimentVariantAiProvider {
  return {
    source: "provider",
    async generate(input) {
      return requestOpenAiVariantJson(apiKey, input);
    },
  };
}

async function requestOpenAiVariantJson(
  apiKey: string,
  input: ExperimentVariantAiInput,
): Promise<Partial<ExperimentVariantAiSuggestion>> {
  const responsesUrl =
    process.env.OPENAI_RESPONSES_URL?.trim() ||
    "https://api.openai.com/v1/responses";

  const response = await fetch(responsesUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VARIANT_MODEL ?? "gpt-5.4-nano",
      input: [
        {
          role: "system",
          content:
            "You are an ecommerce CRO strategist. Generate one A/B test variant for a Promo Pulse campaign. Return only valid JSON.",
        },
        {
          role: "user",
          content: buildVariantPrompt(input),
        },
      ],
      text: {
        format: { type: "json_object" },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI variant provider returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ text?: string; type?: string }>;
    }>;
  };
  const text =
    payload.output_text ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n");

  if (!text) {
    throw new Error("OpenAI variant provider returned no JSON text.");
  }

  const parsed = JSON.parse(text) as {
    variant?: Partial<ExperimentVariantAiSuggestion>;
  };

  if (!parsed.variant || typeof parsed.variant !== "object") {
    throw new Error(
      "OpenAI variant provider returned an unsupported JSON shape.",
    );
  }

  return parsed.variant;
}

function buildVariantPrompt(input: ExperimentVariantAiInput) {
  return [
    "Create exactly one new experiment variant.",
    "Allowed changes: message copy, CTA text, CTA URL, placement override, layout, preset/templateKey, images, colors, typography, timer style, behavior, motion, icon, and other design values.",
    "Forbidden changes: offers, discounts, coupon rules, targeting, markets, schedule, products, or audience rules. Inherit those from the base campaign.",
    "Keep all claims realistic. Do not invent reviews, stock counts, guarantees, discount amounts, or deadlines that are not in the provided campaign text.",
    "Use United States English for any English copy.",
    "Make the variant meaningfully different from existing variants and include a test hypothesis.",
    'Return this exact JSON shape: {"variant":{"name":"Variant B - ...","rationale":"...","hypothesis":"...","text":{"headline":"..."},"design":{"layout":"BALANCED"},"placement":{"placementType":"","customSelector":""}}}.',
    "",
    `Requested strategy: ${input.strategy}`,
    `Design intensity: ${input.designIntensity}`,
    `Placement intent: ${input.placementIntent}`,
    `Merchant notes: ${input.notes || "None"}`,
    "",
    "Campaign JSON:",
    JSON.stringify(input.campaign, null, 2),
    "",
    "Existing variants JSON:",
    JSON.stringify(input.existingVariants, null, 2),
    "",
    "Allowed placementType values:",
    JSON.stringify(["", ...placementValues]),
    "Allowed design enum values:",
    JSON.stringify(designEnums),
    "Allowed templateKey values:",
    JSON.stringify(templateKeys),
  ].join("\n");
}

function sanitizeVariantSuggestion(
  input: ExperimentVariantAiInput,
  output: Partial<ExperimentVariantAiSuggestion>,
): ExperimentVariantAiSuggestion {
  const fallback = buildMockSuggestion(input);
  const text = sanitizeTextRecord(output.text, input.campaign.text);
  const design =
    input.designIntensity === "copy_only"
      ? {}
      : sanitizePartialDesignRecord(
          readRecord(output.design),
          input.campaign.design,
        );

  return {
    name: sanitizeLabel(output.name, fallback.name, 64),
    rationale: sanitizeLabel(output.rationale, fallback.rationale, 360),
    hypothesis: sanitizeLabel(output.hypothesis, fallback.hypothesis, 360),
    text,
    design,
    placement: sanitizePlacementRecord(readRecord(output.placement)),
  };
}

function buildMockSuggestion(
  input: ExperimentVariantAiInput,
): ExperimentVariantAiSuggestion {
  const base = input.campaign.text;
  const nextLetter = String.fromCharCode(
    "A".charCodeAt(0) + input.existingVariants.length,
  );
  const strategy = getStrategyMock(input.strategy, base);
  const design =
    input.designIntensity === "copy_only"
      ? {}
      : input.designIntensity === "bold"
        ? strategy.boldDesign
        : strategy.design;
  const placement = getPlacementForIntent(input.placementIntent);

  return {
    name: `Variant ${nextLetter} - ${strategy.label}`,
    rationale: strategy.rationale,
    hypothesis: strategy.hypothesis,
    text: strategy.text,
    design,
    placement,
  };
}

function getStrategyMock(
  strategy: ExperimentVariantAiStrategy,
  base: ExperimentVariantAiText,
) {
  const baseHeadline = base.headline || "Limited-time offer";
  const baseSubheadline = base.subheadline || "Available for a short time.";
  const baseCta = base.ctaText || "Shop now";
  const ctaUrl = base.ctaUrl || "/collections/all";

  if (strategy === "urgency") {
    return {
      label: "Urgency push",
      rationale:
        "Sharper deadline language and higher contrast should pull attention toward immediate action.",
      hypothesis:
        "If shoppers see a clearer time-sensitive reason to act, CTR and add-to-cart rate should increase.",
      text: {
        headline: `Last chance: ${baseHeadline}`,
        subheadline: baseSubheadline,
        ctaText: "Shop before it ends",
        ctaUrl,
      },
      design: {
        templateKey: "flash-sale",
        layout: "BALANCED",
        backgroundType: "GRADIENT",
        gradientStartColor: "#7F1D1D",
        gradientEndColor: "#DC2626",
        buttonColor: "#FFFFFF",
        buttonTextColor: "#7F1D1D",
        titleColor: "#FFFFFF",
        subheadingColor: "#FEE2E2",
        timerStyle: "BOXES",
        timerTickAnimation: "PULSE",
        showIcon: true,
        icon: "FIRE",
      },
      boldDesign: {
        templateKey: "flash-sale",
        layout: "CTA_RIGHT",
        backgroundType: "GRADIENT",
        gradientStartColor: "#450A0A",
        gradientEndColor: "#EF4444",
        gradientAngle: 135,
        titleFontSize: 28,
        timerFontSize: 42,
        buttonColor: "#FEF3C7",
        buttonTextColor: "#7F1D1D",
        titleColor: "#FFFFFF",
        subheadingColor: "#FEE2E2",
        timerStyle: "BOXES",
        timerTickAnimation: "PULSE",
        positionSticky: true,
        showIcon: true,
        icon: "FIRE",
      },
    };
  }

  if (strategy === "trust") {
    return {
      label: "Trust proof",
      rationale:
        "A calmer proof-led message reduces hesitation while keeping the same offer and CTA destination.",
      hypothesis:
        "If the variant emphasizes confidence before urgency, qualified clicks should convert better downstream.",
      text: {
        headline: `Trusted choice: ${baseHeadline}`,
        subheadline: "Clear savings with no extra steps.",
        ctaText: baseCta,
        ctaUrl,
      },
      design: {
        templateKey: "clean-minimal",
        layout: "STANDARD",
        backgroundType: "SOLID",
        backgroundColor: "#F8FAFC",
        titleColor: "#0F172A",
        subheadingColor: "#475569",
        buttonColor: "#0F766E",
        buttonTextColor: "#FFFFFF",
        borderColor: "#CCFBF1",
        borderSize: 1,
        showIcon: true,
        icon: "TAG",
      },
      boldDesign: {
        templateKey: "free-shipping",
        layout: "BALANCED",
        backgroundType: "GRADIENT",
        gradientStartColor: "#ECFDF5",
        gradientEndColor: "#DBEAFE",
        gradientAngle: 120,
        titleColor: "#064E3B",
        subheadingColor: "#1E40AF",
        buttonColor: "#047857",
        buttonTextColor: "#FFFFFF",
        borderRadius: 12,
        timerStyle: "GROUPED",
        showIcon: true,
        icon: "TAG",
      },
    };
  }

  if (strategy === "gentle") {
    return {
      label: "Soft reminder",
      rationale:
        "Lower-pressure language can appeal to shoppers who resist aggressive urgency.",
      hypothesis:
        "If the campaign feels helpful instead of forceful, engagement should improve without increasing bounce.",
      text: {
        headline: `A quick reminder: ${baseHeadline}`,
        subheadline: baseSubheadline,
        ctaText: "Take a look",
        ctaUrl,
      },
      design: {
        templateKey: "dawn",
        layout: "STANDARD",
        backgroundType: "GRADIENT",
        gradientStartColor: "#ECFEFF",
        gradientEndColor: "#F5F3FF",
        gradientAngle: 135,
        titleColor: "#164E63",
        subheadingColor: "#475569",
        buttonColor: "#0E7490",
        buttonTextColor: "#FFFFFF",
        timerStyle: "PLAIN",
        showIcon: false,
        icon: "NONE",
      },
      boldDesign: {
        templateKey: "dawn",
        layout: "INLINE",
        backgroundType: "GRADIENT",
        gradientStartColor: "#CFFAFE",
        gradientEndColor: "#E9D5FF",
        gradientAngle: 135,
        titleColor: "#164E63",
        subheadingColor: "#334155",
        buttonColor: "#7C3AED",
        buttonTextColor: "#FFFFFF",
        timerStyle: "PLAIN",
        entranceAnimation: "FADE",
      },
    };
  }

  if (strategy === "premium") {
    return {
      label: "Premium polish",
      rationale:
        "Refined copy and restrained styling make the promotion feel curated instead of generic.",
      hypothesis:
        "If the offer feels more premium, higher-intent shoppers should be more likely to click through.",
      text: {
        headline: `Selected for you: ${baseHeadline}`,
        subheadline: baseSubheadline,
        ctaText: "Explore the offer",
        ctaUrl,
      },
      design: {
        templateKey: "premium-dark",
        layout: "BALANCED",
        backgroundType: "GRADIENT",
        gradientStartColor: "#111827",
        gradientEndColor: "#312E81",
        titleColor: "#F9FAFB",
        subheadingColor: "#DDD6FE",
        buttonColor: "#F9FAFB",
        buttonTextColor: "#111827",
        timerStyle: "GROUPED",
        fontFamily: "SERIF",
        showIcon: true,
        icon: "GIFT",
      },
      boldDesign: {
        templateKey: "premium-dark",
        layout: "CTA_RIGHT",
        backgroundType: "GRADIENT",
        gradientStartColor: "#020617",
        gradientEndColor: "#4C1D95",
        gradientAngle: 135,
        titleFontSize: 26,
        titleColor: "#FFFFFF",
        subheadingColor: "#E9D5FF",
        buttonColor: "#FDE68A",
        buttonTextColor: "#111827",
        timerStyle: "GROUPED",
        fontFamily: "SERIF",
        showIcon: true,
        icon: "GIFT",
      },
    };
  }

  if (strategy === "visual") {
    return {
      label: "Visual contrast",
      rationale:
        "A visible layout and color shift isolates whether presentation, not offer mechanics, drives attention.",
      hypothesis:
        "If the creative is easier to scan, impressions should turn into more clicks.",
      text: {
        headline: baseHeadline,
        subheadline: baseSubheadline,
        ctaText: baseCta,
        ctaUrl,
      },
      design: {
        templateKey: "dawn",
        layout: "CTA_RIGHT",
        backgroundType: "GRADIENT",
        gradientStartColor: "#45E4D9",
        gradientEndColor: "#B975F4",
        gradientAngle: 135,
        titleColor: "#173A7A",
        subheadingColor: "#334155",
        buttonColor: "#173A7A",
        buttonTextColor: "#FFFFFF",
        timerStyle: "BOXES",
        showIcon: true,
        icon: "CLOCK",
      },
      boldDesign: {
        templateKey: "dawn",
        layout: "BALANCED",
        backgroundType: "GRADIENT",
        gradientStartColor: "#22D3EE",
        gradientEndColor: "#A855F7",
        gradientAngle: 135,
        titleFontSize: 30,
        timerFontSize: 46,
        titleColor: "#172554",
        subheadingColor: "#312E81",
        buttonColor: "#172554",
        buttonTextColor: "#FFFFFF",
        timerStyle: "BOXES",
        entranceAnimation: "POP",
        timerTickAnimation: "FLIP",
        showIcon: true,
        icon: "CLOCK",
      },
    };
  }

  return {
    label: "Benefit clarity",
    rationale:
      "Clearer value framing makes the same promotion easier to understand before the shopper evaluates the CTA.",
    hypothesis:
      "If the core benefit is understood faster, the variant should improve CTR and add-to-cart intent.",
    text: {
      headline: `Save more today: ${baseHeadline}`,
      subheadline: baseSubheadline,
      ctaText: "See the deal",
      ctaUrl,
    },
    design: {
      templateKey: "clean-minimal",
      layout: "BALANCED",
      backgroundType: "SOLID",
      backgroundColor: "#FFFFFF",
      titleColor: "#111827",
      subheadingColor: "#4B5563",
      buttonColor: "#008060",
      buttonTextColor: "#FFFFFF",
      borderColor: "#D1FAE5",
      borderSize: 1,
      timerStyle: "GROUPED",
    },
    boldDesign: {
      templateKey: "free-shipping",
      layout: "CTA_RIGHT",
      backgroundType: "GRADIENT",
      gradientStartColor: "#ECFDF5",
      gradientEndColor: "#CCFBF1",
      gradientAngle: 110,
      titleFontSize: 26,
      titleColor: "#064E3B",
      subheadingColor: "#047857",
      buttonColor: "#047857",
      buttonTextColor: "#FFFFFF",
      timerStyle: "BOXES",
      showIcon: true,
      icon: "TAG",
    },
  };
}

function getPlacementForIntent(
  placementIntent: ExperimentVariantAiPlacementIntent,
): ExperimentVariantAiPlacement {
  if (placementIntent === "product") {
    return { placementType: "PRODUCT_PAGE", customSelector: "" };
  }

  if (placementIntent === "cart") {
    return { placementType: "CART_DRAWER", customSelector: "" };
  }

  return { placementType: "", customSelector: "" };
}

function sanitizeTextRecord(
  value: unknown,
  fallback: ExperimentVariantAiText,
): Partial<ExperimentVariantAiText> {
  const record = readRecord(value);
  const text: Partial<ExperimentVariantAiText> = {};

  for (const key of textKeys) {
    const nextValue =
      key === "ctaUrl"
        ? sanitizeCtaUrl(record[key], fallback[key])
        : sanitizeText(record[key], fallback[key], key === "ctaText" ? 40 : 160);

    if (nextValue !== fallback[key]) {
      text[key] = nextValue;
    }
  }

  return text;
}

function readTextRecord(value: unknown): ExperimentVariantAiText {
  const record = readRecord(value);

  return textKeys.reduce((text, key) => {
    text[key] = sanitizeText(record[key], "", key === "ctaText" ? 40 : 180);
    return text;
  }, {} as ExperimentVariantAiText);
}

function readPartialTextRecord(value: unknown): Partial<ExperimentVariantAiText> {
  const record = readRecord(value);
  const text: Partial<ExperimentVariantAiText> = {};

  for (const key of textKeys) {
    const nextValue = sanitizeText(record[key], "", 180);
    if (nextValue) text[key] = nextValue;
  }

  return text;
}

function sanitizeDesignRecord(
  value: Record<string, unknown>,
  fallback: CampaignDesignValues,
): CampaignDesignValues {
  return {
    ...fallback,
    ...sanitizePartialDesignRecord(value, fallback),
  };
}

function sanitizePartialDesignRecord(
  value: Record<string, unknown>,
  fallback: CampaignDesignValues,
): Partial<CampaignDesignValues> {
  const design: Partial<CampaignDesignValues> = {};

  if (typeof value.templateKey === "string") {
    const templateKey = value.templateKey.trim();
    if (templateKeys.includes(templateKey)) {
      design.templateKey = templateKey;
    }
  }

  for (const [key, values] of Object.entries(designEnums)) {
    const rawValue = value[key];
    if (typeof rawValue === "string" && values.includes(rawValue as never)) {
      Object.assign(design, { [key]: rawValue });
    }
  }

  for (const key of colorKeys) {
    const color = sanitizeColor(value[key]);
    if (color) Object.assign(design, { [key]: color });
  }

  for (const [key, limits] of Object.entries(numberLimits) as Array<
    [keyof CampaignDesignValues, { min: number; max: number }]
  >) {
    const fallbackNumber =
      typeof fallback[key] === "number" ? fallback[key] : limits.min;
    const number = clampNumber(
      value[key],
      limits.min,
      limits.max,
      fallbackNumber,
    );
    if (number !== fallbackNumber) Object.assign(design, { [key]: number });
  }

  for (const key of booleanDesignKeys) {
    if (typeof value[key] === "boolean") {
      Object.assign(design, { [key]: value[key] });
    }
  }

  for (const key of stringDesignKeys) {
    if (typeof value[key] === "string") {
      Object.assign(design, { [key]: sanitizeDesignString(key, value[key]) });
    }
  }

  if (design.icon === "NONE") {
    design.showIcon = false;
  }

  if (design.backgroundType !== "IMAGE") {
    design.backgroundImageUrl = "";
  }

  return design;
}

function sanitizePlacementRecord(
  value: Record<string, unknown>,
): Partial<ExperimentVariantAiPlacement> {
  const placementType = readString(value.placementType);
  const customSelector = readString(value.customSelector).slice(0, 120);

  if (!placementType) {
    return customSelector ? { customSelector } : {};
  }

  if (!placementValues.includes(placementType as PlacementTypeValue)) {
    return {};
  }

  return {
    placementType: placementType as PlacementTypeValue,
    customSelector:
      placementType === "CUSTOM_SELECTOR" ? customSelector : "",
  };
}

function sanitizeLabel(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";

  return (text || fallback).slice(0, maxLength);
}

function sanitizeText(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";

  return (text || fallback).slice(0, maxLength);
}

function sanitizeCtaUrl(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  const candidate = text || fallback || "/collections/all";

  if (
    candidate.startsWith("/") ||
    candidate.startsWith("https://") ||
    candidate.startsWith("http://")
  ) {
    return candidate.slice(0, 500);
  }

  return fallback || "/collections/all";
}

function sanitizeColor(value: unknown) {
  if (typeof value !== "string") return "";

  const color = value.trim();

  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : "";
}

function sanitizeDesignString(key: keyof CampaignDesignValues, value: string) {
  const text = value.trim();
  const maxLength = key === "customCss" ? 2000 : 500;

  if (
    key === "backgroundImageUrl" ||
    key === "customIconUrl"
  ) {
    if (!text) return "";
    if (text.startsWith("https://") || text.startsWith("/")) {
      return text.slice(0, maxLength);
    }
    return "";
  }

  return text.slice(0, maxLength);
}

function readJsonRecord(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return {};

  try {
    return readRecord(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}

function readJsonArray(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return value as Record<string, unknown>;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => readString(item).slice(0, 100))
    .filter(Boolean);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readEnum<Value extends string>(
  value: FormDataEntryValue | null,
  allowedValues: Value[],
  fallback: Value,
) {
  const text = String(value ?? "").trim();

  return allowedValues.includes(text as Value) ? (text as Value) : fallback;
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(number)) return fallback;

  return Math.max(min, Math.min(max, Math.round(number)));
}
