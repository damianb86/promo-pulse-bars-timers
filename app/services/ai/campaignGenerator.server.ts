import {
  defaultCampaignDesignValues,
  designLayoutOptions,
  isMobileDesignLayout,
  findCampaignDesignTemplate,
} from "../../types/campaign-design";
import type { CampaignDesignValues } from "../../types/campaign-design";
import {
  sanitizeStructureCss,
  sanitizeStructureHtml,
} from "../../utils/structure-html";
import {
  campaignGoalOptions,
  getDefaultPlacementForCampaignType,
  type CampaignGoalValue,
  type CampaignTypeValue,
  type PlacementTypeValue,
} from "../../types/campaign-options";
import {
  countrySelectionOptions,
  productSelectionOptions,
  type CampaignTimerExpiredBehaviorValue,
  type CampaignTimerModeValue,
  type CampaignTimerResetBehaviorValue,
  type CountrySelectionValue,
  type ProductSelectionValue,
} from "../../types/campaign-form";
import { defaultDeliveryCutoffSettingsValues } from "../../types/delivery-cutoff";
import {
  defaultDiscountSettingsValues,
  discountModeOptions,
  discountValueTypeOptions,
  type DiscountModeValue,
  type DiscountValueTypeValue,
} from "../../types/discount";
import { defaultFreeShippingSettingsValues } from "../../types/free-shipping";
import { defaultLowStockSettingsValues } from "../../types/low-stock";
import {
  campaignAiReferenceImageMaxBytes,
  campaignAiShapes,
  campaignAiTones,
  isCampaignAiReferenceImageMimeType,
  type CampaignAiAnswerMap,
  type CampaignAiBadgeSettings,
  type CampaignAiReferenceImage,
  type CampaignAiDeliveryCutoffSettings,
  type CampaignAiDiscountSettings,
  type CampaignAiFollowUpQuestion,
  type CampaignAiFormErrors,
  type CampaignAiAssetSpec,
  type CampaignAiAssetSource,
  type CampaignAiAssetType,
  type CampaignAiImageSize,
  type CampaignAiGeneratedAsset,
  type CampaignAiFreeShippingSettings,
  type CampaignAiInput,
  type CampaignAiLowStockSettings,
  type CampaignAiShape,
  type CampaignAiTargetingSettings,
  type CampaignAiTimerSettings,
  type CampaignAiTone,
  type CampaignAiTranslation,
  type CampaignAiVariant,
  type CampaignSuggestion,
  type CampaignSuggestionCampaign,
  type CampaignSuggestionSource,
} from "../../types/ai-campaign";
import {
  campaignTranslationFields,
  defaultEnabledStorefrontLocales,
  emptyCampaignTranslationValues,
  getStorefrontLocaleOptions,
  type StorefrontLocale,
  type StorefrontLocaleOption,
} from "../../types/localization";
import { normalizeStorefrontLocale } from "../../utils/campaign-localization";
import {
  AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT,
  AI_CAMPAIGN_PROMPT_VERSION,
  AI_CAMPAIGN_SYSTEM_PROMPT,
  AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT,
  buildCampaignAiImageUserPrompt,
  buildCampaignAiUserPrompt,
  type CampaignAiRefinement,
} from "./campaignPrompts.server";

export type { CampaignAiRefinement } from "./campaignPrompts.server";

type CampaignAiProviderOutput = {
  campaign?: Partial<CampaignSuggestionCampaign>;
  timer?: Partial<CampaignAiTimerSettings>;
  targeting?: Partial<CampaignAiTargetingSettings>;
  discount?: Partial<CampaignAiDiscountSettings>;
  freeShipping?: Partial<CampaignAiFreeShippingSettings>;
  lowStock?: Partial<CampaignAiLowStockSettings>;
  badge?: Partial<CampaignAiBadgeSettings>;
  deliveryCutoff?: Partial<CampaignAiDeliveryCutoffSettings>;
  translations?: Partial<
    Record<StorefrontLocale, Partial<CampaignAiTranslation>>
  >;
  design?: Partial<CampaignDesignValues>;
  structureHtml?: string;
  structureCss?: string;
  assets?: unknown;
  safety?: Partial<CampaignSuggestion["safety"]>;
};

type CampaignAiExperimentVariantOutput = Array<Partial<CampaignAiVariant>>;

// Extra context passed to a provider for a single generation. Optional so the
// text-only flow and existing provider implementations stay unchanged.
export type CampaignAiGenerationContext = {
  referenceImage?: CampaignAiReferenceImage;
  refinement?: CampaignAiRefinement;
};

export type CampaignAiProvider = {
  source: CampaignSuggestionSource;
  generateCampaignSuggestion(
    input: CampaignAiInput,
    context?: CampaignAiGenerationContext,
  ): Promise<CampaignAiProviderOutput>;
  generateTranslations?(
    input: CampaignAiInput,
    campaign: CampaignSuggestionCampaign,
  ): Promise<CampaignAiProviderOutput["translations"]>;
  generateExperimentVariants?(
    input: CampaignAiInput,
    campaign: CampaignSuggestionCampaign,
  ): Promise<CampaignAiExperimentVariantOutput>;
};

type CampaignAiGenerationOptions = {
  provider?: CampaignAiProvider;
  referenceImage?: CampaignAiReferenceImage;
  refinement?: CampaignAiRefinement;
};

type CampaignAiInputLike = Partial<
  Omit<CampaignAiInput, "brandTone" | "campaignShape" | "locale" | "objective">
> & {
  brandTone?: string | null;
  campaignShape?: string | null;
  locale?: string | null;
  objective?: string | null;
};

const defaultInput: CampaignAiInput = {
  objective: "FLASH_SALE",
  campaignNameHint: "",
  campaignShape: "sitewide",
  goalAnswers: {},
  productContext: "",
  eventName: "",
  countryCode: "",
  locale: "en",
  brandTone: "premium",
  knownOffer: "",
  quickStarts: [],
  merchantNotes: "",
  followUpAnswers: {},
  ctaUrl: "/collections/all",
  locales: defaultEnabledStorefrontLocales,
  generateVisualAssets: false,
};

const stockClaimPatterns = [
  /\bonly\s+\d+\s+(left|remaining|in stock|available)\b/i,
  /\b(low|limited)\s+stock\b/i,
  /\balmost\s+gone\b/i,
  /\bselling\s+out\b/i,
  /\blast\s+(units|pieces|items)\b/i,
  /\bwhile\s+supplies\s+last\b/i,
];
const exactStockClaimPatterns = [
  /\bonly\s+\d+\s+(left|remaining|in stock|available)\b/i,
  /\b\d+\s+(left|remaining|in stock|available)\b/i,
];

const discountClaimPatterns = [
  /\b\d{1,3}\s*%\s*off\b/i,
  /\b(save|savings)\s+\d{1,3}\s*%\b/i,
  /\b(save|savings)\s+\$?\d+(?:\.\d{2})?\b/i,
  /\$\d+(?:\.\d{2})?\s*off\b/i,
  /\bfree\s+shipping\b/i,
  /\bfree\s+gift\b/i,
  /\bdiscount\b/i,
];

const openAiJsonKeys = [
  "campaign",
  "timer",
  "targeting",
  "discount",
  "freeShipping",
  "lowStock",
  "badge",
  "deliveryCutoff",
  "translations",
  "design",
  "structureHtml",
  "structureCss",
  "assets",
];

export function buildDefaultCampaignAiInput(
  overrides: CampaignAiInputLike = {},
): CampaignAiInput {
  return normalizeCampaignAiInput({ ...defaultInput, ...overrides });
}

export function parseCampaignAiFormData(
  formData: FormData,
): {
  values: CampaignAiInput;
  errors: CampaignAiFormErrors;
} {
  const values = normalizeCampaignAiInput({
    objective: readString(formData, "objective") || defaultInput.objective,
    campaignNameHint: readString(formData, "campaignNameHint"),
    campaignShape:
      readString(formData, "campaignShape") || defaultInput.campaignShape,
    goalAnswers: readAnswerMap(formData, "goalAnswersJson"),
    productContext: readString(formData, "productContext"),
    eventName: readString(formData, "eventName"),
    countryCode: readString(formData, "countryCode"),
    locale: readString(formData, "locale") || defaultInput.locale,
    brandTone: readString(formData, "brandTone") || defaultInput.brandTone,
    knownOffer: readString(formData, "knownOffer"),
    quickStarts: readStringArray(formData, "quickStartsJson"),
    merchantNotes: readString(formData, "merchantNotes"),
    followUpAnswers: readAnswerMap(formData, "followUpAnswersJson"),
    ctaUrl: readString(formData, "ctaUrl") || defaultInput.ctaUrl,
    locales: readLocales(formData, "locales"),
    generateVisualAssets:
      readString(formData, "generateVisualAssets") === "true",
  });

  const errors: CampaignAiFormErrors = {};

  if (!isValidStorefrontUrl(values.ctaUrl)) {
    errors.ctaUrl =
      "Target URL must be a storefront path or a valid absolute URL.";
  }

  return { values, errors };
}

// Parse and validate an uploaded reference image submitted as a base64 data URL.
// Returns the sanitized image plus an optional user-facing error. Designed so the
// route can fall back to the text-only flow on any problem.
export function parseCampaignAiReferenceImage(formData: FormData): {
  image: CampaignAiReferenceImage | null;
  error?: string;
} {
  const rawDataUrl = formData.get("referenceImageDataUrl");

  if (typeof rawDataUrl !== "string" || !rawDataUrl.trim()) {
    return { image: null };
  }

  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(rawDataUrl.trim());

  if (!match) {
    return {
      image: null,
      error: "The reference image could not be read. Try uploading it again.",
    };
  }

  const mimeType = match[1].toLowerCase();
  const base64 = match[2];

  if (!isCampaignAiReferenceImageMimeType(mimeType)) {
    return {
      image: null,
      error: "Unsupported image type. Use a PNG, JPG, JPEG, or WEBP file.",
    };
  }

  // base64 length -> decoded byte length (ignoring padding) to enforce the size
  // limit on the server without decoding the whole payload.
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const approxBytes = Math.floor((base64.length * 3) / 4) - padding;

  if (approxBytes <= 0) {
    return {
      image: null,
      error: "The reference image appears to be empty. Try another file.",
    };
  }

  if (approxBytes > campaignAiReferenceImageMaxBytes) {
    const maxMb = Math.round(campaignAiReferenceImageMaxBytes / (1024 * 1024));
    return {
      image: null,
      error: `The reference image is too large. Use a file under ${maxMb} MB.`,
    };
  }

  return {
    image: {
      dataUrl: `data:${mimeType};base64,${base64}`,
      mimeType,
    },
  };
}

export function hasCampaignAiFormErrors(errors: CampaignAiFormErrors) {
  return Object.values(errors).some(Boolean);
}

export function shouldAskCampaignAiFollowUpQuestions(
  input: CampaignAiInput,
  followUpStatus: FormDataEntryValue | null,
) {
  return (
    String(followUpStatus ?? "initial") !== "answered" &&
    buildCampaignAiFollowUpQuestions(input).length > 0
  );
}

export function buildCampaignAiFollowUpQuestions(
  input: CampaignAiInput,
): CampaignAiFollowUpQuestion[] {
  const answerIds = getSelectedAnswerIds(input);
  const questions: CampaignAiFollowUpQuestion[] = [];
  const hasConcreteOffer =
    Boolean(parseOffer(input.knownOffer).hasConcrete) ||
    hasAnyAnswer(input, [
      "flash_sale_10_percent",
      "flash_sale_20_percent",
      "flash_sale_percent",
      "flash_sale_fixed",
      "cart_incentive_discount",
      "cart_incentive_shipping",
    ]);

  if (
    input.objective === "FREE_SHIPPING" &&
    !hasThresholdAnswer(input) &&
    !parseOffer(input.knownOffer).thresholdAmount
  ) {
    questions.push({
      id: "free_shipping_threshold",
      question: "Which free-shipping threshold should Promo Pulse draft?",
      reason:
        "The campaign needs a real threshold to configure cart progress accurately.",
      options: [
        {
          id: "free_shipping_threshold_50",
          label: "$50 threshold",
          description: "Useful for low average order values.",
        },
        {
          id: "free_shipping_threshold_75",
          label: "$75 threshold",
          description: "Balanced default for many stores.",
        },
        {
          id: "free_shipping_threshold_100",
          label: "$100 threshold",
          description: "Best when the offer should lift order value more.",
        },
      ],
    });
  }

  if (input.objective === "FLASH_SALE" && !hasConcreteOffer) {
    questions.push({
      id: "flash_sale_offer",
      question: "What offer should the flash-sale draft assume?",
      reason:
        "Without a concrete offer, Promo Pulse will avoid discount claims.",
      options: [
        {
          id: "flash_sale_10_percent",
          label: "10% off",
          description: "A conservative percentage discount.",
        },
        {
          id: "flash_sale_20_percent",
          label: "20% off",
          description: "A stronger sale message.",
        },
        {
          id: "flash_sale_no_discount",
          label: "Urgency without discount",
          description: "Use timer pressure, but avoid savings claims.",
        },
      ],
    });
  }

  if (
    input.objective === "CART_RESCUE" &&
    !answerIds.has("cart_timer_15") &&
    !answerIds.has("cart_timer_30")
  ) {
    questions.push({
      id: "cart_rescue_timer",
      question: "How aggressive should the cart timer be?",
      reason: "Cart timers need a duration that matches the intended pressure.",
      options: [
        {
          id: "cart_timer_15",
          label: "15 minutes",
          description: "Short, high-urgency checkout rescue.",
        },
        {
          id: "cart_timer_30",
          label: "30 minutes",
          description: "More relaxed checkout reminder.",
        },
        {
          id: "cart_incentive_none",
          label: "No incentive",
          description: "Use timing and copy only.",
        },
      ],
    });
  }

  if (
    input.objective === "DELIVERY_CUTOFF" &&
    !answerIds.has("delivery_cutoff_14") &&
    !answerIds.has("delivery_cutoff_16")
  ) {
    questions.push({
      id: "delivery_cutoff_time",
      question: "What cutoff time should the draft use?",
      reason:
        "Delivery cutoff campaigns need a concrete cutoff hour to configure the daily timer.",
      options: [
        {
          id: "delivery_cutoff_14",
          label: "2:00 PM",
          description: "A common conservative fulfillment cutoff.",
        },
        {
          id: "delivery_cutoff_16",
          label: "4:00 PM",
          description: "Use when fulfillment can process later orders.",
        },
        {
          id: "delivery_after_hide",
          label: "Hide after cutoff",
          description: "Do not show a next-window promise after cutoff.",
        },
      ],
    });
  }

  if (
    input.objective === "LOW_STOCK_URGENCY" &&
    !answerIds.has("low_stock_threshold_5") &&
    !answerIds.has("low_stock_threshold_10")
  ) {
    questions.push({
      id: "low_stock_threshold",
      question: "When should low-stock messaging appear?",
      reason:
        "Inventory urgency needs a threshold and should avoid fake counts.",
      options: [
        {
          id: "low_stock_threshold_5",
          label: "Below 5 units",
          description: "Conservative urgency.",
        },
        {
          id: "low_stock_threshold_10",
          label: "Below 10 units",
          description: "Earlier product-page reminder.",
        },
        {
          id: "low_stock_hide_quantity",
          label: "Hide exact quantity",
          description: "Show low-stock copy without a number.",
        },
      ],
    });
  }

  if (
    input.objective === "PRODUCT_BADGE" &&
    !answerIds.has("badge_new_drop") &&
    !answerIds.has("badge_limited_offer")
  ) {
    questions.push({
      id: "product_badge_text",
      question: "What should the product badge emphasize?",
      reason: "Badge campaigns need short merchandising text.",
      options: [
        {
          id: "badge_new_drop",
          label: "New drop",
          description: "Best for launches and new collections.",
        },
        {
          id: "badge_limited_offer",
          label: "Limited offer",
          description: "Best for sale or promotional products.",
        },
        {
          id: "badge_free_shipping",
          label: "Free shipping",
          description: "Use only if the store really offers it.",
        },
      ],
    });
  }

  if (
    input.objective === "ANNOUNCEMENT" &&
    !answerIds.has("announcement_launch") &&
    !answerIds.has("announcement_policy")
  ) {
    questions.push({
      id: "announcement_focus",
      question: "What is the announcement mainly about?",
      reason: "General announcements need a clear message angle.",
      options: [
        {
          id: "announcement_launch",
          label: "Launch or new collection",
          description: "Drive shoppers to explore new items.",
        },
        {
          id: "announcement_policy",
          label: "Store update",
          description: "Use a clear operational message.",
        },
        {
          id: "announcement_event",
          label: "Seasonal event",
          description: "Tie the message to a date or event.",
        },
      ],
    });
  }

  return questions.slice(0, 2);
}

function getSelectedAnswerIds(input: CampaignAiInput) {
  return new Set([
    ...Object.values(input.goalAnswers).flat(),
    ...Object.values(input.followUpAnswers).flat(),
  ]);
}

function hasAnswer(input: CampaignAiInput, answerId: string) {
  return getSelectedAnswerIds(input).has(answerId);
}

function hasAnyAnswer(input: CampaignAiInput, answerIds: string[]) {
  const selectedAnswers = getSelectedAnswerIds(input);
  return answerIds.some((answerId) => selectedAnswers.has(answerId));
}

function hasThresholdAnswer(input: CampaignAiInput) {
  return hasAnyAnswer(input, [
    "free_shipping_threshold_50",
    "free_shipping_threshold_75",
    "free_shipping_threshold_100",
  ]);
}

export async function generateCampaignSuggestion(
  input: CampaignAiInput,
  options: CampaignAiGenerationOptions = {},
): Promise<CampaignSuggestion> {
  const normalizedInput = normalizeCampaignAiInput(input);
  const provider = options.provider ?? getDefaultCampaignAiProvider();
  const referenceImage = options.referenceImage;
  const context: CampaignAiGenerationContext | undefined =
    referenceImage || options.refinement
      ? { referenceImage, refinement: options.refinement }
      : undefined;
  const output = await provider.generateCampaignSuggestion(
    normalizedInput,
    context,
  );
  const suggestion = completeCampaignSuggestion(
    normalizedInput,
    output,
    provider.source,
    {
      referenceImageUsed: Boolean(referenceImage),
      allowVisualOverrides:
        Boolean(referenceImage) || normalizedInput.generateVisualAssets,
    },
  );

  return sanitizeCampaignSuggestion(suggestion);
}

export async function generateTranslations(
  input: CampaignAiInput,
  campaign?: CampaignSuggestionCampaign,
  options: CampaignAiGenerationOptions = {},
): Promise<CampaignSuggestion["translations"]> {
  const normalizedInput = normalizeCampaignAiInput(input);
  const resolvedCampaign =
    campaign ?? buildMockCampaignSuggestion(normalizedInput).campaign;
  const provider = options.provider ?? getDefaultCampaignAiProvider();
  const output = provider.generateTranslations
    ? await provider.generateTranslations(normalizedInput, resolvedCampaign)
    : {};
  const fallback = buildTranslations(normalizedInput, resolvedCampaign);
  const translations = mergeTranslations(fallback, output ?? {});

  return sanitizeTranslations(normalizedInput, translations, []);
}

export async function generateExperimentVariants(
  input: CampaignAiInput,
  campaign?: CampaignSuggestionCampaign,
  options: CampaignAiGenerationOptions = {},
): Promise<CampaignAiVariant[]> {
  const normalizedInput = normalizeCampaignAiInput(input);
  const resolvedCampaign =
    campaign ?? buildMockCampaignSuggestion(normalizedInput).campaign;
  const provider = options.provider ?? getDefaultCampaignAiProvider();
  const output = provider.generateExperimentVariants
    ? await provider.generateExperimentVariants(
        normalizedInput,
        resolvedCampaign,
      )
    : [];
  const fallback = buildVariants(normalizedInput, resolvedCampaign);

  return sanitizeVariants(
    normalizedInput,
    output && output.length > 0 ? output : fallback,
    fallback,
    [],
  );
}

export function parseAppliedCampaignSuggestion(
  value: FormDataEntryValue | null,
): CampaignSuggestion | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const parsed = JSON.parse(value) as Partial<CampaignSuggestion>;
    const input = normalizeCampaignAiInput(parsed.input ?? defaultInput);
    const completed = completeCampaignSuggestion(
      input,
      {
        campaign: parsed.campaign,
        timer: parsed.timer,
        targeting: parsed.targeting,
        discount: parsed.discount,
        freeShipping: parsed.freeShipping,
        lowStock: parsed.lowStock,
        badge: parsed.badge,
        deliveryCutoff: parsed.deliveryCutoff,
        translations: parsed.translations,
        design: parsed.design,
        structureHtml: parsed.structureHtml,
        structureCss: parsed.structureCss,
        assets: parsed.assets,
        safety: parsed.safety,
      },
      parsed.source === "provider" ? "provider" : "mock",
      {
        referenceImageUsed: Boolean(parsed.referenceImageUsed),
        allowVisualOverrides:
          Boolean(parsed.referenceImageUsed) || input.generateVisualAssets,
      },
    );

    // Assets already generated + uploaded during generation round-trip here so
    // saving persists them without re-uploading.
    completed.generatedAssets = sanitizeGeneratedAssets(parsed.generatedAssets);

    if (parsed.promptVersion !== AI_CAMPAIGN_PROMPT_VERSION) {
      completed.safety.warnings.push(
        "Suggestion prompt version changed; review before saving.",
      );
    }

    return sanitizeCampaignSuggestion(completed);
  } catch {
    return null;
  }
}

export function createMockCampaignAiProvider(): CampaignAiProvider {
  return {
    source: "mock",
    async generateCampaignSuggestion(input) {
      return buildMockCampaignSuggestion(input);
    },
    async generateTranslations(input, campaign) {
      return buildTranslations(input, campaign);
    },
    async generateExperimentVariants(input, campaign) {
      return buildVariants(input, campaign);
    },
  };
}

function getDefaultCampaignAiProvider(): CampaignAiProvider {
  if (
    process.env.E2E_TEST_MODE === "true" ||
    process.env.PROMO_PULSE_AI_PROVIDER !== "openai" ||
    !process.env.OPENAI_API_KEY
  ) {
    return createMockCampaignAiProvider();
  }

  return createOpenAiCampaignProvider(process.env.OPENAI_API_KEY);
}

function createOpenAiCampaignProvider(apiKey: string): CampaignAiProvider {
  return {
    source: "provider",
    async generateCampaignSuggestion(input, context) {
      const referenceImage = context?.referenceImage;
      const refinement = context?.refinement;

      if (referenceImage) {
        try {
          return await requestOpenAiJson(
            apiKey,
            input,
            referenceImage,
            refinement,
          );
        } catch (error) {
          console.error(
            "AI campaign image analysis failed; retrying without the image",
            error,
          );
          // Fall back to the text-only flow so the merchant still gets a draft.
          try {
            return await requestOpenAiJson(
              apiKey,
              input,
              undefined,
              refinement,
            );
          } catch (textError) {
            console.error(
              "AI campaign provider failed; using mock output",
              textError,
            );
            return buildMockCampaignSuggestion(input);
          }
        }
      }

      try {
        return await requestOpenAiJson(apiKey, input, undefined, refinement);
      } catch (error) {
        console.error("AI campaign provider failed; using mock output", error);
        return buildMockCampaignSuggestion(input);
      }
    },
  };
}

async function requestOpenAiJson(
  apiKey: string,
  input: CampaignAiInput,
  referenceImage?: CampaignAiReferenceImage,
  refinement?: CampaignAiRefinement,
): Promise<CampaignAiProviderOutput> {
  const responsesUrl =
    process.env.OPENAI_RESPONSES_URL?.trim() ||
    "https://api.openai.com/v1/responses";

  // Multimodal analysis uses the dedicated vision model (default gpt-5.4),
  // configurable via OPENAI_VISION_MODEL so it can be switched to gpt-5.5 or any
  // compatible model without code changes.
  const model = referenceImage
    ? process.env.OPENAI_VISION_MODEL?.trim() || "gpt-5.4"
    : (process.env.OPENAI_MODEL ?? "gpt-5.4-mini");

  if (referenceImage) {
    console.info("AI campaign image analysis: requesting suggestion", {
      model,
      mimeType: referenceImage.mimeType,
    });
  }
  const usesVisualPrompt = Boolean(referenceImage) || input.generateVisualAssets;

  const userContent = referenceImage
    ? [
        {
          type: "input_text",
          text: buildCampaignAiImageUserPrompt(
            input,
            refinement,
            referenceImage,
          ),
        },
        { type: "input_image", image_url: referenceImage.dataUrl },
      ]
    : buildCampaignAiUserPrompt(input, refinement);

  const response = await fetch(responsesUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: referenceImage
            ? AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT
            : usesVisualPrompt
              ? AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT
              : AI_CAMPAIGN_SYSTEM_PROMPT,
        },
        { role: "user", content: userContent },
      ],
      text: {
        format: { type: "json_object" },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI provider returned ${response.status}`);
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
    throw new Error("OpenAI provider returned no JSON text.");
  }

  const parsed = JSON.parse(text) as CampaignAiProviderOutput & {
    variants?: unknown;
  };

  if (Object.prototype.hasOwnProperty.call(parsed, "variants")) {
    throw new Error("OpenAI provider returned an unsupported variants field.");
  }

  const hasExpectedKey = openAiJsonKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(parsed, key),
  );

  if (!hasExpectedKey) {
    throw new Error("OpenAI provider returned an unsupported JSON shape.");
  }

  return parsed;
}

function completeCampaignSuggestion(
  input: CampaignAiInput,
  output: CampaignAiProviderOutput,
  source: CampaignSuggestionSource,
  options: {
    referenceImageUsed?: boolean;
    allowVisualOverrides?: boolean;
  } = {},
): CampaignSuggestion {
  const fallback = buildMockCampaignSuggestion(input);
  const campaign = mergeCampaign(fallback.campaign, output.campaign);
  const referenceImageUsed = options.referenceImageUsed === true;
  const allowVisualOverrides =
    options.allowVisualOverrides ?? referenceImageUsed;

  return {
    promptVersion: AI_CAMPAIGN_PROMPT_VERSION,
    source,
    referenceImageUsed,
    input,
    campaign,
    timer: ensureTimerHasMockData(
      campaign.type,
      sanitizeTimerSettings(output.timer, fallback.timer),
    ),
    targeting: sanitizeTargetingSettings(output.targeting, fallback.targeting),
    discount: sanitizeDiscountSettings(output.discount, fallback.discount),
    freeShipping: sanitizeFreeShippingSettings(
      output.freeShipping,
      fallback.freeShipping,
    ),
    lowStock: sanitizeLowStockSettings(output.lowStock, fallback.lowStock),
    badge: sanitizeBadgeSettings(output.badge, fallback.badge),
    deliveryCutoff: sanitizeDeliveryCutoffSettings(
      output.deliveryCutoff,
      fallback.deliveryCutoff,
    ),
    translations: mergeTranslations(
      buildTranslations(input, campaign),
      output.translations ?? {},
    ),
    design: sanitizeAiDesign(
      output.design,
      fallback.design,
      allowVisualOverrides,
    ),
    structureHtml:
      typeof output.structureHtml === "string" ? output.structureHtml : "",
    structureCss:
      typeof output.structureCss === "string" ? output.structureCss : "",
    assets: sanitizeAiAssetSpecs(output.assets, input.generateVisualAssets),
    generatedAssets: [],
    variants: [],
    safety: {
      warnings: [...(output.safety?.warnings ?? [])],
      blockedClaims: [...(output.safety?.blockedClaims ?? [])],
      requiresReview: output.safety?.requiresReview ?? true,
    },
  };
}

function buildMockCampaignSuggestion(
  input: CampaignAiInput,
): CampaignSuggestion {
  const campaign = buildCampaign(input);

  return {
    promptVersion: AI_CAMPAIGN_PROMPT_VERSION,
    source: "mock",
    referenceImageUsed: false,
    input,
    campaign,
    timer: buildTimer(input),
    targeting: buildTargeting(input, campaign),
    discount: buildDiscount(input),
    freeShipping: buildFreeShipping(input),
    lowStock: buildLowStock(input),
    badge: buildBadge(input, campaign),
    deliveryCutoff: buildDeliveryCutoff(input),
    translations: buildTranslations(input, campaign),
    design: buildDesign(input),
    structureHtml: "",
    structureCss: "",
    assets: [],
    generatedAssets: [],
    variants: [],
    safety: {
      warnings: [],
      blockedClaims: [],
      requiresReview: true,
    },
  };
}

function buildCampaign(input: CampaignAiInput): CampaignSuggestionCampaign {
  const campaignType = getCampaignTypeForObjective(input.objective);
  const product = input.productContext || "selected products";
  const event = input.eventName || "this promotion";
  const offer = getOfferCopy(input);
  const withOffer = Boolean(offer);
  const prefix = getTonePrefix(input.brandTone);
  const placementTypes = getPlacementsForInput(input, campaignType);
  const campaignName = input.campaignNameHint.trim()
    ? input.campaignNameHint.trim()
    : `${event} - ${product}`;
  const headline = withOffer
    ? `${offer} on ${product}`
    : `${prefix}${event} for ${product}`;
  const subheadline = withOffer
    ? `${event} is live. Review the offer details before publishing.`
    : "Use your real campaign settings to keep this message accurate.";

  return {
    goal: input.objective,
    type: campaignType,
    placementType: placementTypes[0],
    placementTypes,
    name: campaignName.slice(0, 80),
    status: "DRAFT",
    headline: truncateText(headline, 72),
    subheadline: truncateText(subheadline, 140),
    ctaText: getCtaText(input),
    ctaUrl: input.ctaUrl,
    expiredText: "This campaign has ended.",
  };
}

function buildTranslations(
  input: CampaignAiInput,
  campaign: CampaignSuggestionCampaign,
): CampaignSuggestion["translations"] {
  const product = input.productContext || "selected products";
  const offer = getOfferCopy(input);
  const event = input.eventName || "this promotion";
  const hasOffer = Boolean(offer);

  const defaultTranslations: Record<string, CampaignAiTranslation> = {
    en: createTranslation({
      headline: campaign.headline,
      subheadline: campaign.subheadline,
      ctaText: campaign.ctaText,
      ctaUrl: campaign.ctaUrl,
      expiredText: campaign.expiredText,
      badgeText: hasOffer ? offer : "Promotion",
    }),
    es: createTranslation({
      headline: hasOffer
        ? `${offer} en ${product}`
        : `${event} para ${product}`,
      subheadline: hasOffer
        ? `${event} esta activo. Revisa los detalles antes de publicar.`
        : "Usa configuracion real de campana para mantener el mensaje exacto.",
      ctaText: hasOffer ? "Ver oferta" : "Ver detalles",
      ctaUrl: campaign.ctaUrl,
      expiredText: "Esta campana termino.",
      badgeText: hasOffer ? offer : "Promocion",
    }),
    "pt-BR": createTranslation({
      headline: hasOffer
        ? `${offer} em ${product}`
        : `${event} para ${product}`,
      subheadline: hasOffer
        ? `${event} esta ativo. Revise os detalhes antes de publicar.`
        : "Use configuracoes reais de campanha para manter a mensagem correta.",
      ctaText: hasOffer ? "Ver oferta" : "Ver detalhes",
      ctaUrl: campaign.ctaUrl,
      expiredText: "Esta campanha terminou.",
      badgeText: hasOffer ? offer : "Promocao",
    }),
    fr: createTranslation({
      headline: hasOffer
        ? `${offer} sur ${product}`
        : `${event} pour ${product}`,
      subheadline: hasOffer
        ? `${event} est actif. Verifiez les details avant de publier.`
        : "Utilisez de vrais reglages de campagne pour garder ce message exact.",
      ctaText: hasOffer ? "Voir l'offre" : "Voir les details",
      ctaUrl: campaign.ctaUrl,
      expiredText: "Cette campagne est terminee.",
      badgeText: hasOffer ? offer : "Promotion",
    }),
    de: createTranslation({
      headline: hasOffer
        ? `${offer} auf ${product}`
        : `${event} fur ${product}`,
      subheadline: hasOffer
        ? `${event} ist aktiv. Pruefe die Details vor der Veroeffentlichung.`
        : "Nutze echte Kampagneneinstellungen, damit die Aussage korrekt bleibt.",
      ctaText: hasOffer ? "Angebot ansehen" : "Details ansehen",
      ctaUrl: campaign.ctaUrl,
      expiredText: "Diese Kampagne ist beendet.",
      badgeText: hasOffer ? offer : "Aktion",
    }),
  };

  return getCampaignAiLocaleOptions(input).reduce(
    (translations, localeOption) => {
      translations[localeOption.locale] =
        defaultTranslations[localeOption.locale] ?? defaultTranslations.en;
      return translations;
    },
    {} as CampaignSuggestion["translations"],
  );
}

function buildTimer(input: CampaignAiInput): CampaignAiTimerSettings {
  if (input.objective === "CART_RESCUE") {
    return {
      mode: "EVERGREEN_SESSION",
      durationMinutes: hasAnswer(input, "cart_timer_30") ? "30" : "15",
      resetBehavior: "ON_SESSION_END",
      expiredBehavior: "HIDE_TIMER",
      recurringHour: "23",
      recurringMinute: "59",
      startsAt: "",
      endsAt: "",
    };
  }

  if (input.objective === "DELIVERY_CUTOFF") {
    return {
      mode: "RECURRING_DAILY",
      durationMinutes: "120",
      resetBehavior: "DAILY",
      expiredBehavior: "DO_NOTHING",
      recurringHour: hasAnswer(input, "delivery_cutoff_16") ? "16" : "14",
      recurringMinute: "0",
      startsAt: "",
      endsAt: "",
    };
  }

  if (
    input.objective === "LOW_STOCK_URGENCY" ||
    input.objective === "PRODUCT_BADGE"
  ) {
    return {
      mode: "FIXED_DATE",
      durationMinutes: "120",
      resetBehavior: "NEVER",
      expiredBehavior: "DO_NOTHING",
      recurringHour: "23",
      recurringMinute: "59",
      startsAt: "",
      endsAt: "",
    };
  }

  return {
    mode: "FIXED_DATE",
    durationMinutes: "120",
    resetBehavior: "NEVER",
    expiredBehavior: "UNPUBLISH_TIMER",
    recurringHour: "23",
    recurringMinute: "59",
    startsAt: "",
    endsAt: toDateTimeLocalString(
      new Date(Date.now() + getDefaultTimerHours(input) * 60 * 60 * 1000),
    ),
  };
}

function buildTargeting(
  input: CampaignAiInput,
  campaign: CampaignSuggestionCampaign,
): CampaignAiTargetingSettings {
  const productTags = inferProductTags(input);
  const productSelection =
    campaign.placementTypes.includes("CUSTOM_SELECTOR") &&
    input.campaignShape === "merchandising"
      ? "CUSTOM_POSITION"
      : productTags.length > 0 &&
          (input.objective === "PRODUCT_BADGE" ||
            input.objective === "LOW_STOCK_URGENCY")
        ? "TAGS"
        : "ALL_PRODUCTS";
  const countrySelection =
    input.countryCode && input.countryCode !== "US"
      ? "SPECIFIC_COUNTRIES"
      : "ALL_WORLD";

  return {
    productSelection,
    productIds: [],
    excludeProductIds: [],
    collectionIds: [],
    productTags: productSelection === "TAGS" ? productTags : [],
    customSelector: "",
    customStyle: "",
    urlContains: [],
    excludedUrlContains: [],
    countrySelection,
    countries:
      countrySelection === "SPECIFIC_COUNTRIES" ? [input.countryCode] : [],
  };
}

function buildDiscount(input: CampaignAiInput): CampaignAiDiscountSettings {
  const offer = parseOffer(input.knownOffer);
  const answerOffer = getOfferFromAnswers(input);
  const resolvedOffer = {
    ...offer,
    freeShipping: offer.freeShipping || answerOffer.freeShipping,
    percentage: offer.percentage ?? answerOffer.percentage,
    fixedAmount: offer.fixedAmount ?? answerOffer.fixedAmount,
    thresholdAmount: offer.thresholdAmount ?? answerOffer.thresholdAmount,
  };

  if (resolvedOffer.freeShipping || input.objective === "FREE_SHIPPING") {
    return {
      ...defaultAiDiscount(),
      mode: "CREATE_NEW",
      title: buildDiscountTitle(input, "Free shipping"),
      valueType: "FREE_SHIPPING",
      value: "",
      minimumSubtotal: resolvedOffer.thresholdAmount ?? "",
      discountCode: buildDiscountCode(input, "SHIP"),
    };
  }

  if (resolvedOffer.percentage) {
    return {
      ...defaultAiDiscount(),
      mode: hasAnswer(input, "cart_incentive_discount")
        ? "UNIQUE_CODES"
        : "CREATE_NEW",
      title: buildDiscountTitle(input, `${resolvedOffer.percentage}% off`),
      valueType: "PERCENTAGE",
      value: String(resolvedOffer.percentage),
      minimumSubtotal: resolvedOffer.thresholdAmount ?? "",
      discountCode: buildDiscountCode(input, "SAVE"),
    };
  }

  if (resolvedOffer.fixedAmount) {
    return {
      ...defaultAiDiscount(),
      mode: "CREATE_NEW",
      title: buildDiscountTitle(input, `${resolvedOffer.fixedAmount} off`),
      valueType: "FIXED_AMOUNT",
      value: String(resolvedOffer.fixedAmount),
      minimumSubtotal: resolvedOffer.thresholdAmount ?? "",
      discountCode: buildDiscountCode(input, "SAVE"),
    };
  }

  return defaultAiDiscount();
}

function buildFreeShipping(
  input: CampaignAiInput,
): CampaignAiFreeShippingSettings {
  const offer = parseOffer(input.knownOffer);
  const thresholdAmount =
    offer.thresholdAmount ??
    getThresholdAmountFromAnswers(input) ??
    (input.objective === "FREE_SHIPPING"
      ? defaultFreeShippingSettingsValues.thresholdAmount
      : "75.00");

  return {
    thresholdAmount,
    currencyCode: inferCurrency(input.countryCode),
    includeDiscountedSubtotal: true,
    emptyCartMessage: "Add items to unlock free shipping.",
    successMessage: "You've unlocked free shipping.",
    progressStyle:
      hasAnswer(input, "free_shipping_compact") ||
      input.campaignShape === "cart"
        ? "COMPACT"
        : "BAR",
  };
}

function buildLowStock(input: CampaignAiInput): CampaignAiLowStockSettings {
  return {
    threshold: hasAnswer(input, "low_stock_threshold_10")
      ? "10"
      : input.objective === "LOW_STOCK_URGENCY"
        ? defaultLowStockSettingsValues.threshold
        : "5",
    showExactQuantity: hasAnswer(input, "low_stock_show_quantity"),
    fallbackMessage:
      input.objective === "LOW_STOCK_URGENCY"
        ? "Low stock"
        : defaultLowStockSettingsValues.fallbackMessage,
  };
}

function buildBadge(
  input: CampaignAiInput,
  campaign: CampaignSuggestionCampaign,
): CampaignAiBadgeSettings {
  const offer = getOfferCopy(input);

  return {
    badgeText:
      input.objective === "PRODUCT_BADGE"
        ? getBadgeTextFromAnswers(input) ||
          truncateText(offer || input.eventName || "Limited offer", 48)
        : truncateText(campaign.headline, 48),
    badgeShape: input.brandTone === "minimal" ? "SQUARE" : "PILL",
    badgePosition: "TOP_RIGHT",
  };
}

function buildDeliveryCutoff(
  input: CampaignAiInput,
): CampaignAiDeliveryCutoffSettings {
  return {
    cutoffHour: hasAnswer(input, "delivery_cutoff_16")
      ? "16"
      : defaultDeliveryCutoffSettingsValues.cutoffHour,
    cutoffMinute: defaultDeliveryCutoffSettingsValues.cutoffMinute,
    processingDays: defaultDeliveryCutoffSettingsValues.processingDays,
    minDeliveryDays: defaultDeliveryCutoffSettingsValues.minDeliveryDays,
    maxDeliveryDays: defaultDeliveryCutoffSettingsValues.maxDeliveryDays,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [],
    countryRules:
      input.countryCode && input.countryCode !== "US"
        ? { [input.countryCode]: { minDeliveryDays: 2, maxDeliveryDays: 6 } }
        : {},
    afterCutoffBehavior: hasAnswer(input, "delivery_after_hide")
      ? "HIDE"
      : defaultDeliveryCutoffSettingsValues.afterCutoffBehavior,
  };
}

function buildDesign(input: CampaignAiInput): CampaignDesignValues {
  return findCampaignDesignTemplate(selectDesignTemplateKey(input));
}

function selectDesignTemplateKey(input: CampaignAiInput) {
  const tone = input.brandTone;
  // A richer, tone-led preset for goals whose default preset is plain, so a
  // non-minimal brand never falls back to a bare light card (mirrors the
  // tone→visual guidance in the AI prompt).
  const tonePreset =
    tone === "urgent"
      ? "flash-sale"
      : tone === "playful"
        ? "holiday"
        : tone === "premium" || tone === "luxury"
          ? "premium-dark"
          : null;

  if (input.objective === "FREE_SHIPPING") return "free-shipping";
  if (input.objective === "DELIVERY_CUTOFF") return "delivery-cutoff";
  if (input.objective === "LOW_STOCK_URGENCY") return tonePreset ?? "low-stock";
  if (input.objective === "PRODUCT_BADGE") return "clean-minimal";
  if (tone === "urgent") return "flash-sale";
  if (tone === "playful") return "holiday";
  if (tone === "minimal") return "clean-minimal";

  return "premium-dark";
}

function buildVariants(
  input: CampaignAiInput,
  campaign: CampaignSuggestionCampaign,
): CampaignAiVariant[] {
  const offer = getOfferCopy(input);
  const product = input.productContext || "selected products";
  const baseCta = campaign.ctaText;
  const hasOffer = Boolean(offer);

  return [
    {
      name: "Direct offer",
      weight: 34,
      headline: campaign.headline,
      subheadline: campaign.subheadline,
      ctaText: baseCta,
      designOverride: { alignment: "CENTER" },
      placementOverride: { placementType: campaign.placementType },
    },
    {
      name: "Benefit led",
      weight: 33,
      headline: hasOffer ? `${offer} for ${product}` : `Explore ${product}`,
      subheadline: hasOffer
        ? "Keep the promotion accurate by matching this copy to the real offer."
        : "Highlight the real benefit the campaign unlocks.",
      ctaText: hasOffer ? "Claim offer" : "Learn more",
      designOverride: { alignment: "LEFT", showIcon: true },
      placementOverride: { placementType: campaign.placementType },
    },
    {
      name: "Minimal reminder",
      weight: 33,
      headline: hasOffer ? `${offer} available now` : "Campaign active now",
      subheadline: hasOffer
        ? "Short copy for compact placements."
        : "Short copy for placements where details appear nearby.",
      ctaText: baseCta,
      designOverride: {
        templateKey: "clean-minimal",
        alignment: "CENTER",
        showIcon: false,
        icon: "NONE",
      },
      placementOverride: { placementType: campaign.placementType },
    },
  ];
}

const ASSET_TYPES = new Set<CampaignAiAssetType>([
  "background",
  "icon",
  "badge",
  "pattern",
  "texture",
  "decoration",
  "image",
]);
const ASSET_SOURCES = new Set<CampaignAiAssetSource>([
  "generated",
  "extracted",
  "svg",
]);
const AI_IMAGE_SIZES = new Set<CampaignAiImageSize>([
  "1024x1024",
  "1536x1024",
  "1024x1536",
]);

// Parses the optional normalized region {x,y,width,height} (each 0..1) marking
// where the asset appears in the reference image. Returns undefined unless all
// four values are present, finite, and describe a non-empty box inside [0,1].
function sanitizeAssetRegion(
  value: unknown,
): CampaignAiAssetSpec["region"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const num = (raw: unknown) => {
    const parsed = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : null;
  };
  const x = num(record.x);
  const y = num(record.y);
  const width = num(record.width);
  const height = num(record.height);
  if (x === null || y === null || width === null || height === null) {
    return undefined;
  }
  if (width <= 0 || height <= 0) return undefined;
  return { x, y, width, height };
}

// Validates the AI's asset specs. Returns [] entirely when the merchant did not
// request visual assets, so the feature can never be triggered implicitly.
function sanitizeAiAssetSpecs(
  value: unknown,
  generateVisualAssets: boolean,
): CampaignAiAssetSpec[] {
  if (!generateVisualAssets || !Array.isArray(value)) return [];

  const specs: CampaignAiAssetSpec[] = [];
  const seenKeys = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const key = String(record.key ?? "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 40);
    const type = record.type as CampaignAiAssetType;
    const source = record.source as CampaignAiAssetSource;
    if (!key || seenKeys.has(key)) continue;
    if (!ASSET_TYPES.has(type) || !ASSET_SOURCES.has(source)) continue;

    seenKeys.add(key);
    specs.push({
      key,
      type,
      source,
      prompt: String(record.prompt ?? "")
        .trim()
        .slice(0, 1200),
      imageSize: AI_IMAGE_SIZES.has(record.imageSize as CampaignAiImageSize)
        ? (record.imageSize as CampaignAiImageSize)
        : undefined,
      svg:
        source === "svg" && typeof record.svg === "string"
          ? record.svg
          : undefined,
      region: sanitizeAssetRegion(record.region),
    });
    if (specs.length >= 8) break; // hard cap on assets per campaign
  }

  return specs;
}

// Validates already-uploaded asset records coming back from the reviewed
// suggestion JSON (only safe http(s) Shopify URLs are kept).
function sanitizeGeneratedAssets(value: unknown): CampaignAiGeneratedAsset[] {
  if (!Array.isArray(value)) return [];
  const assets: CampaignAiGeneratedAsset[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const shopifyUrl = String(record.shopifyUrl ?? "").trim();
    const shopifyFileId = String(record.shopifyFileId ?? "").trim();
    if (!/^https?:\/\//i.test(shopifyUrl) || !shopifyFileId) continue;
    const source = record.source as CampaignAiAssetSource;
    if (!ASSET_SOURCES.has(source)) continue;
    assets.push({
      key: String(record.key ?? "").slice(0, 40),
      assetType: String(record.assetType ?? "image").slice(0, 40),
      source,
      shopifyFileId,
      shopifyUrl,
      modelUsed: typeof record.modelUsed === "string" ? record.modelUsed : null,
      promptUsed:
        typeof record.promptUsed === "string" ? record.promptUsed : null,
    });
    if (assets.length >= 8) break;
  }
  return assets;
}

function sanitizeCampaignSuggestion(
  suggestion: CampaignSuggestion,
): CampaignSuggestion {
  const warnings = [...suggestion.safety.warnings];
  const blockedClaims = [...suggestion.safety.blockedClaims];
  const campaign = sanitizeCampaignCopy(
    suggestion.input,
    suggestion.campaign,
    blockedClaims,
  );
  const translations = sanitizeTranslations(
    suggestion.input,
    suggestion.translations,
    blockedClaims,
  );
  if (blockedClaims.length > suggestion.safety.blockedClaims.length) {
    warnings.push(
      "Some generated claims were replaced because they mentioned stock or unsupported discounts.",
    );
  }

  return {
    ...suggestion,
    campaign,
    translations,
    design: sanitizeAiDesign(
      suggestion.design,
      buildDesign(suggestion.input),
      Boolean(suggestion.referenceImageUsed) ||
        suggestion.input.generateVisualAssets,
    ),
    // Sanitize any AI-authored structural HTML / CSS to the safe allowlist so a
    // generated override can never inject unsafe markup or styles.
    structureHtml: sanitizeStructureHtml(suggestion.structureHtml),
    structureCss: suggestion.structureCss
      ? sanitizeStructureCss(suggestion.structureCss)
      : "",
    assets: sanitizeAiAssetSpecs(
      suggestion.assets,
      suggestion.input.generateVisualAssets,
    ),
    variants: [],
    safety: {
      warnings: uniqueStrings(warnings),
      blockedClaims: uniqueStrings(blockedClaims),
      requiresReview: true,
    },
  };
}

function sanitizeCampaignCopy(
  input: CampaignAiInput,
  campaign: CampaignSuggestionCampaign,
  blockedClaims: string[],
): CampaignSuggestionCampaign {
  const fallback = buildCampaign(input);
  const placementTypes = sanitizePlacementTypes(
    campaign.placementTypes,
    fallback.placementTypes,
  );
  const placementType = isPlacementType(campaign.placementType)
    ? campaign.placementType
    : placementTypes[0];

  return {
    ...campaign,
    goal: isCampaignGoal(campaign.goal) ? campaign.goal : fallback.goal,
    type: isCampaignType(campaign.type) ? campaign.type : fallback.type,
    placementType: placementTypes.includes(placementType)
      ? placementType
      : placementTypes[0],
    placementTypes,
    status: "DRAFT",
    name: sanitizePlainText(campaign.name, fallback.name, {
      input,
      field: "name",
      blockedClaims,
    }),
    headline: sanitizePlainText(campaign.headline, fallback.headline, {
      input,
      field: "headline",
      blockedClaims,
    }),
    subheadline: sanitizePlainText(campaign.subheadline, fallback.subheadline, {
      input,
      field: "subheadline",
      blockedClaims,
    }),
    ctaText: sanitizePlainText(campaign.ctaText, fallback.ctaText, {
      input,
      field: "ctaText",
      blockedClaims,
    }),
    ctaUrl: isValidStorefrontUrl(campaign.ctaUrl)
      ? campaign.ctaUrl
      : fallback.ctaUrl,
    expiredText: sanitizePlainText(campaign.expiredText, fallback.expiredText, {
      input,
      field: "expiredText",
      blockedClaims,
    }),
  };
}

// Campaign types that render a countdown timer.
const TIMER_CAMPAIGN_TYPES = new Set<CampaignTypeValue>([
  "COUNTDOWN_BAR",
  "PRODUCT_TIMER",
  "CART_TIMER",
]);

// When the image contains any kind of timer (the model picked a timer campaign
// type), guarantee the timer actually counts down: if the merchant provided no
// real deadline/duration, fill mock data (a 24h FIXED_DATE end date, or a default
// duration for evergreen/recurring modes) so the timer always works.
function ensureTimerHasMockData(
  type: CampaignTypeValue,
  timer: CampaignAiTimerSettings,
): CampaignAiTimerSettings {
  if (!TIMER_CAMPAIGN_TYPES.has(type)) return timer;

  const hasFutureEndsAt =
    isDateTimeLocalString(timer.endsAt) &&
    new Date(timer.endsAt).getTime() > Date.now();
  const hasDuration = Number(timer.durationMinutes) > 0;

  if (timer.mode === "FIXED_DATE") {
    if (hasFutureEndsAt) return timer;
    return {
      ...timer,
      endsAt: toDateTimeLocalString(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    };
  }

  // Evergreen / recurring modes rely on a duration instead of an end date.
  if (!hasDuration) {
    return { ...timer, durationMinutes: "60" };
  }
  return timer;
}

function sanitizeTimerSettings(
  timer: Partial<CampaignAiTimerSettings> | undefined,
  fallback: CampaignAiTimerSettings,
): CampaignAiTimerSettings {
  return {
    mode: isTimerMode(timer?.mode) ? timer.mode : fallback.mode,
    durationMinutes: sanitizeOptionalIntegerString(
      timer?.durationMinutes,
      fallback.durationMinutes,
      1,
      10080,
    ),
    resetBehavior: isTimerResetBehavior(timer?.resetBehavior)
      ? timer.resetBehavior
      : fallback.resetBehavior,
    expiredBehavior: isTimerExpiredBehavior(timer?.expiredBehavior)
      ? timer.expiredBehavior
      : fallback.expiredBehavior,
    recurringHour: sanitizeOptionalIntegerString(
      timer?.recurringHour,
      fallback.recurringHour,
      0,
      23,
    ),
    recurringMinute: sanitizeOptionalIntegerString(
      timer?.recurringMinute,
      fallback.recurringMinute,
      0,
      59,
    ),
    startsAt: isDateTimeLocalString(timer?.startsAt)
      ? String(timer?.startsAt)
      : fallback.startsAt,
    endsAt: isDateTimeLocalString(timer?.endsAt)
      ? String(timer?.endsAt)
      : fallback.endsAt,
  };
}

function sanitizeTargetingSettings(
  targeting: Partial<CampaignAiTargetingSettings> | undefined,
  fallback: CampaignAiTargetingSettings,
): CampaignAiTargetingSettings {
  const productSelection = isProductSelection(targeting?.productSelection)
    ? targeting.productSelection
    : fallback.productSelection;
  const countrySelection = isCountrySelection(targeting?.countrySelection)
    ? targeting.countrySelection
    : fallback.countrySelection;

  return {
    productSelection,
    productIds: sanitizeIdList(targeting?.productIds),
    excludeProductIds: sanitizeIdList(targeting?.excludeProductIds),
    collectionIds: sanitizeIdList(targeting?.collectionIds),
    productTags: sanitizePlainList(targeting?.productTags, 40, 60),
    customSelector:
      typeof targeting?.customSelector === "string"
        ? targeting.customSelector.trim().slice(0, 500)
        : fallback.customSelector,
    customStyle:
      typeof targeting?.customStyle === "string"
        ? targeting.customStyle.trim().slice(0, 500)
        : fallback.customStyle,
    urlContains: sanitizePlainList(targeting?.urlContains, 20, 200),
    excludedUrlContains: sanitizePlainList(
      targeting?.excludedUrlContains,
      20,
      200,
    ),
    countrySelection,
    countries:
      countrySelection === "SPECIFIC_COUNTRIES"
        ? sanitizeCountryList(targeting?.countries, fallback.countries)
        : [],
  };
}

function sanitizeDiscountSettings(
  discount: Partial<CampaignAiDiscountSettings> | undefined,
  fallback: CampaignAiDiscountSettings,
): CampaignAiDiscountSettings {
  const mode = isDiscountMode(discount?.mode) ? discount.mode : fallback.mode;
  const valueType = isDiscountValueType(discount?.valueType)
    ? discount.valueType
    : fallback.valueType;

  return {
    mode,
    discountCode: sanitizeDiscountCode(
      discount?.discountCode,
      fallback.discountCode,
    ),
    title: sanitizeShortSettingText(discount?.title, fallback.title, 120),
    valueType,
    value:
      valueType === "FREE_SHIPPING"
        ? ""
        : sanitizeNumberString(discount?.value, fallback.value, 0, 10000),
    minimumSubtotal: sanitizeOptionalNumberString(
      discount?.minimumSubtotal,
      fallback.minimumSubtotal,
      0,
      100000,
    ),
    appliesOncePerCustomer:
      typeof discount?.appliesOncePerCustomer === "boolean"
        ? discount.appliesOncePerCustomer
        : fallback.appliesOncePerCustomer,
    uniqueCodePrefix: sanitizeUniqueCodePrefix(
      discount?.uniqueCodePrefix,
      fallback.uniqueCodePrefix,
    ),
    uniqueCodeExpiresMinutes: sanitizeOptionalIntegerString(
      discount?.uniqueCodeExpiresMinutes,
      fallback.uniqueCodeExpiresMinutes,
      5,
      43200,
    ),
    uniqueCodeAutoApply:
      typeof discount?.uniqueCodeAutoApply === "boolean"
        ? discount.uniqueCodeAutoApply
        : fallback.uniqueCodeAutoApply,
    uniqueCodeReassignExpired:
      typeof discount?.uniqueCodeReassignExpired === "boolean"
        ? discount.uniqueCodeReassignExpired
        : fallback.uniqueCodeReassignExpired,
  };
}

function sanitizeFreeShippingSettings(
  freeShipping: Partial<CampaignAiFreeShippingSettings> | undefined,
  fallback: CampaignAiFreeShippingSettings,
): CampaignAiFreeShippingSettings {
  return {
    thresholdAmount: sanitizeNumberString(
      freeShipping?.thresholdAmount,
      fallback.thresholdAmount,
      1,
      100000,
    ),
    currencyCode: sanitizeCurrencyCode(
      freeShipping?.currencyCode,
      fallback.currencyCode,
    ),
    includeDiscountedSubtotal:
      typeof freeShipping?.includeDiscountedSubtotal === "boolean"
        ? freeShipping.includeDiscountedSubtotal
        : fallback.includeDiscountedSubtotal,
    emptyCartMessage: sanitizeShortSettingText(
      freeShipping?.emptyCartMessage,
      fallback.emptyCartMessage,
      500,
    ),
    successMessage: sanitizeShortSettingText(
      freeShipping?.successMessage,
      fallback.successMessage,
      500,
    ),
    progressStyle:
      freeShipping?.progressStyle === "BAR" ||
      freeShipping?.progressStyle === "COMPACT" ||
      freeShipping?.progressStyle === "CIRCULAR"
        ? freeShipping.progressStyle
        : fallback.progressStyle,
  };
}

function sanitizeLowStockSettings(
  lowStock: Partial<CampaignAiLowStockSettings> | undefined,
  fallback: CampaignAiLowStockSettings,
): CampaignAiLowStockSettings {
  return {
    threshold: sanitizeOptionalIntegerString(
      lowStock?.threshold,
      fallback.threshold,
      1,
      10000,
    ),
    showExactQuantity:
      typeof lowStock?.showExactQuantity === "boolean"
        ? lowStock.showExactQuantity
        : fallback.showExactQuantity,
    fallbackMessage: sanitizeShortSettingText(
      lowStock?.fallbackMessage,
      fallback.fallbackMessage,
      180,
    ),
  };
}

function sanitizeBadgeSettings(
  badge: Partial<CampaignAiBadgeSettings> | undefined,
  fallback: CampaignAiBadgeSettings,
): CampaignAiBadgeSettings {
  return {
    badgeText: sanitizeShortSettingText(
      badge?.badgeText,
      fallback.badgeText,
      48,
    ),
    badgeShape:
      badge?.badgeShape === "PILL" ||
      badge?.badgeShape === "ROUNDED" ||
      badge?.badgeShape === "SQUARE"
        ? badge.badgeShape
        : fallback.badgeShape,
    badgePosition:
      badge?.badgePosition === "TOP_LEFT" ||
      badge?.badgePosition === "TOP_RIGHT" ||
      badge?.badgePosition === "BOTTOM_LEFT" ||
      badge?.badgePosition === "BOTTOM_RIGHT"
        ? badge.badgePosition
        : fallback.badgePosition,
  };
}

function sanitizeDeliveryCutoffSettings(
  deliveryCutoff: Partial<CampaignAiDeliveryCutoffSettings> | undefined,
  fallback: CampaignAiDeliveryCutoffSettings,
): CampaignAiDeliveryCutoffSettings {
  return {
    cutoffHour: sanitizeOptionalIntegerString(
      deliveryCutoff?.cutoffHour,
      fallback.cutoffHour,
      0,
      23,
    ),
    cutoffMinute: sanitizeOptionalIntegerString(
      deliveryCutoff?.cutoffMinute,
      fallback.cutoffMinute,
      0,
      59,
    ),
    processingDays: sanitizeOptionalIntegerString(
      deliveryCutoff?.processingDays,
      fallback.processingDays,
      0,
      30,
    ),
    minDeliveryDays: sanitizeOptionalIntegerString(
      deliveryCutoff?.minDeliveryDays,
      fallback.minDeliveryDays,
      0,
      60,
    ),
    maxDeliveryDays: sanitizeOptionalIntegerString(
      deliveryCutoff?.maxDeliveryDays,
      fallback.maxDeliveryDays,
      0,
      90,
    ),
    workingDays: sanitizeWorkingDays(
      deliveryCutoff?.workingDays,
      fallback.workingDays,
    ),
    holidays: sanitizeHolidayList(deliveryCutoff?.holidays),
    countryRules: sanitizeJsonObject(
      deliveryCutoff?.countryRules,
      fallback.countryRules,
    ),
    afterCutoffBehavior:
      deliveryCutoff?.afterCutoffBehavior === "SHOW_NEXT_WINDOW" ||
      deliveryCutoff?.afterCutoffBehavior === "SHOW_AFTER_CUTOFF_MESSAGE" ||
      deliveryCutoff?.afterCutoffBehavior === "HIDE"
        ? deliveryCutoff.afterCutoffBehavior
        : fallback.afterCutoffBehavior,
  };
}

function sanitizeTranslations(
  input: CampaignAiInput,
  translations: CampaignSuggestion["translations"],
  blockedClaims: string[],
): CampaignSuggestion["translations"] {
  const fallback = buildTranslations(input, buildCampaign(input));

  return getCampaignAiLocaleOptions(input).reduce(
    (normalized, { locale }) => {
      const source = translations[locale] ?? fallback[locale];
      const base = fallback[locale];

      normalized[locale] = campaignTranslationFields.reduce(
        (translation, { key }) => {
          translation[key] = sanitizePlainText(source[key], base[key], {
            input,
            field: key,
            blockedClaims,
          });
          return translation;
        },
        {
          ...emptyCampaignTranslationValues,
          ctaUrl: source.ctaUrl ?? base.ctaUrl,
        },
      );

      normalized[locale].ctaUrl = isValidStorefrontUrl(source.ctaUrl)
        ? source.ctaUrl
        : base.ctaUrl;

      return normalized;
    },
    {} as CampaignSuggestion["translations"],
  );
}

function sanitizeVariants(
  input: CampaignAiInput,
  variants: Array<Partial<CampaignAiVariant>>,
  fallback: CampaignAiVariant[],
  blockedClaims: string[],
): CampaignAiVariant[] {
  const cleaned = variants.slice(0, 3).map((variant, index) => {
    const base = fallback[index] ?? fallback[0];

    return {
      name: sanitizePlainText(variant.name, base.name, {
        input,
        field: "variantName",
        blockedClaims,
      }),
      weight: sanitizeWeight(variant.weight, base.weight),
      headline: sanitizePlainText(variant.headline, base.headline, {
        input,
        field: "variantHeadline",
        blockedClaims,
      }),
      subheadline: sanitizePlainText(variant.subheadline, base.subheadline, {
        input,
        field: "variantSubheadline",
        blockedClaims,
      }),
      ctaText: sanitizePlainText(variant.ctaText, base.ctaText, {
        input,
        field: "variantCtaText",
        blockedClaims,
      }),
      designOverride: omitPresetVisualOverrides(
        sanitizePartialDesign(variant.designOverride ?? base.designOverride),
      ),
      discountOverride:
        allowsDiscountClaims(input) && variant.discountOverride
          ? variant.discountOverride
          : undefined,
      placementOverride: variant.placementOverride ?? base.placementOverride,
    };
  });

  return cleaned.length >= 2 ? cleaned : fallback;
}

function sanitizePlainText(
  value: unknown,
  fallback: string,
  {
    input,
    field,
    blockedClaims,
  }: {
    input: CampaignAiInput;
    field: string;
    blockedClaims: string[];
  },
) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;

  if (exactStockClaimPatterns.some((pattern) => pattern.test(text))) {
    blockedClaims.push(`${field}: ${text}`);
    return fallback;
  }

  if (
    !allowsStockClaims(input) &&
    stockClaimPatterns.some((pattern) => pattern.test(text))
  ) {
    blockedClaims.push(`${field}: ${text}`);
    return fallback;
  }

  if (
    !allowsDiscountClaims(input) &&
    discountClaimPatterns.some((pattern) => pattern.test(text))
  ) {
    blockedClaims.push(`${field}: ${text}`);
    return fallbackWithoutDiscount(input, field, fallback);
  }

  return truncateText(text, field.includes("subheadline") ? 160 : 90);
}

function fallbackWithoutDiscount(
  input: CampaignAiInput,
  field: string,
  fallback: string,
) {
  const product = input.productContext || "selected products";

  if (field.toLowerCase().includes("headline")) {
    return `Campaign for ${product}`;
  }

  if (field.toLowerCase().includes("cta")) {
    return "View details";
  }

  return fallback.replace(/\b(save|discount|free shipping)\b/gi, "promotion");
}

function mergeCampaign(
  fallback: CampaignSuggestionCampaign,
  override?: Partial<CampaignSuggestionCampaign>,
): CampaignSuggestionCampaign {
  return {
    ...fallback,
    ...override,
  };
}

function mergeTranslations(
  fallback: CampaignSuggestion["translations"],
  override: Partial<Record<StorefrontLocale, Partial<CampaignAiTranslation>>>,
): CampaignSuggestion["translations"] {
  return getStorefrontLocaleOptions(Object.keys(fallback)).reduce(
    (translations, { locale }) => {
      translations[locale] = {
        ...fallback[locale],
        ...(override[locale] ?? {}),
      };
      return translations;
    },
    {} as CampaignSuggestion["translations"],
  );
}

function getCampaignAiLocaleOptions(
  input: Pick<CampaignAiInput, "locales">,
): StorefrontLocaleOption[] {
  return getStorefrontLocaleOptions(input.locales);
}

function createTranslation(
  values: Partial<CampaignAiTranslation>,
): CampaignAiTranslation {
  return {
    ...emptyCampaignTranslationValues,
    headline: values.headline ?? "",
    subheadline: values.subheadline ?? "",
    ctaText: values.ctaText ?? "",
    expiredText: values.expiredText ?? "",
    badgeText: values.badgeText ?? "",
    lowStockText: "Show only when inventory rules match.",
    freeShippingEmptyText:
      "Add items to your cart to check free shipping eligibility.",
    freeShippingProgressText:
      "Add {{remaining_amount}} more if free shipping is configured.",
    freeShippingSuccessText: "Free shipping is available for this cart.",
    deliveryBeforeCutoffText:
      "Order in {{time_left}} if same-day shipping is configured.",
    deliveryAfterCutoffText:
      "Delivery timing follows the store's configured shipping rules.",
    ctaUrl: values.ctaUrl ?? "",
  };
}

function normalizeCampaignAiInput(input: CampaignAiInputLike): CampaignAiInput {
  const localeOptions = getStorefrontLocaleOptions(
    input.locales?.length ? input.locales : defaultInput.locales,
  );
  const locales = localeOptions.map((localeOption) => localeOption.locale);
  const requestedLocale =
    normalizeStorefrontLocale(input.locale ?? "en") ?? "en";
  const normalizedLocale = locales.includes(requestedLocale)
    ? requestedLocale
    : (locales[0] ?? "en");
  const tone = campaignAiTones.includes(input.brandTone as CampaignAiTone)
    ? (input.brandTone as CampaignAiTone)
    : "premium";
  const campaignShape = campaignAiShapes.includes(
    input.campaignShape as CampaignAiShape,
  )
    ? (input.campaignShape as CampaignAiShape)
    : defaultInput.campaignShape;
  const objective = isCampaignGoal(input.objective)
    ? input.objective
    : defaultInput.objective;

  return {
    objective,
    campaignNameHint: normalizeTextInput(input.campaignNameHint, 80),
    campaignShape,
    goalAnswers: normalizeAnswerMap(input.goalAnswers),
    productContext: normalizeTextInput(input.productContext, 90),
    eventName: normalizeTextInput(input.eventName, 80),
    countryCode: normalizeCountry(input.countryCode),
    locale: normalizedLocale,
    brandTone: tone,
    knownOffer: normalizeTextInput(input.knownOffer, 120),
    quickStarts: normalizeStringArray(input.quickStarts, 12, 80),
    merchantNotes: normalizeTextInput(input.merchantNotes, 500),
    followUpAnswers: normalizeAnswerMap(input.followUpAnswers),
    ctaUrl: normalizeTextInput(input.ctaUrl, 180) || defaultInput.ctaUrl,
    locales,
    generateVisualAssets: input.generateVisualAssets === true,
  };
}

function normalizeTextInput(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
) {
  return Array.isArray(value)
    ? uniqueStrings(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, maxLength))
          .filter(Boolean),
      ).slice(0, maxItems)
    : [];
}

function normalizeAnswerMap(value: unknown): CampaignAiAnswerMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce(
    (answers, [key, items]) => {
      const questionId = normalizeTextInput(key, 80);
      const selectedAnswers = normalizeStringArray(items, 12, 80);

      if (questionId && selectedAnswers.length > 0) {
        answers[questionId] = selectedAnswers;
      }

      return answers;
    },
    {} as CampaignAiAnswerMap,
  );
}

function normalizeCountry(value: unknown) {
  const country = typeof value === "string" ? value.trim().toUpperCase() : "";
  return country === "" || /^[A-Z]{2}$/.test(country) ? country : "";
}

function getCampaignTypeForObjective(
  objective: CampaignGoalValue,
): CampaignTypeValue {
  if (objective === "FREE_SHIPPING") return "FREE_SHIPPING_GOAL";
  if (objective === "DELIVERY_CUTOFF") return "DELIVERY_CUTOFF";
  if (objective === "LOW_STOCK_URGENCY") return "LOW_STOCK";
  if (objective === "PRODUCT_BADGE") return "PRODUCT_BADGE";
  if (objective === "CART_RESCUE") return "CART_TIMER";
  return "COUNTDOWN_BAR";
}

function getPlacementsForInput(
  input: CampaignAiInput,
  campaignType: CampaignTypeValue,
): PlacementTypeValue[] {
  if (input.objective === "FREE_SHIPPING") {
    return hasAnswer(input, "free_shipping_top_bar")
      ? ["CART_DRAWER", "CART_PAGE", "TOP_BAR"]
      : ["CART_DRAWER", "CART_PAGE"];
  }

  if (input.campaignShape === "cart" || input.objective === "CART_RESCUE") {
    return hasAnswer(input, "cart_surface_page")
      ? ["CART_DRAWER", "CART_PAGE"]
      : ["CART_DRAWER"];
  }

  if (input.objective === "PRODUCT_BADGE") {
    return hasAnswer(input, "badge_product_page")
      ? ["COLLECTION_CARD", "PRODUCT_PAGE_BADGE"]
      : ["COLLECTION_CARD"];
  }

  if (input.objective === "LOW_STOCK_URGENCY") {
    return ["PRODUCT_PAGE", "COLLECTION_CARD"];
  }

  if (input.objective === "DELIVERY_CUTOFF") {
    return ["PRODUCT_PAGE", "CART_DRAWER"];
  }

  if (input.campaignShape === "product") {
    return ["PRODUCT_PAGE"];
  }

  if (input.campaignShape === "merchandising") {
    return ["COLLECTION_CARD", "PRODUCT_PAGE_BADGE"];
  }

  const defaultPlacement = getDefaultPlacementForCampaignType(campaignType);
  return defaultPlacement === "BOTTOM_BAR"
    ? ["BOTTOM_BAR"]
    : [defaultPlacement || "TOP_BAR"];
}

function getTonePrefix(tone: CampaignAiTone) {
  if (tone === "urgent") return "Limited-time ";
  if (tone === "playful") return "Fresh ";
  if (tone === "minimal") return "";
  if (tone === "luxury") return "Private ";
  return "Premium ";
}

function getCtaText(input: CampaignAiInput) {
  if (getOfferCopy(input)) return "Shop offer";
  if (input.objective === "FREE_SHIPPING") return "Continue shopping";
  if (input.objective === "DELIVERY_CUTOFF") return "View delivery details";
  return "View details";
}

function allowsDiscountClaims(input: CampaignAiInput) {
  return Boolean(getOfferCopy(input)) || input.objective === "FREE_SHIPPING";
}

function allowsStockClaims(input: CampaignAiInput) {
  return (
    input.objective === "LOW_STOCK_URGENCY" ||
    /\b(low|limited)\s+stock\b/i.test(input.knownOffer) ||
    /\b(low|limited)\s+stock\b/i.test(input.merchantNotes)
  );
}

function getDefaultTimerHours(input: CampaignAiInput) {
  if (hasAnswer(input, "flash_sale_48h")) return 48;
  if (hasAnswer(input, "flash_sale_weekend")) return 72;
  if (hasAnswer(input, "free_shipping_countdown_24h")) return 24;

  if (input.brandTone === "urgent" || input.objective === "FLASH_SALE") {
    return 24;
  }

  if (input.objective === "ANNOUNCEMENT") return 72;

  return 48;
}

function toDateTimeLocalString(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function inferProductTags(input: CampaignAiInput) {
  const source = `${input.productContext} ${input.merchantNotes}`.toLowerCase();
  const candidates = [
    "sale",
    "clearance",
    "new",
    "launch",
    "bundle",
    "premium",
    "vip",
    "summer",
    "winter",
    "holiday",
  ];

  return candidates.filter((tag) => source.includes(tag)).slice(0, 4);
}

function inferCurrency(countryCode: string) {
  if (countryCode === "AR") return "ARS";
  if (countryCode === "BR") return "BRL";
  if (countryCode === "CA") return "CAD";
  if (countryCode === "GB") return "GBP";
  if (
    countryCode === "EU" ||
    ["ES", "FR", "DE", "IT", "NL"].includes(countryCode)
  ) {
    return "EUR";
  }

  return "USD";
}

function parseOffer(knownOffer: string) {
  const offer = knownOffer.trim();
  const percentageMatch = offer.match(/\b(\d{1,3})\s*%\s*(off|discount)?\b/i);
  const fixedMatch = offer.match(
    /(?:[$€£]\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:usd|eur|gbp|ars|brl))\s*(?:off|discount)?/i,
  );
  const thresholdMatch = offer.match(
    /\b(?:over|above|from|minimum|threshold|orders?\s+over)\s*[$€£]?\s*(\d+(?:[.,]\d{1,2})?)/i,
  );

  return {
    freeShipping: /\bfree\s+shipping\b/i.test(offer),
    percentage: percentageMatch
      ? clampInteger(Number(percentageMatch[1]), 1, 100)
      : null,
    fixedAmount: fixedMatch
      ? normalizeDecimalString(fixedMatch[1] ?? fixedMatch[2])
      : null,
    thresholdAmount: thresholdMatch
      ? normalizeDecimalString(thresholdMatch[1])
      : null,
    hasConcrete: Boolean(
      percentageMatch ||
      fixedMatch ||
      thresholdMatch ||
      /\bfree\s+shipping\b/i.test(offer),
    ),
  };
}

function getOfferFromAnswers(input: CampaignAiInput) {
  return {
    freeShipping:
      hasAnyAnswer(input, [
        "free_shipping_threshold_50",
        "free_shipping_threshold_75",
        "free_shipping_threshold_100",
        "cart_incentive_shipping",
        "badge_free_shipping",
      ]) || input.quickStarts.includes("Free shipping threshold"),
    percentage: hasAnswer(input, "flash_sale_10_percent")
      ? 10
      : hasAnswer(input, "flash_sale_20_percent") ||
          hasAnswer(input, "flash_sale_percent")
        ? 20
        : hasAnswer(input, "cart_incentive_discount")
          ? 10
          : null,
    fixedAmount: hasAnswer(input, "flash_sale_fixed") ? "10" : null,
    thresholdAmount: getThresholdAmountFromAnswers(input),
  };
}

function getOfferCopy(input: CampaignAiInput) {
  const knownOffer = input.knownOffer.trim();
  if (knownOffer) return knownOffer;

  if (hasAnswer(input, "flash_sale_10_percent")) return "10% off";
  if (hasAnswer(input, "flash_sale_20_percent")) return "20% off";
  if (hasAnswer(input, "flash_sale_percent")) return "20% off";
  if (hasAnswer(input, "flash_sale_fixed")) return "$10 off";
  if (hasAnswer(input, "cart_incentive_discount")) return "10% off";
  if (hasAnswer(input, "cart_incentive_shipping")) return "Free shipping";
  if (hasAnswer(input, "badge_free_shipping")) return "Free shipping";
  if (input.objective === "FREE_SHIPPING") {
    const thresholdAmount =
      getThresholdAmountFromAnswers(input) ??
      defaultFreeShippingSettingsValues.thresholdAmount;

    return `Free shipping over $${thresholdAmount}`;
  }

  return "";
}

function getThresholdAmountFromAnswers(input: CampaignAiInput) {
  if (hasAnswer(input, "free_shipping_threshold_50")) return "50";
  if (hasAnswer(input, "free_shipping_threshold_100")) return "100";
  if (hasAnswer(input, "free_shipping_threshold_75")) return "75";

  return null;
}

function getBadgeTextFromAnswers(input: CampaignAiInput) {
  if (hasAnswer(input, "badge_new_drop")) return "New drop";
  if (hasAnswer(input, "badge_free_shipping")) return "Free shipping";
  if (hasAnswer(input, "badge_limited_offer")) return "Limited offer";

  return "";
}

function defaultAiDiscount(): CampaignAiDiscountSettings {
  return {
    mode: defaultDiscountSettingsValues.mode,
    discountCode: "",
    title: "",
    valueType: defaultDiscountSettingsValues.valueType,
    value: defaultDiscountSettingsValues.value,
    minimumSubtotal: "",
    appliesOncePerCustomer: false,
    uniqueCodePrefix: defaultDiscountSettingsValues.uniqueCodePrefix,
    uniqueCodeExpiresMinutes:
      defaultDiscountSettingsValues.uniqueCodeExpiresMinutes,
    uniqueCodeAutoApply: defaultDiscountSettingsValues.uniqueCodeAutoApply,
    uniqueCodeReassignExpired:
      defaultDiscountSettingsValues.uniqueCodeReassignExpired,
  };
}

function buildDiscountTitle(input: CampaignAiInput, label: string) {
  return truncateText(
    `${input.eventName || input.productContext || "Promo Pulse"} ${label}`,
    120,
  );
}

function buildDiscountCode(input: CampaignAiInput, prefix: string) {
  const source = input.eventName || input.productContext || "PROMO";
  const suffix = source
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);

  return `${prefix}${suffix || "PULSE"}`.slice(0, 40);
}

function normalizeDecimalString(value: string | undefined) {
  const number = Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(number) || number <= 0) return null;

  return number % 1 === 0 ? String(number) : number.toFixed(2);
}

function sanitizeDesign(
  design: Partial<CampaignDesignValues>,
): CampaignDesignValues {
  return {
    ...defaultCampaignDesignValues,
    ...sanitizePartialDesign(design),
  };
}

function sanitizeAiDesign(
  design: Partial<CampaignDesignValues> | undefined,
  fallback: CampaignDesignValues,
  // When true (reference-image flow), keep the AI's visual overrides (colors,
  // gradients, etc.) layered on top of the chosen preset so the campaign matches
  // the uploaded image. The text-only flow keeps stripping them to the preset
  // palette for safety/consistency.
  allowVisualOverrides = false,
): CampaignDesignValues {
  const sanitizedDesign = sanitizePartialDesign(design);
  const templateKey =
    typeof sanitizedDesign.templateKey === "string"
      ? sanitizedDesign.templateKey
      : fallback.templateKey;
  const template = findCampaignDesignTemplate(templateKey);
  const appliedDesign = allowVisualOverrides
    ? sanitizedDesign
    : omitPresetVisualOverrides(sanitizedDesign);

  return sanitizeDesign({
    ...template,
    ...appliedDesign,
    templateKey: template.templateKey,
  });
}

function sanitizePartialDesign(
  design: Partial<CampaignDesignValues> | undefined,
): Partial<CampaignDesignValues> {
  if (!design || typeof design !== "object") return {};

  return {
    ...(typeof design.templateKey === "string"
      ? { templateKey: design.templateKey.slice(0, 80) }
      : {}),
    ...(designLayoutOptions.some(
      (option) =>
        option.value === design.layout && !isMobileDesignLayout(option.value),
    )
      ? { layout: design.layout }
      : {}),
    ...(design.backgroundType === "SOLID" ||
    design.backgroundType === "GRADIENT" ||
    design.backgroundType === "IMAGE"
      ? { backgroundType: design.backgroundType }
      : {}),
    ...(isHexColor(design.backgroundColor)
      ? { backgroundColor: design.backgroundColor }
      : {}),
    ...(typeof design.backgroundImageUrl === "string" &&
    (isSafeImageUrl(design.backgroundImageUrl) ||
      isAssetPlaceholder(design.backgroundImageUrl))
      ? { backgroundImageUrl: design.backgroundImageUrl.slice(0, 1000) }
      : {}),
    ...(isHexColor(design.gradientStartColor)
      ? { gradientStartColor: design.gradientStartColor }
      : {}),
    ...(isHexColor(design.gradientEndColor)
      ? { gradientEndColor: design.gradientEndColor }
      : {}),
    ...(typeof design.gradientAngle === "number"
      ? { gradientAngle: clampInteger(design.gradientAngle, 0, 360) }
      : {}),
    ...(isHexColor(design.textColor) ? { textColor: design.textColor } : {}),
    ...(isHexColor(design.accentColor)
      ? { accentColor: design.accentColor }
      : {}),
    ...(isHexColor(design.buttonColor)
      ? { buttonColor: design.buttonColor }
      : {}),
    ...(isHexColor(design.buttonTextColor)
      ? { buttonTextColor: design.buttonTextColor }
      : {}),
    ...(isHexColor(design.closeButtonColor)
      ? { closeButtonColor: design.closeButtonColor }
      : {}),
    ...(typeof design.fontSize === "number"
      ? { fontSize: clampInteger(design.fontSize, 11, 22) }
      : {}),
    ...(typeof design.borderRadius === "number"
      ? { borderRadius: clampInteger(design.borderRadius, 0, 999) }
      : {}),
    ...(typeof design.borderSize === "number"
      ? { borderSize: clampInteger(design.borderSize, 0, 8) }
      : {}),
    ...(isHexColor(design.borderColor)
      ? { borderColor: design.borderColor }
      : {}),
    ...(design.fontFamily === "THEME" ||
    design.fontFamily === "SYSTEM" ||
    design.fontFamily === "SERIF" ||
    design.fontFamily === "ROUNDED" ||
    design.fontFamily === "MONO" ||
    design.fontFamily === "GEOMETRIC" ||
    design.fontFamily === "HUMANIST" ||
    design.fontFamily === "CONDENSED" ||
    design.fontFamily === "CASUAL"
      ? { fontFamily: design.fontFamily }
      : {}),
    ...(typeof design.titleFontSize === "number"
      ? { titleFontSize: clampInteger(design.titleFontSize, 12, 48) }
      : {}),
    ...(isHexColor(design.titleColor) ? { titleColor: design.titleColor } : {}),
    ...(typeof design.subheadingFontSize === "number"
      ? { subheadingFontSize: clampInteger(design.subheadingFontSize, 10, 32) }
      : {}),
    ...(isHexColor(design.subheadingColor)
      ? { subheadingColor: design.subheadingColor }
      : {}),
    ...(typeof design.timerFontSize === "number"
      ? { timerFontSize: clampInteger(design.timerFontSize, 12, 72) }
      : {}),
    ...(isHexColor(design.timerColor) ? { timerColor: design.timerColor } : {}),
    ...(typeof design.legendFontSize === "number"
      ? { legendFontSize: clampInteger(design.legendFontSize, 10, 24) }
      : {}),
    ...(isHexColor(design.legendColor)
      ? { legendColor: design.legendColor }
      : {}),
    ...(typeof design.timerNumberFontSize === "number"
      ? { timerNumberFontSize: clampInteger(design.timerNumberFontSize, 12, 72) }
      : {}),
    ...(typeof design.timerLabelFontSize === "number"
      ? { timerLabelFontSize: clampInteger(design.timerLabelFontSize, 8, 28) }
      : {}),
    ...(typeof design.timerGap === "number"
      ? { timerGap: clampInteger(design.timerGap, 0, 32) }
      : {}),
    ...(typeof design.timerUnitGap === "number"
      ? { timerUnitGap: clampInteger(design.timerUnitGap, 0, 18) }
      : {}),
    ...(typeof design.timerPaddingBlock === "number"
      ? { timerPaddingBlock: clampInteger(design.timerPaddingBlock, 0, 32) }
      : {}),
    ...(typeof design.timerPaddingInline === "number"
      ? { timerPaddingInline: clampInteger(design.timerPaddingInline, 0, 40) }
      : {}),
    ...(design.timerStyle === "PLAIN" ||
    design.timerStyle === "GROUPED" ||
    design.timerStyle === "BOXES"
      ? { timerStyle: design.timerStyle }
      : {}),
    ...(design.timerFormat === "UNITS" || design.timerFormat === "COLON"
      ? { timerFormat: design.timerFormat }
      : {}),
    ...(typeof design.timerShowLabels === "boolean"
      ? { timerShowLabels: design.timerShowLabels }
      : {}),
    ...(typeof design.timerShowSeconds === "boolean"
      ? { timerShowSeconds: design.timerShowSeconds }
      : {}),
    ...(typeof design.timerDaysLabel === "string"
      ? { timerDaysLabel: design.timerDaysLabel.trim().slice(0, 12) || "Days" }
      : {}),
    ...(typeof design.timerHoursLabel === "string"
      ? { timerHoursLabel: design.timerHoursLabel.trim().slice(0, 12) || "Hrs" }
      : {}),
    ...(typeof design.timerMinutesLabel === "string"
      ? {
          timerMinutesLabel:
            design.timerMinutesLabel.trim().slice(0, 12) || "Mins",
        }
      : {}),
    ...(typeof design.timerSecondsLabel === "string"
      ? {
          timerSecondsLabel:
            design.timerSecondsLabel.trim().slice(0, 12) || "Secs",
        }
      : {}),
    ...(typeof design.timerHideZeroDays === "boolean"
      ? { timerHideZeroDays: design.timerHideZeroDays }
      : {}),
    ...(isHexColor(design.timerSurfaceColor)
      ? { timerSurfaceColor: design.timerSurfaceColor }
      : {}),
    ...(isHexColor(design.timerSurfaceBorderColor)
      ? { timerSurfaceBorderColor: design.timerSurfaceBorderColor }
      : {}),
    ...(typeof design.timerSurfaceBorderSize === "number"
      ? {
          timerSurfaceBorderSize: clampInteger(
            design.timerSurfaceBorderSize,
            0,
            6,
          ),
        }
      : {}),
    ...(typeof design.timerSurfaceRadius === "number"
      ? { timerSurfaceRadius: clampInteger(design.timerSurfaceRadius, 0, 40) }
      : {}),
    ...(typeof design.paddingBlock === "number"
      ? { paddingBlock: clampInteger(design.paddingBlock, 4, 48) }
      : {}),
    ...(typeof design.paddingInline === "number"
      ? { paddingInline: clampInteger(design.paddingInline, 8, 64) }
      : {}),
    ...(typeof design.contentGap === "number"
      ? { contentGap: clampInteger(design.contentGap, 0, 32) }
      : {}),
    ...(typeof design.contentMaxWidth === "number"
      ? { contentMaxWidth: clampInteger(design.contentMaxWidth, 280, 1440) }
      : {}),
    ...(typeof design.fullWidth === "boolean"
      ? { fullWidth: design.fullWidth }
      : {}),
    ...(design.positionMode === "FLOW" || design.positionMode === "OVERLAY"
      ? { positionMode: design.positionMode }
      : {}),
    ...(typeof design.positionSticky === "boolean"
      ? { positionSticky: design.positionSticky }
      : {}),
    ...(design.entranceAnimation === "NONE" ||
    design.entranceAnimation === "FADE" ||
    design.entranceAnimation === "SLIDE" ||
    design.entranceAnimation === "POP"
      ? { entranceAnimation: design.entranceAnimation }
      : {}),
    ...(design.exitAnimation === "NONE" ||
    design.exitAnimation === "FADE" ||
    design.exitAnimation === "SLIDE" ||
    design.exitAnimation === "POP"
      ? { exitAnimation: design.exitAnimation }
      : {}),
    ...(typeof design.animationDurationMs === "number"
      ? {
          animationDurationMs: clampInteger(
            design.animationDurationMs,
            0,
            1500,
          ),
        }
      : {}),
    ...(design.timerTickAnimation === "NONE" ||
    design.timerTickAnimation === "FADE" ||
    design.timerTickAnimation === "FLIP" ||
    design.timerTickAnimation === "PULSE"
      ? { timerTickAnimation: design.timerTickAnimation }
      : {}),
    ...(typeof design.mobileEnabled === "boolean"
      ? { mobileEnabled: design.mobileEnabled }
      : {}),
    ...(typeof design.customCss === "string"
      ? { customCss: design.customCss.slice(0, 500) }
      : {}),
    ...(design.alignment === "LEFT" ||
    design.alignment === "CENTER" ||
    design.alignment === "RIGHT"
      ? { alignment: design.alignment }
      : {}),
    ...(typeof design.showCloseButton === "boolean"
      ? { showCloseButton: design.showCloseButton }
      : {}),
    ...(typeof design.showButton === "boolean"
      ? { showButton: design.showButton }
      : {}),
    ...(typeof design.showProgressBar === "boolean"
      ? { showProgressBar: design.showProgressBar }
      : {}),
    ...(typeof design.showIcon === "boolean"
      ? { showIcon: design.showIcon }
      : {}),
    ...(design.icon === "FIRE" ||
    design.icon === "CLOCK" ||
    design.icon === "TRUCK" ||
    design.icon === "GIFT" ||
    design.icon === "TAG" ||
    design.icon === "STAR" ||
    design.icon === "BOLT" ||
    design.icon === "HEART" ||
    design.icon === "CART" ||
    design.icon === "PERCENT" ||
    design.icon === "BELL" ||
    design.icon === "ROCKET" ||
    design.icon === "CHECK" ||
    design.icon === "CUSTOM" ||
    design.icon === "NONE"
      ? { icon: design.icon }
      : {}),
    ...(typeof design.iconSize === "number"
      ? { iconSize: clampInteger(design.iconSize, 12, 64) }
      : {}),
    ...(typeof design.customIconUrl === "string"
      ? { customIconUrl: design.customIconUrl.slice(0, 150_000) }
      : {}),
  };
}

function omitPresetVisualOverrides(
  design: Partial<CampaignDesignValues>,
): Partial<CampaignDesignValues> {
  const rest = { ...design };

  delete rest.backgroundType;
  delete rest.backgroundColor;
  delete rest.backgroundImageUrl;
  delete rest.gradientStartColor;
  delete rest.gradientEndColor;
  delete rest.gradientAngle;
  delete rest.textColor;
  delete rest.accentColor;
  delete rest.buttonColor;
  delete rest.buttonTextColor;
  delete rest.closeButtonColor;
  delete rest.borderColor;
  delete rest.titleColor;
  delete rest.subheadingColor;
  delete rest.timerColor;
  delete rest.legendColor;
  delete rest.timerSurfaceColor;
  delete rest.timerSurfaceBorderColor;

  return rest;
}

function isHexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function isSafeImageUrl(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

function isAssetPlaceholder(value: string) {
  return /^\{\{asset:[a-zA-Z0-9_-]+\}\}$/.test(value.trim());
}

function sanitizeWeight(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return clampInteger(value, 1, 10000);
}

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function isValidStorefrontUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isCampaignGoal(value: unknown): value is CampaignGoalValue {
  return campaignGoalOptions.some((option) => option.value === value);
}

function isCampaignType(value: unknown): value is CampaignTypeValue {
  return [
    "COUNTDOWN_BAR",
    "PRODUCT_TIMER",
    "CART_TIMER",
    "FREE_SHIPPING_GOAL",
    "DELIVERY_CUTOFF",
    "LOW_STOCK",
    "PRODUCT_BADGE",
  ].includes(String(value));
}

function isPlacementType(value: unknown): value is PlacementTypeValue {
  return [
    "TOP_BAR",
    "BOTTOM_BAR",
    "PRODUCT_PAGE",
    "PRODUCT_PAGE_BADGE",
    "COLLECTION_CARD",
    "CART_PAGE",
    "CART_DRAWER",
    "THANK_YOU_PAGE",
    "ORDER_STATUS_PAGE",
    "CUSTOM_SELECTOR",
  ].includes(String(value));
}

function sanitizePlacementTypes(
  value: unknown,
  fallback: PlacementTypeValue[],
) {
  if (!Array.isArray(value)) return fallback;

  const placementTypes = value.filter(isPlacementType);
  const uniquePlacementTypes = [...new Set(placementTypes)];

  return uniquePlacementTypes.length > 0 ? uniquePlacementTypes : fallback;
}

function isTimerMode(value: unknown): value is CampaignTimerModeValue {
  return ["FIXED_DATE", "EVERGREEN_SESSION", "RECURRING_DAILY"].includes(
    String(value),
  );
}

function isTimerResetBehavior(
  value: unknown,
): value is CampaignTimerResetBehaviorValue {
  return ["NEVER", "ON_SESSION_END", "DAILY", "WEEKLY"].includes(String(value));
}

function isTimerExpiredBehavior(
  value: unknown,
): value is CampaignTimerExpiredBehaviorValue {
  return [
    "UNPUBLISH_TIMER",
    "HIDE_TIMER",
    "REPEAT_COUNTDOWN",
    "SHOW_CUSTOM_TITLE",
    "DO_NOTHING",
  ].includes(String(value));
}

function isProductSelection(value: unknown): value is ProductSelectionValue {
  return productSelectionOptions.includes(value as ProductSelectionValue);
}

function isCountrySelection(value: unknown): value is CountrySelectionValue {
  return countrySelectionOptions.includes(value as CountrySelectionValue);
}

function isDiscountMode(value: unknown): value is DiscountModeValue {
  return discountModeOptions.some((option) => option.value === value);
}

function isDiscountValueType(value: unknown): value is DiscountValueTypeValue {
  return discountValueTypeOptions.some((option) => option.value === value);
}

function sanitizePlainList(
  value: unknown,
  maxItems: number,
  maxLength: number,
) {
  if (!Array.isArray(value)) return [];

  return uniqueStrings(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, maxLength))
      .filter(Boolean),
  ).slice(0, maxItems);
}

function sanitizeIdList(value: unknown) {
  return sanitizePlainList(value, 50, 180).filter(
    (item) =>
      item.startsWith("gid://shopify/") || /^[A-Za-z0-9_:/.-]+$/.test(item),
  );
}

function sanitizeCountryList(value: unknown, fallback: string[]) {
  const countries = sanitizePlainList(value, 50, 2)
    .map((country) => country.toUpperCase())
    .filter((country) => /^[A-Z]{2}$/.test(country));

  return countries.length > 0 ? countries : fallback;
}

function sanitizeHolidayList(value: unknown) {
  return sanitizePlainList(value, 80, 10).filter((item) =>
    /^\d{4}-\d{2}-\d{2}$/.test(item),
  );
}

function sanitizeWorkingDays(value: unknown, fallback: number[]) {
  if (!Array.isArray(value)) return fallback;

  const workingDays = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);
  const uniqueWorkingDays = [...new Set(workingDays)];

  return uniqueWorkingDays.length > 0 ? uniqueWorkingDays : fallback;
}

function sanitizeJsonObject(value: unknown, fallback: Record<string, unknown>) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fallback;
}

function sanitizeShortSettingText(
  value: unknown,
  fallback: string,
  maxLength: number,
) {
  const text = typeof value === "string" ? value.trim() : "";

  return text ? truncateText(text, maxLength) : fallback;
}

function sanitizeNumberString(
  value: unknown,
  fallback: string,
  min: number,
  max: number,
) {
  const number = Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(number) || number < min || number > max) {
    return fallback;
  }

  return number % 1 === 0 ? String(number) : number.toFixed(2);
}

function sanitizeOptionalNumberString(
  value: unknown,
  fallback: string,
  min: number,
  max: number,
) {
  if (value === "" || value === undefined || value === null) return "";

  return sanitizeNumberString(value, fallback, min, max);
}

function sanitizeOptionalIntegerString(
  value: unknown,
  fallback: string,
  min: number,
  max: number,
) {
  const number = Number(value);

  if (!Number.isFinite(number) || !Number.isInteger(number)) {
    return fallback;
  }

  return String(clampInteger(number, min, max));
}

function sanitizeCurrencyCode(value: unknown, fallback: string) {
  const currencyCode =
    typeof value === "string" ? value.trim().toUpperCase() : "";

  return /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : fallback;
}

function sanitizeDiscountCode(value: unknown, fallback: string) {
  const code =
    typeof value === "string"
      ? value
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_-]+/g, "")
          .slice(0, 40)
      : "";

  return code.length >= 3 ? code : fallback;
}

function sanitizeUniqueCodePrefix(value: unknown, fallback: string) {
  const prefix =
    typeof value === "string"
      ? value
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_-]+/g, "")
          .slice(0, 16)
      : "";

  return prefix.length >= 2 ? prefix : fallback;
}

function isDateTimeLocalString(value: unknown) {
  return (
    typeof value === "string" &&
    (value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
  );
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength).trim() : value;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function readString(formData: FormData, key: keyof CampaignAiInput) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return normalizeStringArray(parsed, 20, 120);
  } catch {
    return [];
  }
}

function readLocales(formData: FormData, key: string) {
  const locales = formData.getAll(key).map(String);
  if (locales.length === 0) return [];

  return getStorefrontLocaleOptions(locales).map(
    (localeOption) => localeOption.locale,
  );
}

function readAnswerMap(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) return {};

  try {
    return normalizeAnswerMap(JSON.parse(value));
  } catch {
    return {};
  }
}
