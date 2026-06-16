import type { ShopPlan } from "@prisma/client";

import {
  defaultCampaignDesignValues,
  type CampaignDesignErrors,
  type CampaignDesignValues,
  type CampaignDesignIconValue,
  type DesignAlignmentValue,
} from "../types/campaign-design";
import {
  hasCampaignDesignErrors,
  sanitizeCustomCss,
  validateCampaignDesignValues,
} from "../utils/campaign-design";

export type ParsedCampaignDesignForm = {
  values: CampaignDesignValues;
  errors: CampaignDesignErrors;
};

export function parseCampaignDesignFormData(
  formData: FormData,
  plan: ShopPlan,
): ParsedCampaignDesignForm {
  const isProPlan = plan === "PRO";
  const values: CampaignDesignValues = {
    templateKey: readString(formData, "templateKey") || "clean-minimal",
    backgroundColor:
      readString(formData, "backgroundColor") ||
      defaultCampaignDesignValues.backgroundColor,
    textColor:
      readString(formData, "textColor") ||
      defaultCampaignDesignValues.textColor,
    accentColor:
      readString(formData, "accentColor") ||
      defaultCampaignDesignValues.accentColor,
    buttonColor:
      readString(formData, "buttonColor") ||
      defaultCampaignDesignValues.buttonColor,
    buttonTextColor:
      readString(formData, "buttonTextColor") ||
      defaultCampaignDesignValues.buttonTextColor,
    fontSize: readInteger(
      formData,
      "fontSize",
      defaultCampaignDesignValues.fontSize,
    ),
    borderRadius: readInteger(
      formData,
      "borderRadius",
      defaultCampaignDesignValues.borderRadius,
    ),
    positionSticky: readBoolean(formData, "positionSticky"),
    mobileEnabled: readBoolean(formData, "mobileEnabled"),
    customCss: sanitizeCustomCss(readString(formData, "customCss"), isProPlan),
    alignment: readAlignment(formData),
    showCloseButton: readBoolean(formData, "showCloseButton"),
    showIcon: readBoolean(formData, "showIcon"),
    icon: readIcon(formData),
  };

  const errors = validateCampaignDesignValues(values);

  if (!isProPlan && readString(formData, "customCss").length > 0) {
    errors.customCss = "Custom CSS is available on the Pro plan.";
  }

  return { values, errors };
}

export { hasCampaignDesignErrors };

function readString(formData: FormData, key: keyof CampaignDesignValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readInteger(
  formData: FormData,
  key: keyof CampaignDesignValues,
  fallback: number,
) {
  const value = Number(readString(formData, key));

  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function readBoolean(formData: FormData, key: keyof CampaignDesignValues) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readAlignment(formData: FormData): DesignAlignmentValue {
  const value = readString(formData, "alignment");

  if (["LEFT", "CENTER", "RIGHT"].includes(value)) {
    return value as DesignAlignmentValue;
  }

  return defaultCampaignDesignValues.alignment;
}

function readIcon(formData: FormData): CampaignDesignIconValue {
  const value = readString(formData, "icon");

  if (["FIRE", "CLOCK", "TRUCK", "GIFT", "TAG", "NONE"].includes(value)) {
    return value as CampaignDesignIconValue;
  }

  return defaultCampaignDesignValues.icon;
}
