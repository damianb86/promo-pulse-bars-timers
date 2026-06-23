import {
  campaignTranslationFields,
  createEmptyCampaignTranslationsByLocale,
  emptyCampaignTranslationValues,
  storefrontLocales,
  translationFallbackInputName,
  translationInputName,
  type CampaignTextField,
  type CampaignTranslationValues,
  type CampaignTranslationsByLocale,
  type StorefrontLocale,
} from "../../types/localization";

type CampaignTranslationAiProviderOutput = Partial<
  Record<StorefrontLocale, Partial<CampaignTranslationValues>>
>;

export type CampaignTranslationAiProvider = {
  source: "mock" | "provider";
  translate(
    input: CampaignTranslationAiInput,
  ): Promise<CampaignTranslationAiProviderOutput>;
};

export type CampaignTranslationAiInput = {
  sourceLocale: StorefrontLocale;
  sourceValues: CampaignTranslationValues;
  values: CampaignTranslationsByLocale;
};

export type ParsedCampaignTranslationAiForm = {
  errors: { form?: string };
  input: CampaignTranslationAiInput;
};

type CampaignTranslationGenerationOptions = {
  provider?: CampaignTranslationAiProvider;
};

const translatableFields = campaignTranslationFields
  .map((field) => field.key)
  .filter((field): field is Exclude<CampaignTextField, "ctaUrl"> => {
    return field !== "ctaUrl";
  });

const localeLabels = new Map(
  storefrontLocales.map((localeOption) => [
    localeOption.locale,
    localeOption.label,
  ]),
);

export function parseCampaignTranslationAiFormData(
  formData: FormData,
): ParsedCampaignTranslationAiForm {
  const sourceLocale = readStorefrontLocale(formData.get("sourceLocale"));
  const values = createEmptyCampaignTranslationsByLocale();
  const sourceValues = { ...emptyCampaignTranslationValues };

  for (const localeOption of storefrontLocales) {
    for (const field of campaignTranslationFields) {
      const value = readString(
        formData,
        translationInputName(localeOption.locale, field.key),
      );

      values[localeOption.locale][field.key] = value;

      if (localeOption.locale === sourceLocale) {
        sourceValues[field.key] =
          value ||
          readString(
            formData,
            translationFallbackInputName(localeOption.locale, field.key),
          );
      }
    }
  }

  const hasSourceCopy = translatableFields.some((field) =>
    sourceValues[field].trim(),
  );

  return {
    errors: hasSourceCopy
      ? {}
      : {
          form: `Add source copy in ${localeLabels.get(sourceLocale) ?? sourceLocale} before translating.`,
        },
    input: {
      sourceLocale,
      sourceValues,
      values,
    },
  };
}

export async function generateCampaignTranslationSuggestions(
  input: CampaignTranslationAiInput,
  options: CampaignTranslationGenerationOptions = {},
): Promise<{
  source: CampaignTranslationAiProvider["source"];
  translations: CampaignTranslationsByLocale;
}> {
  const provider =
    options.provider ?? getDefaultCampaignTranslationAiProvider();
  const output = await provider.translate(input);

  return {
    source: provider.source,
    translations: sanitizeTranslationOutput(input, output),
  };
}

export function createMockCampaignTranslationAiProvider(): CampaignTranslationAiProvider {
  return {
    source: "mock",
    async translate(input) {
      return storefrontLocales.reduce((translations, localeOption) => {
        translations[localeOption.locale] = {
          ...input.sourceValues,
          ctaUrl: input.sourceValues.ctaUrl,
        };
        return translations;
      }, {} as CampaignTranslationAiProviderOutput);
    },
  };
}

function getDefaultCampaignTranslationAiProvider(): CampaignTranslationAiProvider {
  if (
    process.env.E2E_TEST_MODE === "true" ||
    process.env.PROMO_PULSE_AI_PROVIDER !== "openai" ||
    !process.env.OPENAI_API_KEY
  ) {
    return createMockCampaignTranslationAiProvider();
  }

  return createOpenAiCampaignTranslationProvider(process.env.OPENAI_API_KEY);
}

function createOpenAiCampaignTranslationProvider(
  apiKey: string,
): CampaignTranslationAiProvider {
  return {
    source: "provider",
    async translate(input) {
      return requestOpenAiTranslationJson(apiKey, input);
    },
  };
}

async function requestOpenAiTranslationJson(
  apiKey: string,
  input: CampaignTranslationAiInput,
): Promise<CampaignTranslationAiProviderOutput> {
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
      model: process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-5.4-nano",
      input: [
        {
          role: "system",
          content:
            "You are an ecommerce localization assistant. Translate promotional campaign UI copy faithfully. Return only valid JSON.",
        },
        {
          role: "user",
          content: buildTranslationPrompt(input),
        },
      ],
      text: {
        format: { type: "json_object" },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI translation provider returned ${response.status}`);
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
    throw new Error("OpenAI translation provider returned no JSON text.");
  }

  const parsed = JSON.parse(text) as {
    translations?: CampaignTranslationAiProviderOutput;
  };

  if (!parsed.translations || typeof parsed.translations !== "object") {
    throw new Error(
      "OpenAI translation provider returned an unsupported JSON shape.",
    );
  }

  return parsed.translations;
}

function buildTranslationPrompt(input: CampaignTranslationAiInput) {
  const localeInstructions = storefrontLocales
    .map((localeOption) => {
      const dialect =
        localeOption.locale === "en"
          ? "Use United States English, not UK English."
          : localeOption.locale === "pt-BR"
            ? "Use Brazilian Portuguese."
            : `Use ${localeOption.label}.`;

      return `- ${localeOption.locale}: ${dialect}`;
    })
    .join("\n");
  const fieldInstructions = campaignTranslationFields
    .map((field) => `- ${field.key}: ${field.label}`)
    .join("\n");

  return [
    "Translate the source campaign copy into every target locale in one response.",
    "Do not add discounts, scarcity, guarantees, product claims, or urgency that is not present in the source.",
    "Preserve numbers, currency, coupon codes, brand names, product names, placeholders, and template variables exactly.",
    "Keep ctaUrl exactly the same string for every locale.",
    'Return this exact JSON shape: {"translations":{"en":{"headline":"..."}}}.',
    "",
    `Source locale: ${input.sourceLocale}`,
    "Locales:",
    localeInstructions,
    "",
    "Fields:",
    fieldInstructions,
    "",
    "Source values:",
    JSON.stringify(input.sourceValues, null, 2),
  ].join("\n");
}

function sanitizeTranslationOutput(
  input: CampaignTranslationAiInput,
  output: CampaignTranslationAiProviderOutput,
): CampaignTranslationsByLocale {
  const translations = createEmptyCampaignTranslationsByLocale();

  for (const localeOption of storefrontLocales) {
    const locale = localeOption.locale;
    const rawTranslation = output[locale] ?? {};
    const fallback =
      locale === input.sourceLocale ? input.values[locale] : input.sourceValues;

    translations[locale] = campaignTranslationFields.reduce((values, field) => {
      values[field.key] =
        field.key === "ctaUrl"
          ? input.sourceValues.ctaUrl
          : sanitizeText(rawTranslation[field.key], fallback[field.key]);
      return values;
    }, {} as CampaignTranslationValues);
  }

  translations[input.sourceLocale] = {
    ...input.values[input.sourceLocale],
    ctaUrl: input.sourceValues.ctaUrl,
  };

  return translations;
}

function sanitizeText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  const resolved = text || fallback;

  return resolved.slice(0, 500);
}

function readStorefrontLocale(value: FormDataEntryValue | null) {
  const locale = String(value ?? "").trim();

  return storefrontLocales.some(
    (localeOption) => localeOption.locale === locale,
  )
    ? (locale as StorefrontLocale)
    : "en";
}

function readString(formData: FormData, key: string) {
  const values = formData.getAll(key);
  const value = values.length > 0 ? values[values.length - 1] : "";

  return typeof value === "string" ? value.trim() : "";
}
