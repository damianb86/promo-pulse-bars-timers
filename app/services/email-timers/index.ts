import type { PremiumFeatureKey } from "../../types/stage2";

export type EmailTimerRenderMode = "png" | "gif" | "svg_fallback";

export type EmailTimerRequest = {
  campaignId: string;
  locale: string;
  expiresAt: string;
  renderMode: EmailTimerRenderMode;
};

export const emailTimerPremiumFeatures = [
  "EMAIL_TIMERS",
] satisfies PremiumFeatureKey[];
