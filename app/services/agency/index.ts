import type { PremiumFeatureKey } from "../../types/stage2";

export type AgencyRole = "owner" | "admin" | "analyst";

export type AgencyStoreAccess = {
  agencyId: string;
  shopId: string;
  role: AgencyRole;
};

export const agencyPremiumFeatures = [
  "AGENCY_DASHBOARD",
] satisfies PremiumFeatureKey[];
