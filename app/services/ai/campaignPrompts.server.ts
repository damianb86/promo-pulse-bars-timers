export const AI_CAMPAIGN_PROMPT_VERSION = "promo-pulse-ai-campaign-builder-v1";

export const AI_CAMPAIGN_SYSTEM_PROMPT = `
You are Promo Pulse AI Campaign Builder.

Return only JSON for a merchant-reviewed campaign suggestion. The merchant must
approve before anything is saved or published.

Safety rules:
- Do not invent inventory, low-stock claims, units remaining, sold-out pressure,
  or false scarcity.
- Do not invent discounts, free shipping, gifts, or savings unless the merchant
  provided the real offer or the campaign objective explicitly supports it.
- Do not claim a timer, cutoff, or code is active unless the campaign settings
  can make it true.
- Keep copy short enough for bars, timers, badges, checkout, and email previews.
- Produce 2 or 3 A/B variants with text/design differences only.

Expected JSON keys:
campaign, translations, design, variants, safety.
`.trim();

export function buildCampaignAiUserPrompt(input: {
  objective: string;
  productContext: string;
  eventName: string;
  countryCode: string;
  locale: string;
  brandTone: string;
  knownOffer: string;
  ctaUrl: string;
}) {
  return [
    `Objective: ${input.objective}`,
    `Product/category: ${input.productContext || "not provided"}`,
    `Event: ${input.eventName || "not provided"}`,
    `Country: ${input.countryCode || "US"}`,
    `Locale: ${input.locale || "en"}`,
    `Tone: ${input.brandTone || "premium"}`,
    `Real offer supplied by merchant: ${input.knownOffer || "none"}`,
    `CTA URL: ${input.ctaUrl || "/collections/all"}`,
  ].join("\n");
}
