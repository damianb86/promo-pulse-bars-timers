import type { CampaignDesignValues } from "../types/campaign-design";

type MobileDesignJson = Partial<CampaignDesignValues> | null | undefined;

const mobileTextScale = 0.88;

export function deriveMobileDesignFromDesktop(
  desktopDesign: CampaignDesignValues,
): CampaignDesignValues {
  return {
    ...desktopDesign,
    separateMobileDesign: false,
    fontSize: scaleTextSize(desktopDesign.fontSize, 10),
    titleFontSize: scaleTextSize(desktopDesign.titleFontSize, 12),
    subheadingFontSize: scaleTextSize(desktopDesign.subheadingFontSize, 10),
    timerFontSize: scaleTextSize(desktopDesign.timerFontSize, 12),
    legendFontSize: scaleTextSize(desktopDesign.legendFontSize, 10),
    timerNumberFontSize: scaleTextSize(desktopDesign.timerNumberFontSize, 12),
    timerLabelFontSize: scaleTextSize(desktopDesign.timerLabelFontSize, 8),
  };
}

export function resolveMobileCampaignDesign(
  desktopDesign: CampaignDesignValues,
  mobileDesign: MobileDesignJson,
): CampaignDesignValues {
  if (!isSeparateMobileDesignEnabled(mobileDesign)) {
    return deriveMobileDesignFromDesktop(desktopDesign);
  }

  return {
    ...desktopDesign,
    ...mobileDesign,
    separateMobileDesign: true,
    customCss:
      typeof mobileDesign?.customCss === "string"
        ? mobileDesign.customCss
        : desktopDesign.customCss,
  };
}

export function isSeparateMobileDesignEnabled(
  mobileDesign: MobileDesignJson,
) {
  if (typeof mobileDesign?.separateMobileDesign === "boolean") {
    return mobileDesign.separateMobileDesign;
  }

  return Boolean(mobileDesign);
}

function scaleTextSize(value: number, minimum: number) {
  return Math.max(minimum, Math.round(value * mobileTextScale));
}
