import { defaultCampaignDesignValues } from "../../types/campaign-design";
import type { CampaignDesignValues } from "../../types/campaign-design";
import {
  campaignGoalOptions,
  getDefaultPlacementForCampaignType,
  type CampaignGoalValue,
  type CampaignTypeValue,
  type PlacementTypeValue,
} from "../../types/campaign-options";
import {
  campaignAiTones,
  type CampaignAiFormErrors,
  type CampaignAiInput,
  type CampaignAiTone,
  type CampaignAiTranslation,
  type CampaignAiVariant,
  type CampaignSuggestion,
  type CampaignSuggestionCampaign,
  type CampaignSuggestionSource,
} from "../../types/ai-campaign";
import {
  campaignTranslationFields,
  emptyCampaignTranslationValues,
  storefrontLocales,
  type StorefrontLocale,
} from "../../types/localization";
import { normalizeStorefrontLocale } from "../../utils/campaign-localization";
import {
  AI_CAMPAIGN_PROMPT_VERSION,
  AI_CAMPAIGN_SYSTEM_PROMPT,
  buildCampaignAiUserPrompt,
} from "./campaignPrompts.server";

type CampaignAiProviderOutput = {
  campaign?: Partial<CampaignSuggestionCampaign>;
  translations?: Partial<
    Record<StorefrontLocale, Partial<CampaignAiTranslation>>
  >;
  design?: Partial<CampaignDesignValues>;
  variants?: Array<Partial<CampaignAiVariant>>;
  safety?: Partial<CampaignSuggestion["safety"]>;
};

export type CampaignAiProvider = {
  source: CampaignSuggestionSource;
  generateCampaignSuggestion(
    input: CampaignAiInput,
  ): Promise<CampaignAiProviderOutput>;
  generateTranslations?(
    input: CampaignAiInput,
    campaign: CampaignSuggestionCampaign,
  ): Promise<CampaignAiProviderOutput["translations"]>;
  generateExperimentVariants?(
    input: CampaignAiInput,
    campaign: CampaignSuggestionCampaign,
  ): Promise<CampaignAiProviderOutput["variants"]>;
};

type CampaignAiGenerationOptions = {
  provider?: CampaignAiProvider;
};

type CampaignAiInputLike = Partial<
  Omit<CampaignAiInput, "brandTone" | "locale" | "objective">
> & {
  brandTone?: string | null;
  locale?: string | null;
  objective?: string | null;
};

const defaultInput: CampaignAiInput = {
  objective: "FLASH_SALE",
  productContext: "",
  eventName: "",
  countryCode: "US",
  locale: "en",
  brandTone: "premium",
  knownOffer: "",
  ctaUrl: "/collections/all",
};

const stockClaimPatterns = [
  /\bonly\s+\d+\s+(left|remaining|in stock|available)\b/i,
  /\b(low|limited)\s+stock\b/i,
  /\balmost\s+gone\b/i,
  /\bselling\s+out\b/i,
  /\blast\s+(units|pieces|items)\b/i,
  /\bwhile\s+supplies\s+last\b/i,
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

const openAiJsonKeys = ["campaign", "translations", "design", "variants"];

export function buildDefaultCampaignAiInput(
  overrides: CampaignAiInputLike = {},
): CampaignAiInput {
  return normalizeCampaignAiInput({ ...defaultInput, ...overrides });
}

export function parseCampaignAiFormData(formData: FormData): {
  values: CampaignAiInput;
  errors: CampaignAiFormErrors;
} {
  const values = normalizeCampaignAiInput({
    objective: readString(formData, "objective") || defaultInput.objective,
    productContext: readString(formData, "productContext"),
    eventName: readString(formData, "eventName"),
    countryCode:
      readString(formData, "countryCode") || defaultInput.countryCode,
    locale: readString(formData, "locale") || defaultInput.locale,
    brandTone: readString(formData, "brandTone") || defaultInput.brandTone,
    knownOffer: readString(formData, "knownOffer"),
    ctaUrl: readString(formData, "ctaUrl") || defaultInput.ctaUrl,
  });

  const errors: CampaignAiFormErrors = {};

  if (!values.productContext) {
    errors.productContext = "Product or category is required.";
  }

  if (!isValidStorefrontUrl(values.ctaUrl)) {
    errors.ctaUrl =
      "Target URL must be a storefront path or a valid absolute URL.";
  }

  return { values, errors };
}

export function hasCampaignAiFormErrors(errors: CampaignAiFormErrors) {
  return Object.values(errors).some(Boolean);
}

export async function generateCampaignSuggestion(
  input: CampaignAiInput,
  options: CampaignAiGenerationOptions = {},
): Promise<CampaignSuggestion> {
  const normalizedInput = normalizeCampaignAiInput(input);
  const provider = options.provider ?? getDefaultCampaignAiProvider();
  const output = await provider.generateCampaignSuggestion(normalizedInput);
  const suggestion = completeCampaignSuggestion(
    normalizedInput,
    output,
    provider.source,
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
        translations: parsed.translations,
        design: parsed.design,
        variants: parsed.variants,
        safety: parsed.safety,
      },
      parsed.source === "provider" ? "provider" : "mock",
    );

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
    async generateCampaignSuggestion(input) {
      try {
        return await requestOpenAiJson(apiKey, input);
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
): Promise<CampaignAiProviderOutput> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        { role: "system", content: AI_CAMPAIGN_SYSTEM_PROMPT },
        { role: "user", content: buildCampaignAiUserPrompt(input) },
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

  const parsed = JSON.parse(text) as CampaignAiProviderOutput;
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
): CampaignSuggestion {
  const fallback = buildMockCampaignSuggestion(input);
  const campaign = mergeCampaign(fallback.campaign, output.campaign);

  return {
    promptVersion: AI_CAMPAIGN_PROMPT_VERSION,
    source,
    input,
    campaign,
    translations: mergeTranslations(
      buildTranslations(input, campaign),
      output.translations ?? {},
    ),
    design: sanitizeDesign({ ...fallback.design, ...output.design }),
    variants:
      output.variants && output.variants.length > 0
        ? output.variants.map((variant, index) =>
            mergeVariant(
              fallback.variants[index] ?? fallback.variants[0],
              variant,
            ),
          )
        : fallback.variants,
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
    input,
    campaign,
    translations: buildTranslations(input, campaign),
    design: buildDesign(input),
    variants: buildVariants(input, campaign),
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
  const offer = input.knownOffer.trim();
  const withOffer = Boolean(offer);
  const prefix = getTonePrefix(input.brandTone);
  const headline = withOffer
    ? `${offer} on ${product}`
    : `${prefix}${event} for ${product}`;
  const subheadline = withOffer
    ? `${event} is live. Review the offer details before publishing.`
    : "Use your real campaign settings to keep this message accurate.";

  return {
    goal: input.objective,
    type: campaignType,
    placementType: getDefaultPlacementForCampaignType(campaignType),
    name: `${event} - ${product}`.slice(0, 80),
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
  const offer = input.knownOffer.trim();
  const event = input.eventName || "this promotion";
  const hasOffer = Boolean(offer);

  return {
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
}

function buildDesign(input: CampaignAiInput): CampaignDesignValues {
  if (input.objective === "FREE_SHIPPING") {
    return {
      ...defaultCampaignDesignValues,
      templateKey: "free-shipping",
      backgroundColor: "#ECFDF5",
      textColor: "#064E3B",
      accentColor: "#10B981",
      buttonColor: "#047857",
      buttonTextColor: "#FFFFFF",
      borderRadius: 8,
      showIcon: true,
      icon: "TRUCK",
    };
  }

  if (input.objective === "DELIVERY_CUTOFF") {
    return {
      ...defaultCampaignDesignValues,
      templateKey: "delivery-cutoff",
      backgroundColor: "#EFF6FF",
      textColor: "#1E3A8A",
      accentColor: "#2563EB",
      buttonColor: "#2563EB",
      buttonTextColor: "#FFFFFF",
      borderRadius: 6,
      showIcon: true,
      icon: "CLOCK",
    };
  }

  if (input.brandTone === "luxury") {
    return {
      ...defaultCampaignDesignValues,
      templateKey: "premium-dark",
      backgroundColor: "#111827",
      textColor: "#F9FAFB",
      accentColor: "#D4AF37",
      buttonColor: "#F9FAFB",
      buttonTextColor: "#111827",
      borderRadius: 6,
      showIcon: true,
      icon: "GIFT",
    };
  }

  if (input.brandTone === "urgent") {
    return {
      ...defaultCampaignDesignValues,
      templateKey: "flash-sale",
      backgroundColor: "#7F1D1D",
      textColor: "#FFFFFF",
      accentColor: "#FDE047",
      buttonColor: "#FFFFFF",
      buttonTextColor: "#7F1D1D",
      fontSize: 15,
      borderRadius: 6,
      positionSticky: true,
      showIcon: true,
      icon: "FIRE",
    };
  }

  if (input.brandTone === "playful") {
    return {
      ...defaultCampaignDesignValues,
      templateKey: "holiday",
      backgroundColor: "#F0FDF4",
      textColor: "#14532D",
      accentColor: "#DC2626",
      buttonColor: "#166534",
      buttonTextColor: "#FFFFFF",
      borderRadius: 8,
      showIcon: true,
      icon: "GIFT",
    };
  }

  return {
    ...defaultCampaignDesignValues,
    templateKey:
      input.brandTone === "minimal" ? "clean-minimal" : "premium-dark",
    backgroundColor: input.brandTone === "minimal" ? "#FFFFFF" : "#111827",
    textColor: input.brandTone === "minimal" ? "#111827" : "#F9FAFB",
    accentColor: input.brandTone === "minimal" ? "#2563EB" : "#A78BFA",
    buttonColor: input.brandTone === "minimal" ? "#111827" : "#F9FAFB",
    buttonTextColor: input.brandTone === "minimal" ? "#FFFFFF" : "#111827",
    borderRadius: input.brandTone === "minimal" ? 4 : 8,
    showIcon: input.brandTone !== "minimal",
    icon: input.brandTone === "minimal" ? "NONE" : "TAG",
  };
}

function buildVariants(
  input: CampaignAiInput,
  campaign: CampaignSuggestionCampaign,
): CampaignAiVariant[] {
  const offer = input.knownOffer.trim();
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
  const variants = sanitizeVariants(
    suggestion.input,
    suggestion.variants,
    buildVariants(suggestion.input, campaign),
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
    design: sanitizeDesign(suggestion.design),
    variants,
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

  return {
    ...campaign,
    goal: isCampaignGoal(campaign.goal) ? campaign.goal : fallback.goal,
    type: isCampaignType(campaign.type) ? campaign.type : fallback.type,
    placementType: isPlacementType(campaign.placementType)
      ? campaign.placementType
      : fallback.placementType,
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

function sanitizeTranslations(
  input: CampaignAiInput,
  translations: CampaignSuggestion["translations"],
  blockedClaims: string[],
): CampaignSuggestion["translations"] {
  const fallback = buildTranslations(input, buildCampaign(input));

  return storefrontLocales.reduce(
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
      designOverride: sanitizePartialDesign(
        variant.designOverride ?? base.designOverride,
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

  if (stockClaimPatterns.some((pattern) => pattern.test(text))) {
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
  return storefrontLocales.reduce(
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

function mergeVariant(
  fallback: CampaignAiVariant,
  override: Partial<CampaignAiVariant>,
): CampaignAiVariant {
  return {
    ...fallback,
    ...override,
    designOverride: {
      ...(fallback.designOverride ?? {}),
      ...(override.designOverride ?? {}),
    },
  };
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
    ctaUrl: values.ctaUrl,
  };
}

function normalizeCampaignAiInput(input: CampaignAiInputLike): CampaignAiInput {
  const normalizedLocale =
    normalizeStorefrontLocale(input.locale ?? "en") ?? "en";
  const tone = campaignAiTones.includes(input.brandTone as CampaignAiTone)
    ? (input.brandTone as CampaignAiTone)
    : "premium";
  const objective = isCampaignGoal(input.objective)
    ? input.objective
    : defaultInput.objective;

  return {
    objective,
    productContext: normalizeTextInput(input.productContext, 90),
    eventName: normalizeTextInput(input.eventName, 80),
    countryCode: normalizeCountry(input.countryCode),
    locale: normalizedLocale,
    brandTone: tone,
    knownOffer: normalizeTextInput(input.knownOffer, 120),
    ctaUrl: normalizeTextInput(input.ctaUrl, 180) || defaultInput.ctaUrl,
  };
}

function normalizeTextInput(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeCountry(value: unknown) {
  const country = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{2}$/.test(country) ? country : defaultInput.countryCode;
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

function getTonePrefix(tone: CampaignAiTone) {
  if (tone === "urgent") return "Limited-time ";
  if (tone === "playful") return "Fresh ";
  if (tone === "minimal") return "";
  if (tone === "luxury") return "Private ";
  return "Premium ";
}

function getCtaText(input: CampaignAiInput) {
  if (input.knownOffer.trim()) return "Shop offer";
  if (input.objective === "FREE_SHIPPING") return "Continue shopping";
  if (input.objective === "DELIVERY_CUTOFF") return "View delivery details";
  return "View details";
}

function allowsDiscountClaims(input: CampaignAiInput) {
  return (
    Boolean(input.knownOffer.trim()) || input.objective === "FREE_SHIPPING"
  );
}

function sanitizeDesign(
  design: Partial<CampaignDesignValues>,
): CampaignDesignValues {
  return {
    ...defaultCampaignDesignValues,
    ...sanitizePartialDesign(design),
  };
}

function sanitizePartialDesign(
  design: Partial<CampaignDesignValues> | undefined,
): Partial<CampaignDesignValues> {
  if (!design || typeof design !== "object") return {};

  return {
    ...(typeof design.templateKey === "string"
      ? { templateKey: design.templateKey.slice(0, 80) }
      : {}),
    ...(design.layout === "STANDARD" ||
    design.layout === "BALANCED" ||
    design.layout === "INLINE" ||
    design.layout === "CTA_RIGHT" ||
    design.layout === "CTA_LEFT" ||
    design.layout === "CTA_TOP"
      ? { layout: design.layout }
      : {}),
    ...(design.backgroundType === "SOLID" ||
    design.backgroundType === "GRADIENT"
      ? { backgroundType: design.backgroundType }
      : {}),
    ...(isHexColor(design.backgroundColor)
      ? { backgroundColor: design.backgroundColor }
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
    ...(typeof design.fontSize === "number"
      ? { fontSize: clampInteger(design.fontSize, 11, 22) }
      : {}),
    ...(typeof design.borderRadius === "number"
      ? { borderRadius: clampInteger(design.borderRadius, 0, 24) }
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
    ...(typeof design.fullWidth === "boolean"
      ? { fullWidth: design.fullWidth }
      : {}),
    ...(design.positionMode === "FLOW" || design.positionMode === "OVERLAY"
      ? { positionMode: design.positionMode }
      : {}),
    ...(typeof design.positionSticky === "boolean"
      ? { positionSticky: design.positionSticky }
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
    ...(typeof design.showIcon === "boolean"
      ? { showIcon: design.showIcon }
      : {}),
    ...(design.icon === "FIRE" ||
    design.icon === "CLOCK" ||
    design.icon === "TRUCK" ||
    design.icon === "GIFT" ||
    design.icon === "TAG" ||
    design.icon === "CUSTOM" ||
    design.icon === "NONE"
      ? { icon: design.icon }
      : {}),
    ...(typeof design.customIconUrl === "string"
      ? { customIconUrl: design.customIconUrl.slice(0, 150_000) }
      : {}),
  };
}

function isHexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
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
    "COLLECTION_CARD",
    "CART_PAGE",
    "CART_DRAWER",
    "THANK_YOU_PAGE",
    "ORDER_STATUS_PAGE",
    "PASSWORD_PAGE",
    "CUSTOM_SELECTOR",
  ].includes(String(value));
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
