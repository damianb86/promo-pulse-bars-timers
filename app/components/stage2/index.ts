import type { PremiumFeatureKey } from "../../types/stage2";

export type Stage2ComponentSlot =
  | "campaign_editor_panel"
  | "analytics_panel"
  | "dashboard_widget"
  | "settings_panel";

export type Stage2ComponentRegistration = {
  featureKey: PremiumFeatureKey;
  slot: Stage2ComponentSlot;
  label: string;
};
