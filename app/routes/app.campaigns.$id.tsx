import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  isRouteErrorResponse,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Prisma } from "@prisma/client";

import {
  AdvancedDiscountRulesEditor,
  type AdvancedDiscountRuleErrors,
  type AdvancedDiscountRuleRow,
} from "../components/AdvancedDiscountRulesEditor";
import {
  BehaviorTargetingEditor,
  type BehaviorTargetingErrors,
} from "../components/BehaviorTargetingEditor";
import {
  CampaignDesignEditor,
  type StructureFormPayload,
} from "../components/CampaignDesignEditor";
import { CampaignEditorLayout } from "../components/CampaignEditorLayout";
import { CampaignForm } from "../components/CampaignForm";
import type { PreviewPlacement } from "../components/CampaignPreviewPanel";
import type { PreviewDevice } from "../components/DevicePreviewToggle";
import { DiscountSettingsEditor } from "../components/DiscountSettingsEditor";
import {
  EmailTimerEditor,
  type EmailTimerErrors,
  type EmailTimerRow,
} from "../components/EmailTimerEditor";
import {
  CampaignMarketsEditor,
  type MarketOptionRow,
  type MarketRuleErrors,
  type MarketRuleRow,
} from "../components/CampaignMarketsEditor";
import {
  ExperimentsEditor,
  type ExperimentErrors,
  type ExperimentRow,
} from "../components/ExperimentsEditor";
import { OffersEditor } from "../components/OffersEditor";
import { NotFoundPage } from "../components/NotFoundPage";
import { AppAlert } from "../components/Notifications";
import { PlanUpgradeCallout } from "../components/PlanUpgradeCallout";
import {
  UniqueCodesEditor,
  type UniqueCodeErrors,
  type UniqueCodePoolRow,
  type UniqueCodeRow,
  type UniqueCodeStats,
} from "../components/UniqueCodesEditor";
import {
  clearDiscountSyncForShop,
  getCampaignForShop,
  publishCampaignForShop,
  updateBadgeSettingsForShop,
  updateCampaignBasicsForShop,
  updateCampaignBehaviorTargetingForShop,
  updateCampaignDesignForShop,
  updateCampaignTranslationsForShop,
  updateDeliveryCutoffSettingsForShop,
  updateDiscountSyncForShop,
  updateFreeShippingSettingsForShop,
  updateLowStockSettingsForShop,
} from "../models/campaign.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import { syncStorefrontInlineConfig } from "../services/storefront-inline-config.server";
import {
  generateCampaignTranslationSuggestions,
  parseCampaignTranslationAiFormData,
} from "../services/ai/campaignTranslationGenerator.server";
import {
  generateExperimentVariantSuggestion,
  parseExperimentVariantAiFormData,
} from "../services/ai/experimentVariantGenerator.server";
import {
  hasCampaignDesignErrors,
  parseCampaignStructureForm,
  parseResponsiveCampaignDesignFormData,
} from "../services/campaign-design-form.server";
import { loadCampaignDesignFileOption } from "../services/campaign-design-media.server";
import {
  hasCampaignFormErrors,
  parseCampaignFormData,
} from "../services/campaign-form.server";
import { buildCampaignPersistenceError } from "../services/campaign-save-errors.server";
import { getShopSettingsOrDefaults } from "../services/shopSettings.server";
import {
  hasCampaignTranslationErrors,
  parseCampaignTranslationsFormData,
  syncBaseCampaignTranslationValues,
} from "../services/campaign-translations-form.server";
import {
  hasDiscountSettingsErrors,
  parseDiscountSettingsFormData,
} from "../services/discount-settings-form.server";
import {
  AdvancedDiscountsError,
  createAppDiscount,
  deleteAppDiscount,
  listAdvancedDiscountRulesForCampaign,
  updateAppDiscount,
} from "../services/discounts/advancedDiscounts.server";
import {
  createDiscountCodePool,
  generateCodeBatch,
  getUniqueCodeStatsForCampaign,
  listDiscountCodePoolsForCampaign,
  listUniqueCodesForCampaign,
} from "../services/discounts/uniqueCodes.server";
import {
  applyWinningVariantToCampaign,
  archiveExperimentVariant,
  autoDeclareWinningVariant,
  forceDeclareWinningVariant,
  calculateExperimentResults,
  createExperiment,
  declareWinningVariant,
  duplicateExperiment,
  listExperimentsForCampaign,
  pauseExperiment,
  startExperiment,
  stopExperiment,
  updateExperiment,
  updateExperimentAutoWinner,
} from "../services/experiments";
import {
  createEmailTimerForCampaign,
  listEmailTimersForCampaign,
} from "../services/email-timers/emailTimers.server";
import {
  deleteMarketRule,
  listMarketRulesForCampaign,
  saveMarketRule,
} from "../services/markets/markets.server";
import {
  createBasicCodeDiscount,
  createFreeShippingCodeDiscount,
} from "../services/shopifyDiscounts.server";
import {
  canUseFeature,
  getEffectiveShopPlan,
  getLockedFeatureReason,
  validateCampaignPlanAccess,
} from "../services/planLimits.server";
import { canUsePremiumFeature } from "../services/premiumFeatures.server";
import {
  normalizeBehaviorTargetingRules,
  type BehaviorTargetingRules,
} from "../types/behavior-targeting";
import type {
  CampaignDesignErrors,
  CampaignDesignMediaOptions,
  CampaignDesignValues,
} from "../types/campaign-design";
import {
  formatCampaignOption,
  getDefaultPlacementForCampaignType,
} from "../types/campaign-options";
import {
  buildCampaignBadgeSettingsValues,
  buildCampaignCartRescueSettingsValues,
  buildCampaignDeliveryCutoffSettingsValues,
  buildCampaignLowStockSettingsValues,
  defaultCampaignFormValues,
  buildCampaignTimerSettingsValues,
  buildCampaignTargetingValues,
  buildCampaignFreeShippingSettingsValues,
  type CampaignFormErrors,
  type CampaignFormValues,
  type CampaignTargetingOptions,
} from "../types/campaign-form";
import {
  type DiscountOption,
  type DiscountSettingsErrors,
  type DiscountSettingsValues,
} from "../types/discount";
import type {
  CampaignTranslationFormErrors,
  CampaignTranslationsByLocale,
  StorefrontLocale,
} from "../types/localization";
import {
  getCampaignTranslationsViewModel,
  normalizeStorefrontLocale,
  type CampaignTranslationsViewModel,
} from "../utils/campaign-localization";
import {
  buildCampaignViewModel,
  type CampaignViewModel,
} from "../utils/campaign-view-model";
import { htmlToTree } from "../utils/campaign-structure";
import { parseCustomMessages } from "../utils/custom-messages";
import {
  createOrLinkFreeShippingDiscountForCampaign,
  emptyExperimentResults,
  linkExistingDiscount,
  loadDiscountOptions,
  loadMarketOptions,
  saveDiscountForCampaign,
  targetingListText,
  toAdvancedDiscountRuleRow,
  toCampaignBadgeFormValues,
  toCampaignDeliveryCutoffFormValues,
  toCampaignFreeShippingFormValues,
  toCampaignGoal,
  toCampaignLowStockFormValues,
  toCampaignMobileDesignValues,
  toCampaignStatus,
  toCampaignType,
  toDiscountSettingsValues,
  toEmailTimerRow,
  toExperimentRow,
  toMarketOptionRow,
  toMarketRuleRow,
  toPlacementType,
  toUniqueCodePoolRow,
  toUniqueCodeRow,
  toCampaignDesignValues,
  decodeStructureHtml,
  readMobileStructure,
  inferProductSelection,
  inferCountrySelection,
} from "../utils/campaign-editor-mappers.server";
import {
  hasTranslationInputs,
  isFormCheckboxChecked,
  loadDesignMediaOptions,
  loadTargetingOptions,
  parseAdvancedDiscountRuleFormData,
  parseAutoWinnerSettingsFormData,
  parseBehaviorTargetingFormData,
  parseEmailTimerFormData,
  parseExperimentFormData,
  parseMarketRuleFormData,
  parseTotalCodesToGenerate,
  readFormString,
  shouldClearDiscountSyncForCampaignType,
  toCampaignCartRescueFormValues,
  toCampaignTimerFormValues,
  toDateTimeLocalValue,
} from "../utils/campaign-editor-form.server";
import {
  formatPlacementSelectionLabel,
  formatUnifiedCampaignTypeLabel,
} from "../utils/campaign-editor-labels";
import { toPreviewPlacement } from "../components/campaign-form/fields";

type LoaderData = {
  id: string;
  values: CampaignFormValues;
  targetingOptions: CampaignTargetingOptions;
  designValues: CampaignDesignValues;
  mobileDesignValues: CampaignDesignValues;
  structureEdited: boolean;
  structureHtml: string;
  structureCss: string;
  structureMessages: string;
  mobileStructureEdited: boolean;
  mobileStructureHtml: string;
  mobileStructureCss: string;
  assetError: string | null;
  designMediaOptions: CampaignDesignMediaOptions;
  designViewModel: CampaignViewModel;
  discountApiError: string;
  discountOptions: DiscountOption[];
  discountValues: DiscountSettingsValues;
  marketApiError: string;
  marketOptions: MarketOptionRow[];
  marketRules: MarketRuleRow[];
  translationsViewModel: CampaignTranslationsViewModel;
  defaultLocale: StorefrontLocale;
  publication: {
    hasPublishedVersion: boolean;
    hasUnpublishedChanges: boolean;
    lastSavedAt: string;
    publishedAt: string | null;
  };
  isProPlan: boolean;
  lockedFeatures: {
    customCss: string;
    discountSync: string;
    advancedDiscounts: string;
    markets: string;
    experiments: string;
    emailTimers: string;
    multiLanguage: string;
    recurringTimers: string;
    scheduling: string;
    uniqueCodes: string;
    behaviorTargeting: string;
    basicTargeting: string;
    geoMarketTargeting: string;
    advancedTargeting: string;
  };
  behaviorTargetingValues: BehaviorTargetingRules;
  advancedDiscountRules: AdvancedDiscountRuleRow[];
  emailTimers: EmailTimerRow[];
  experiments: ExperimentRow[];
  uniqueCodePools: UniqueCodePoolRow[];
  uniqueCodeStats: UniqueCodeStats;
  uniqueCodes: UniqueCodeRow[];
};

type ActionData = {
  errors?: CampaignFormErrors;
  values?: CampaignFormValues;
  designErrors?: CampaignDesignErrors;
  designValues?: CampaignDesignValues;
  mobileDesignValues?: CampaignDesignValues;
  discountErrors?: DiscountSettingsErrors;
  discountNotice?: string;
  discountValues?: DiscountSettingsValues;
  marketErrors?: MarketRuleErrors;
  marketNotice?: string;
  advancedDiscountErrors?: AdvancedDiscountRuleErrors;
  advancedDiscountNotice?: string;
  emailTimerErrors?: EmailTimerErrors;
  experimentErrors?: ExperimentErrors;
  experimentNotice?: string;
  uniqueCodeErrors?: UniqueCodeErrors;
  uniqueCodeNotice?: string;
  uniqueCodeValues?: DiscountSettingsValues;
  behaviorTargetingErrors?: BehaviorTargetingErrors;
  behaviorTargetingNotice?: string;
  behaviorTargetingValues?: BehaviorTargetingRules;
  translationErrors?: CampaignTranslationFormErrors;
  translationValues?: CampaignTranslationsByLocale;
};

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { admin, session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const id = params.id;

  if (!id) {
    throw new Response("Campaign id is required.", { status: 400 });
  }

  const campaign = await getCampaignForShop(id, shop.id);

  if (!campaign) {
    throw new Response("Campaign not found.", { status: 404 });
  }

  const shopSettings = await getShopSettingsOrDefaults(shop.id);
  const defaultLocale =
    normalizeStorefrontLocale(shopSettings.defaultLocale) ?? "en";
  const translation =
    campaign.translations.find(
      (item) => normalizeStorefrontLocale(item.locale) === defaultLocale,
    ) ??
    campaign.translations.find(
      (item) => normalizeStorefrontLocale(item.locale) === "en",
    ) ??
    campaign.translations[0];
  const enabledPlacements = campaign.placements.filter(
    (placement) => placement.enabled,
  );
  const placement = enabledPlacements[0] ?? campaign.placements[0];
  const customPlacement =
    campaign.placements.find(
      (item) => item.placementType === "CUSTOM_SELECTOR",
    ) ?? null;
  const designValues = toCampaignDesignValues(campaign.design);
  const mobileDesignValues = toCampaignMobileDesignValues(
    campaign.design,
    designValues,
  );
  const structureEdited = campaign.design?.structureEdited ?? false;
  const structureHtml = structureEdited
    ? decodeStructureHtml(campaign.design?.structureCompact)
    : "";
  const structureCss = structureEdited
    ? (campaign.design?.structureCss ?? "")
    : "";
  const mobileStructure = readMobileStructure(campaign.design?.mobileDesign);
  const mobileStructureEdited = Boolean(mobileStructure);
  const mobileStructureHtml = mobileStructure
    ? decodeStructureHtml(mobileStructure.mobileStructureCompact)
    : "";
  const mobileStructureCss = mobileStructure?.mobileStructureCss ?? "";
  const effectivePlan = getEffectiveShopPlan(shop);
  const lockedFeatures = {
    customCss: getLockedFeatureReason(shop, "custom_css"),
    discountSync: getLockedFeatureReason(shop, "discount_sync"),
    advancedDiscounts: canUsePremiumFeature(shop, "ADVANCED_DISCOUNTS").reason,
    markets: canUsePremiumFeature(shop, "MARKETS_ADVANCED").reason,
    experiments: canUsePremiumFeature(shop, "AB_TESTING").reason,
    emailTimers: canUsePremiumFeature(shop, "EMAIL_TIMERS").reason,
    multiLanguage: getLockedFeatureReason(shop, "multi_language"),
    recurringTimers: getLockedFeatureReason(shop, "recurring_timers"),
    scheduling: getLockedFeatureReason(shop, "scheduling"),
    uniqueCodes: getLockedFeatureReason(shop, "unique_discount_codes"),
    behaviorTargeting: canUsePremiumFeature(shop, "BEHAVIORAL_TARGETING")
      .reason,
    basicTargeting: getLockedFeatureReason(shop, "basic_targeting"),
    geoMarketTargeting: getLockedFeatureReason(shop, "geo_market_targeting"),
    advancedTargeting: getLockedFeatureReason(shop, "advanced_targeting"),
  };
  const productSelection = inferProductSelection(campaign.targeting);
  const countrySelection = inferCountrySelection(campaign.targeting);
  const discountListResult = lockedFeatures.discountSync
    ? { discounts: [], error: "" }
    : await loadDiscountOptions(admin);
  const marketListResult = lockedFeatures.markets
    ? { markets: [], error: "" }
    : await loadMarketOptions(admin);
  const [
    uniqueCodePools,
    uniqueCodes,
    uniqueCodeStats,
    experiments,
    advancedDiscountRules,
    emailTimers,
    marketRules,
  ] = await Promise.all([
    listDiscountCodePoolsForCampaign(shop.id, campaign.id),
    listUniqueCodesForCampaign(shop.id, campaign.id, { take: 100 }),
    getUniqueCodeStatsForCampaign(shop.id, campaign.id),
    listExperimentsForCampaign(shop.id, campaign.id),
    listAdvancedDiscountRulesForCampaign(shop.id, campaign.id),
    listEmailTimersForCampaign(shop.id, campaign.id),
    listMarketRulesForCampaign(shop.id, campaign.id),
  ]);
  const experimentResults = await Promise.all(
    experiments.map((experiment) =>
      calculateExperimentResults({
        shopId: shop.id,
        experimentId: experiment.id,
      }),
    ),
  );
  const experimentResultsById = new Map(
    experimentResults.map((results) => [results.experimentId, results]),
  );

  return {
    id: campaign.id,
    values: {
      goal: toCampaignGoal(campaign.goal, campaign.type),
      type: toCampaignType(campaign.type),
      name: campaign.name,
      startsAt: toDateTimeLocalValue(campaign.startsAt),
      endsAt: toDateTimeLocalValue(campaign.endsAt),
      timezone: campaign.timezone,
      status: toCampaignStatus(campaign.status),
      placementType: placement
        ? toPlacementType(placement.placementType)
        : getDefaultPlacementForCampaignType(toCampaignType(campaign.type)),
      placementTypes:
        enabledPlacements.length > 0
          ? enabledPlacements.map((item) => toPlacementType(item.placementType))
          : [
              placement
                ? toPlacementType(placement.placementType)
                : getDefaultPlacementForCampaignType(
                    toCampaignType(campaign.type),
                  ),
            ],
      headline: translation?.headline ?? "",
      subheadline: translation?.subheadline ?? "",
      ctaText: translation?.ctaText ?? "",
      ctaUrl: translation?.ctaUrl ?? "",
      expiredText: translation?.expiredText ?? "This offer has ended.",
      ...toCampaignTimerFormValues(campaign.timerSettings),
      cartTimerDurationMinutes:
        campaign.timerSettings?.mode === "EVERGREEN_SESSION"
          ? String(
              campaign.timerSettings.durationMinutes ??
                defaultCampaignFormValues.cartTimerDurationMinutes,
            )
          : defaultCampaignFormValues.cartTimerDurationMinutes,
      cartTimerResetBehavior:
        campaign.timerSettings?.resetBehavior === "NEVER" ||
        campaign.timerSettings?.resetBehavior === "DAILY" ||
        campaign.timerSettings?.resetBehavior === "WEEKLY"
          ? campaign.timerSettings.resetBehavior
          : defaultCampaignFormValues.cartTimerResetBehavior,
      ...toCampaignCartRescueFormValues(campaign.cartRescueSettings),
      productSelection,
      productIds: targetingListText(campaign.targeting?.productIds),
      excludeProductIds: targetingListText(
        campaign.targeting?.excludeProductIds,
      ),
      collectionIds: targetingListText(campaign.targeting?.collectionIds),
      productTags: targetingListText(campaign.targeting?.productTags),
      customSelector: customPlacement?.customSelector ?? "",
      customStyle: customPlacement?.customStyle ?? "",
      urlContains: targetingListText(campaign.targeting?.urlContains),
      excludedUrlContains: targetingListText(
        campaign.targeting?.excludedUrlContains,
      ),
      countrySelection,
      countries: targetingListText(campaign.targeting?.countries),
      ...toCampaignFreeShippingFormValues(
        campaign.freeShippingSettings,
        campaign.discountSync,
      ),
      ...toCampaignDeliveryCutoffFormValues(
        campaign.deliveryCutoffSettings,
        campaign.timezone,
      ),
      ...toCampaignLowStockFormValues(campaign.lowStockSettings),
      ...toCampaignBadgeFormValues(campaign.badgeSettings),
    },
    targetingOptions: await loadTargetingOptions(admin),
    designValues,
    mobileDesignValues,
    structureEdited,
    structureHtml,
    structureCss,
    mobileStructureEdited,
    mobileStructureHtml,
    mobileStructureCss,
    structureMessages: campaign.design?.structureMessages ?? "",
    assetError: new URL(request.url).searchParams.get("assetError") || null,
    designMediaOptions: await loadDesignMediaOptions(admin),
    designViewModel: buildCampaignViewModel({
      name: campaign.name,
      type: campaign.type,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      placements: campaign.placements,
      translations: campaign.translations,
      design: designValues,
      timerSettings: campaign.timerSettings,
      cartRescueSettings: campaign.cartRescueSettings,
      deliveryCutoffSettings: campaign.deliveryCutoffSettings,
      freeShippingSettings: campaign.freeShippingSettings,
      lowStockSettings: campaign.lowStockSettings,
      badgeSettings: campaign.badgeSettings,
      discountSync: campaign.discountSync,
    }),
    discountApiError: discountListResult.error,
    discountOptions: discountListResult.discounts,
    discountValues: toDiscountSettingsValues(campaign.discountSync),
    behaviorTargetingValues: normalizeBehaviorTargetingRules(
      campaign.targeting?.behaviorRules,
    ),
    marketApiError: marketListResult.error,
    marketOptions: marketListResult.markets.map(toMarketOptionRow),
    marketRules: marketRules.map(toMarketRuleRow),
    translationsViewModel: getCampaignTranslationsViewModel({
      name: campaign.name,
      type: campaign.type,
      goal: campaign.goal,
      locales: shopSettings.enabledLocales,
      translations: campaign.translations,
    }),
    defaultLocale,
    publication: {
      hasPublishedVersion: Boolean(campaign.publishedAt),
      hasUnpublishedChanges: Boolean(
        campaign.publishedAt && campaign.lastSavedAt > campaign.publishedAt,
      ),
      lastSavedAt: campaign.lastSavedAt.toISOString(),
      publishedAt: campaign.publishedAt
        ? campaign.publishedAt.toISOString()
        : null,
    },
    isProPlan: canUseFeature({ plan: effectivePlan }, "custom_css").allowed,
    lockedFeatures,
    advancedDiscountRules: advancedDiscountRules.map(toAdvancedDiscountRuleRow),
    emailTimers: emailTimers.map((timer) => toEmailTimerRow(timer, request)),
    experiments: experiments.map((experiment) =>
      toExperimentRow(
        experiment,
        experimentResultsById.get(experiment.id) ??
          emptyExperimentResults(experiment),
      ),
    ),
    uniqueCodePools: uniqueCodePools.map(toUniqueCodePoolRow),
    uniqueCodeStats,
    uniqueCodes: uniqueCodes.map(toUniqueCodeRow),
  };
};

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage variant="campaign" />;
  }

  throw error;
}

export const action = async ({
  params,
  request,
}: ActionFunctionArgs): Promise<ActionData | Response> => {
  const { admin, session, redirect } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const shopSettings = await getShopSettingsOrDefaults(shop.id);
  const defaultLocale =
    normalizeStorefrontLocale(shopSettings.defaultLocale) ?? "en";
  const id = params.id;

  if (!id) {
    return { errors: { form: "Campaign id is required." } };
  }

  const syncInlineConfigIfPublished = async () => {
    const campaign = await getCampaignForShop(id, shop.id);

    if (campaign?.publishedAt) {
      await syncStorefrontInlineConfig({ admin, shop });
    }
  };
  const redirectAfterInlineConfigSync = async () => {
    await syncInlineConfigIfPublished();
    return redirect(`/app/campaigns/${id}`);
  };

  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "saveBasics");
  const forceDesignSave =
    readFormString(formData, "forceDesignSave") === "true";
  const effectivePlan = getEffectiveShopPlan(shop);

  if (intent === "resolveDesignFile") {
    const fileId = readFormString(formData, "fileId");
    const usage =
      readFormString(formData, "usage") === "icon" ? "icon" : "background";

    if (!fileId) {
      return Response.json(
        { error: "Selected file ID is required." },
        { status: 400 },
      );
    }

    try {
      return Response.json({
        file: await loadCampaignDesignFileOption(admin, fileId, usage),
      });
    } catch (error) {
      console.error("Failed to resolve campaign design file", error);

      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Selected file could not be loaded.",
        },
        { status: 400 },
      );
    }
  }

  if (intent === "translateCampaignTranslations") {
    const aiGate = canUsePremiumFeature(shop, "AI_CAMPAIGN_BUILDER");
    const parsedTranslationAi = parseCampaignTranslationAiFormData(
      formData,
      shopSettings.enabledLocales,
    );

    if (!aiGate.allowed) {
      return Response.json(
        { aiTranslationError: aiGate.reason },
        { status: 403 },
      );
    }

    if (parsedTranslationAi.errors.form) {
      return Response.json(
        { aiTranslationError: parsedTranslationAi.errors.form },
        { status: 400 },
      );
    }

    try {
      const aiTranslation = await generateCampaignTranslationSuggestions(
        parsedTranslationAi.input,
      );

      return Response.json({
        aiTranslation: {
          ...aiTranslation,
          sourceLocale: parsedTranslationAi.input.sourceLocale,
        },
      });
    } catch (error) {
      console.error("Failed to translate campaign copy", error);

      return Response.json(
        {
          aiTranslationError:
            "Translations could not be generated. Check the source copy and try again.",
        },
        { status: 500 },
      );
    }
  }

  if (intent === "generateExperimentVariantWithAi") {
    const aiGate = canUsePremiumFeature(shop, "AI_CAMPAIGN_BUILDER");
    const parsedVariantAi = parseExperimentVariantAiFormData(formData);

    if (!aiGate.allowed) {
      return Response.json({ aiVariantError: aiGate.reason }, { status: 403 });
    }

    if (parsedVariantAi.errors.form) {
      return Response.json(
        { aiVariantError: parsedVariantAi.errors.form },
        { status: 400 },
      );
    }

    try {
      const aiVariant = await generateExperimentVariantSuggestion(
        parsedVariantAi.input,
      );

      return Response.json({ aiVariant });
    } catch (error) {
      console.error("Failed to generate experiment variant", error);

      return Response.json(
        {
          aiVariantError:
            "The AI variant could not be generated. Review the campaign copy and try again.",
        },
        { status: 500 },
      );
    }
  }

  if (intent === "saveDesign") {
    const parsed = parseResponsiveCampaignDesignFormData(
      formData,
      effectivePlan,
    );

    if (!forceDesignSave && hasCampaignDesignErrors(parsed.errors)) {
      return {
        designErrors: parsed.errors,
        designValues: parsed.values,
        mobileDesignValues: parsed.mobileValues,
      };
    }

    try {
      await updateCampaignDesignForShop(
        id,
        shop.id,
        parsed.values,
        parsed.mobileValues,
        parseCampaignStructureForm(formData),
      );
      return redirectAfterInlineConfigSync();
    } catch (error) {
      console.error("Failed to update campaign design", error);

      return {
        designValues: parsed.values,
        mobileDesignValues: parsed.mobileValues,
        designErrors: {
          form: "Campaign design could not be saved. Check the fields and try again.",
        },
      };
    }
  }

  if (intent === "saveTranslations") {
    const translationGate = canUseFeature(shop, "multi_language");

    if (!translationGate.allowed) {
      return {
        translationErrors: {
          form: translationGate.reason,
        },
      };
    }

    const parsed = parseCampaignTranslationsFormData(
      formData,
      shopSettings.enabledLocales,
    );

    if (hasCampaignTranslationErrors(parsed.errors)) {
      return {
        translationErrors: parsed.errors,
        translationValues: parsed.values,
      };
    }

    try {
      await updateCampaignTranslationsForShop(id, shop.id, parsed.translations);
      return redirectAfterInlineConfigSync();
    } catch (error) {
      console.error("Failed to update campaign translations", error);

      return {
        translationValues: parsed.values,
        translationErrors: {
          form: "Campaign translations could not be saved. Check the fields and try again.",
        },
      };
    }
  }

  if (intent === "saveDiscount") {
    const parsed = parseDiscountSettingsFormData(formData);

    if (parsed.values.mode !== "NONE") {
      const discountGate = canUseFeature(shop, "discount_sync");

      if (!discountGate.allowed) {
        return {
          discountErrors: {
            form: discountGate.reason,
          },
          discountValues: parsed.values,
        };
      }

      if (parsed.values.mode === "UNIQUE_CODES") {
        const uniqueCodeGate = canUseFeature(shop, "unique_discount_codes");

        if (!uniqueCodeGate.allowed) {
          return {
            discountErrors: {
              form: uniqueCodeGate.reason,
            },
            discountValues: parsed.values,
          };
        }
      }
    }

    if (hasDiscountSettingsErrors(parsed.errors)) {
      return {
        discountErrors: parsed.errors,
        discountValues: parsed.values,
      };
    }

    try {
      if (parsed.values.mode === "NONE") {
        await clearDiscountSyncForShop(id, shop.id);
        return redirectAfterInlineConfigSync();
      }

      if (parsed.values.mode === "LINK_EXISTING") {
        const saved = await linkExistingDiscount({
          admin,
          campaignId: id,
          shopId: shop.id,
          codeOrId: parsed.values.existingCodeOrId,
          syncStartEnd: parsed.values.syncStartEnd,
        });

        if (saved.notice) {
          await syncInlineConfigIfPublished();

          return {
            discountNotice: saved.notice,
            discountValues: {
              ...parsed.values,
              discountCode: saved.discountCode ?? parsed.values.discountCode,
              shopifyDiscountId:
                saved.shopifyDiscountId ?? parsed.values.shopifyDiscountId,
            },
          };
        }

        return redirectAfterInlineConfigSync();
      }

      if (parsed.values.mode === "UNIQUE_CODES") {
        await updateDiscountSyncForShop(id, shop.id, {
          shopifyDiscountId: null,
          discountCode: null,
          method: "UNIQUE_CODE",
          syncStartEnd: parsed.values.syncStartEnd,
          startsAt: parsed.startsAt,
          endsAt: parsed.endsAt,
          lastSyncedAt: parsed.values.syncStartEnd ? new Date() : null,
          title: parsed.values.title,
          valueType: parsed.values.valueType,
          value:
            parsed.values.valueType === "FREE_SHIPPING"
              ? null
              : String(parsed.discountValue),
          minimumSubtotal:
            parsed.minimumSubtotal === null
              ? null
              : String(parsed.minimumSubtotal),
          appliesOncePerCustomer: parsed.values.appliesOncePerCustomer,
          uniqueCodePrefix: parsed.values.uniqueCodePrefix,
          uniqueCodeExpiresMinutes: parsed.uniqueCodeExpiresMinutes,
          uniqueCodeAutoApply: parsed.values.uniqueCodeAutoApply,
          uniqueCodeReassignExpired: parsed.values.uniqueCodeReassignExpired,
          uniqueCodeStartsAt: parsed.startsAt,
          uniqueCodeEndsAt: parsed.endsAt,
        });

        return redirectAfterInlineConfigSync();
      }

      const discount =
        parsed.values.valueType === "FREE_SHIPPING"
          ? await createFreeShippingCodeDiscount(admin, {
              title: parsed.values.title,
              code: parsed.values.discountCode,
              startsAt: parsed.startsAt,
              endsAt: parsed.endsAt,
              minimumSubtotal: parsed.minimumSubtotal,
              appliesOncePerCustomer: parsed.values.appliesOncePerCustomer,
            })
          : await createBasicCodeDiscount(admin, {
              title: parsed.values.title,
              code: parsed.values.discountCode,
              valueType: parsed.values.valueType,
              value: parsed.discountValue,
              startsAt: parsed.startsAt,
              endsAt: parsed.endsAt,
              appliesOncePerCustomer: parsed.values.appliesOncePerCustomer,
            });

      await saveDiscountForCampaign({
        campaignId: id,
        shopId: shop.id,
        discount,
        syncStartEnd: parsed.values.syncStartEnd,
      });

      return redirectAfterInlineConfigSync();
    } catch (error) {
      console.error("Failed to update discount sync", error);

      return {
        discountValues: parsed.values,
        discountErrors: {
          form:
            error instanceof Error
              ? error.message
              : "Discount could not be saved. Check the fields and try again.",
        },
      };
    }
  }

  if (intent === "saveBehaviorTargeting") {
    const behaviorGate = canUsePremiumFeature(shop, "BEHAVIORAL_TARGETING");
    const parsed = parseBehaviorTargetingFormData(formData);

    if (!behaviorGate.allowed) {
      return {
        behaviorTargetingErrors: {
          form: behaviorGate.reason,
        },
        behaviorTargetingValues: parsed.values,
      };
    }

    if (parsed.errors.form) {
      return {
        behaviorTargetingErrors: parsed.errors,
        behaviorTargetingValues: parsed.values,
      };
    }

    try {
      await updateCampaignBehaviorTargetingForShop(
        id,
        shop.id,
        parsed.values as Prisma.InputJsonValue,
      );
      await syncInlineConfigIfPublished();

      return {
        behaviorTargetingNotice: "Behavior targeting saved.",
        behaviorTargetingValues: parsed.values,
      };
    } catch (error) {
      console.error("Failed to update behavior targeting", error);

      return {
        behaviorTargetingErrors: {
          form: "Behavior targeting could not be saved. Check the fields and try again.",
        },
        behaviorTargetingValues: parsed.values,
      };
    }
  }

  if (intent === "generateUniqueCodes") {
    formData.set("mode", "UNIQUE_CODES");

    const parsed = parseDiscountSettingsFormData(formData);
    const totalCodesToGenerate = parseTotalCodesToGenerate(formData);
    const enabled = isFormCheckboxChecked(formData, "enableUniqueCodes");
    const uniqueCodeGate = canUseFeature(shop, "unique_discount_codes");

    if (!uniqueCodeGate.allowed) {
      return {
        uniqueCodeErrors: {
          form: uniqueCodeGate.reason,
        },
        uniqueCodeValues: parsed.values,
      };
    }

    if (hasDiscountSettingsErrors(parsed.errors)) {
      return {
        uniqueCodeErrors: { form: Object.values(parsed.errors).join(" ") },
        uniqueCodeValues: parsed.values,
      };
    }

    if (!totalCodesToGenerate.ok) {
      return {
        uniqueCodeErrors: {
          totalCodesToGenerate: totalCodesToGenerate.error,
        },
        uniqueCodeValues: parsed.values,
      };
    }

    try {
      await updateDiscountSyncForShop(id, shop.id, {
        shopifyDiscountId: null,
        discountCode: null,
        method: "UNIQUE_CODE",
        syncStartEnd: false,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        lastSyncedAt: null,
        title: parsed.values.title || "Promo Pulse unique codes",
        valueType: parsed.values.valueType,
        value:
          parsed.values.valueType === "FREE_SHIPPING"
            ? null
            : String(parsed.discountValue),
        minimumSubtotal:
          parsed.minimumSubtotal === null
            ? null
            : String(parsed.minimumSubtotal),
        appliesOncePerCustomer: true,
        showCodeOnStorefront: enabled,
        uniqueCodePrefix: parsed.values.uniqueCodePrefix,
        uniqueCodeExpiresMinutes: parsed.uniqueCodeExpiresMinutes,
        uniqueCodeAutoApply: parsed.values.uniqueCodeAutoApply,
        uniqueCodeReassignExpired: parsed.values.uniqueCodeReassignExpired,
        uniqueCodeStartsAt: parsed.startsAt,
        uniqueCodeEndsAt: parsed.endsAt,
      });
      const pool = await createDiscountCodePool({
        shopId: shop.id,
        campaignId: id,
        prefix: parsed.values.uniqueCodePrefix,
        discountType: parsed.values.valueType,
        value:
          parsed.values.valueType === "FREE_SHIPPING"
            ? null
            : parsed.discountValue,
        startsAt: parsed.startsAt,
        expiresAt: parsed.endsAt,
        reassignExpiredUnused: parsed.values.uniqueCodeReassignExpired,
      });
      const result = await generateCodeBatch({
        shopId: shop.id,
        campaignId: id,
        poolId: pool.id,
        totalCodes: totalCodesToGenerate.value,
        admin,
      });
      const campaign = await getCampaignForShop(id, shop.id);

      if (campaign?.status === "ACTIVE") {
        await publishCampaignForShop(id, shop.id);
        await syncStorefrontInlineConfig({ admin, shop });
      }

      return {
        uniqueCodeNotice: `Generated ${result.codes.length} unique codes.`,
        uniqueCodeValues: enabled
          ? parsed.values
          : {
              ...parsed.values,
              mode: "NONE",
            },
      };
    } catch (error) {
      console.error("Failed to generate unique codes", error);

      return {
        uniqueCodeErrors: {
          form:
            error instanceof Error
              ? error.message
              : "Unique codes could not be generated.",
        },
        uniqueCodeValues: parsed.values,
      };
    }
  }

  if (intent === "createEmailTimer") {
    const emailTimerGate = canUsePremiumFeature(shop, "EMAIL_TIMERS");

    if (!emailTimerGate.allowed) {
      return {
        emailTimerErrors: {
          form: emailTimerGate.reason,
        },
      };
    }

    const parsed = parseEmailTimerFormData(formData);

    if (Object.keys(parsed.errors).length > 0) {
      return {
        emailTimerErrors: parsed.errors,
      };
    }

    try {
      await createEmailTimerForCampaign({
        shopId: shop.id,
        campaignId: id,
        design: parsed.design,
        expiredBehavior: parsed.expiredBehavior,
      });

      return redirectAfterInlineConfigSync();
    } catch (error) {
      console.error("Failed to create email timer", error);

      return {
        emailTimerErrors: {
          form:
            error instanceof Error
              ? error.message
              : "Email timer could not be created.",
        },
      };
    }
  }

  if (intent === "saveMarketRule" || intent === "deleteMarketRule") {
    const marketsGate = canUsePremiumFeature(shop, "MARKETS_ADVANCED");

    if (!marketsGate.allowed) {
      return {
        marketErrors: {
          form: marketsGate.reason,
        },
      };
    }

    try {
      if (intent === "deleteMarketRule") {
        const ruleId = String(formData.get("marketRuleId") ?? "").trim();

        if (!ruleId) {
          return {
            marketErrors: {
              form: "Market rule id is required.",
            },
          };
        }

        await deleteMarketRule({
          campaignId: id,
          ruleId,
          shopId: shop.id,
        });

        return redirectAfterInlineConfigSync();
      }

      const parsed = parseMarketRuleFormData(formData);

      if (parsed.errors.form) {
        return {
          marketErrors: parsed.errors,
        };
      }

      await saveMarketRule({
        campaignId: id,
        input: parsed.input,
        ruleId: String(formData.get("marketRuleId") ?? "").trim() || undefined,
        shopId: shop.id,
      });

      return redirectAfterInlineConfigSync();
    } catch (error) {
      console.error("Failed to save market rule", error);

      return {
        marketErrors: {
          form:
            error instanceof Error
              ? error.message
              : "Market rule could not be saved.",
        },
      };
    }
  }

  if (
    intent === "saveAdvancedDiscountRule" ||
    intent === "deleteAdvancedDiscountRule"
  ) {
    const advancedDiscountGate = canUsePremiumFeature(
      shop,
      "ADVANCED_DISCOUNTS",
    );

    if (!advancedDiscountGate.allowed) {
      return {
        advancedDiscountErrors: {
          form: advancedDiscountGate.reason,
        },
      };
    }

    try {
      if (intent === "deleteAdvancedDiscountRule") {
        const ruleId = String(formData.get("ruleId") ?? "").trim();

        if (!ruleId) {
          return {
            advancedDiscountErrors: {
              form: "Advanced discount rule id is required.",
            },
          };
        }

        await deleteAppDiscount({
          admin,
          ruleId,
          shopId: shop.id,
        });

        return redirectAfterInlineConfigSync();
      }

      const parsed = parseAdvancedDiscountRuleFormData(formData);

      if (parsed.errors.form) {
        return {
          advancedDiscountErrors: parsed.errors,
        };
      }

      const ruleId = String(formData.get("ruleId") ?? "").trim();
      const result = ruleId
        ? await updateAppDiscount({
            admin,
            input: parsed.input,
            ruleId,
            shopId: shop.id,
          })
        : await createAppDiscount({
            admin,
            campaignId: id,
            input: parsed.input,
            shopId: shop.id,
          });

      if (result.warning) {
        await syncInlineConfigIfPublished();

        return {
          advancedDiscountNotice: result.warning,
        };
      }

      return redirectAfterInlineConfigSync();
    } catch (error) {
      console.error("Failed to update advanced discount rule", error);

      return {
        advancedDiscountErrors: {
          form:
            error instanceof AdvancedDiscountsError || error instanceof Error
              ? error.message
              : "Advanced discount rule could not be saved.",
        },
      };
    }
  }

  if (
    intent === "createExperiment" ||
    intent === "updateExperiment" ||
    intent === "startExperiment" ||
    intent === "pauseExperiment" ||
    intent === "stopExperiment" ||
    intent === "saveExperimentAutoWinner" ||
    intent === "declareExperimentWinner" ||
    intent === "archiveExperimentVariant" ||
    intent === "detectExperimentWinner" ||
    intent === "forceDeclareExperimentWinner" ||
    intent === "applyExperimentWinner" ||
    intent === "duplicateExperiment"
  ) {
    const experimentGate = canUsePremiumFeature(shop, "AB_TESTING");

    if (!experimentGate.allowed) {
      return {
        experimentErrors: {
          form: experimentGate.reason,
        },
      };
    }

    try {
      if (intent === "createExperiment") {
        const parsed = parseExperimentFormData(formData);

        if (parsed.errors.form) {
          return { experimentErrors: parsed.errors };
        }

        await createExperiment({
          shopId: shop.id,
          campaignId: id,
          name: parsed.name,
          primaryMetric: parsed.primaryMetric,
          variants: parsed.variants,
        });
        await syncInlineConfigIfPublished();

        return {
          experimentNotice:
            "Experiment created as draft. It is not active yet. To activate it, click Start Experiment and then publish the campaign changes.",
        };
      }

      const experimentId = String(formData.get("experimentId") ?? "").trim();

      if (!experimentId) {
        return {
          experimentErrors: {
            form: "Experiment id is required.",
          },
        };
      }

      if (intent === "updateExperiment") {
        const parsed = parseExperimentFormData(formData, {
          requireTwoWeightedVariants: false,
        });

        if (parsed.errors.form) {
          return { experimentErrors: parsed.errors };
        }

        await updateExperiment({
          shopId: shop.id,
          experimentId,
          name: parsed.name,
          primaryMetric: parsed.primaryMetric,
          variants: parsed.variants,
        });
      } else if (intent === "saveExperimentAutoWinner") {
        await updateExperimentAutoWinner({
          shopId: shop.id,
          experimentId,
          settings: parseAutoWinnerSettingsFormData(formData),
        });
      } else if (intent === "declareExperimentWinner") {
        const variantId = String(formData.get("variantId") ?? "").trim();

        if (!variantId) {
          return {
            experimentErrors: {
              form: "Variant id is required.",
            },
          };
        }

        await declareWinningVariant({
          shopId: shop.id,
          experimentId,
          variantId,
        });
      } else if (intent === "archiveExperimentVariant") {
        const variantId = String(formData.get("variantId") ?? "").trim();

        if (!variantId) {
          return {
            experimentErrors: {
              form: "Variant id is required.",
            },
          };
        }

        await archiveExperimentVariant({
          shopId: shop.id,
          experimentId,
          variantId,
        });
      } else if (intent === "detectExperimentWinner") {
        const result = await autoDeclareWinningVariant({
          shopId: shop.id,
          experimentId,
        });

        if (!result.declared || !result.winner) {
          return {
            experimentErrors: {
              form: "No winner met the configured sample, runtime, and confidence rules.",
            },
          };
        }
      } else if (intent === "forceDeclareExperimentWinner") {
        const result = await forceDeclareWinningVariant({
          shopId: shop.id,
          experimentId,
        });

        if (!result.declared) {
          return {
            experimentErrors: {
              form: "This experiment has no variants to declare a winner from.",
            },
          };
        }
      } else if (intent === "applyExperimentWinner") {
        await applyWinningVariantToCampaign({
          shopId: shop.id,
          experimentId,
        });
      } else if (intent === "duplicateExperiment") {
        await duplicateExperiment({
          shopId: shop.id,
          experimentId,
        });
      } else if (intent === "startExperiment") {
        await startExperiment({ shopId: shop.id, experimentId });
      } else if (intent === "pauseExperiment") {
        await pauseExperiment({ shopId: shop.id, experimentId });
      } else {
        await stopExperiment({ shopId: shop.id, experimentId });
      }

      return redirectAfterInlineConfigSync();
    } catch (error) {
      console.error("Failed to update experiment", error);

      return {
        experimentErrors: {
          form:
            error instanceof Error
              ? error.message
              : "Experiment could not be updated.",
        },
      };
    }
  }

  const parsed = parseCampaignFormData(formData, {
    allowInactiveStatuses: true,
  });
  const parsedDesign = parseResponsiveCampaignDesignFormData(
    formData,
    effectivePlan,
  );
  const shouldSaveTranslationsWithBasics = hasTranslationInputs(formData);
  const parsedTranslations = shouldSaveTranslationsWithBasics
    ? syncBaseCampaignTranslationValues(
        parseCampaignTranslationsFormData(
          formData,
          shopSettings.enabledLocales,
        ),
        {
          headline: parsed.values.headline,
          subheadline: parsed.values.subheadline,
          ctaText: parsed.values.ctaText,
          ctaUrl: parsed.values.ctaUrl,
          expiredText: parsed.values.expiredText,
        },
        defaultLocale,
      )
    : null;
  const isPublishRequest = intent === "publishCampaign";

  if (
    hasCampaignFormErrors(parsed.errors) ||
    (!forceDesignSave && hasCampaignDesignErrors(parsedDesign.errors)) ||
    (parsedTranslations &&
      hasCampaignTranslationErrors(parsedTranslations.errors))
  ) {
    return {
      errors: parsed.errors,
      values: parsed.values,
      designErrors: parsedDesign.errors,
      designValues: parsedDesign.values,
      mobileDesignValues: parsedDesign.mobileValues,
      translationErrors: parsedTranslations?.errors,
      translationValues: parsedTranslations?.values,
    };
  }

  const targeting = buildCampaignTargetingValues(parsed.values);
  const timerSettings = buildCampaignTimerSettingsValues(parsed.values);
  const cartRescueSettings = buildCampaignCartRescueSettingsValues(
    parsed.values,
  );
  const isFreeShippingCampaign =
    parsed.values.type === "FREE_SHIPPING_GOAL" ||
    parsed.values.goal === "FREE_SHIPPING";
  const usesFreeShippingSettings = isFreeShippingCampaign;
  const isDeliveryCutoffCampaign =
    parsed.values.type === "DELIVERY_CUTOFF" ||
    parsed.values.goal === "DELIVERY_CUTOFF";
  const isLowStockCampaign =
    parsed.values.type === "LOW_STOCK" ||
    parsed.values.goal === "LOW_STOCK_URGENCY";
  const isBadgeCampaign =
    parsed.values.type === "PRODUCT_BADGE" ||
    parsed.values.goal === "PRODUCT_BADGE";

  try {
    const planErrors = await validateCampaignPlanAccess(
      shop,
      {
        ...parsed.values,
        targeting,
        timerSettings,
      },
      {
        campaignId: id,
      },
    );

    if (planErrors.length > 0) {
      return {
        values: parsed.values,
        designValues: parsedDesign.values,
        mobileDesignValues: parsedDesign.mobileValues,
        errors: {
          form: planErrors.join(" "),
        },
      };
    }

    if (usesFreeShippingSettings && parsed.values.freeShippingAutoDiscount) {
      const discountGate = canUseFeature(shop, "discount_sync");

      if (!discountGate.allowed) {
        return {
          values: parsed.values,
          designValues: parsedDesign.values,
          mobileDesignValues: parsedDesign.mobileValues,
          errors: {
            form: discountGate.reason,
          },
        };
      }
    }

    if (parsedTranslations) {
      const translationGate = canUseFeature(shop, "multi_language");

      if (!translationGate.allowed) {
        return {
          values: parsed.values,
          designValues: parsedDesign.values,
          mobileDesignValues: parsedDesign.mobileValues,
          translationValues: parsedTranslations.values,
          translationErrors: {
            form: translationGate.reason,
          },
        };
      }
    }

    await updateCampaignBasicsForShop(id, shop.id, {
      name: parsed.values.name,
      status: parsed.values.status,
      type: parsed.values.type,
      goal: parsed.values.goal,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      timezone: parsed.values.timezone,
      placementType: parsed.values.placementType,
      placementTypes: parsed.values.placementTypes,
      customSelector: parsed.values.customSelector,
      customStyle: parsed.values.customStyle,
      targeting,
      headline: parsed.values.headline,
      subheadline: parsed.values.subheadline,
      ctaText: parsed.values.ctaText,
      ctaUrl: parsed.values.ctaUrl,
      expiredText: parsed.values.expiredText,
      badgeText: parsed.values.badgeText,
      cartRescueSettings:
        parsed.values.type === "CART_TIMER" ||
        parsed.values.goal === "CART_RESCUE"
          ? cartRescueSettings
          : null,
      timerSettings,
    });
    if (parsedTranslations) {
      await updateCampaignTranslationsForShop(
        id,
        shop.id,
        parsedTranslations.translations,
      );
    }
    await updateCampaignDesignForShop(
      id,
      shop.id,
      parsedDesign.values,
      parsedDesign.mobileValues,
      parseCampaignStructureForm(formData),
    );

    if (usesFreeShippingSettings) {
      const freeShippingSettings = buildCampaignFreeShippingSettingsValues(
        parsed.values,
      );

      await updateFreeShippingSettingsForShop(id, shop.id, {
        thresholdAmount: Number(freeShippingSettings.thresholdAmount).toFixed(
          2,
        ),
        currencyCode: freeShippingSettings.currencyCode,
        includeDiscountedSubtotal:
          freeShippingSettings.includeDiscountedSubtotal,
        emptyCartMessage: freeShippingSettings.emptyCartMessage,
        successMessage: freeShippingSettings.successMessage,
        progressStyle: freeShippingSettings.progressStyle,
        thresholdRules: null,
      });

      if (parsed.values.freeShippingAutoDiscount) {
        await createOrLinkFreeShippingDiscountForCampaign({
          admin,
          campaignId: id,
          shopId: shop.id,
          values: parsed.values,
          startsAt: parsed.startsAt,
          endsAt: parsed.endsAt,
        });
      } else {
        await clearDiscountSyncForShop(id, shop.id);
      }
    } else if (shouldClearDiscountSyncForCampaignType(parsed.values)) {
      await clearDiscountSyncForShop(id, shop.id);
    }

    if (isDeliveryCutoffCampaign) {
      const deliveryCutoffSettings = buildCampaignDeliveryCutoffSettingsValues(
        parsed.values,
      );

      await updateDeliveryCutoffSettingsForShop(id, shop.id, {
        afterCutoffBehavior: deliveryCutoffSettings.afterCutoffBehavior,
        countryRules: deliveryCutoffSettings.countryRules,
        cutoffHour: deliveryCutoffSettings.cutoffHour,
        cutoffMinute: deliveryCutoffSettings.cutoffMinute,
        holidays: deliveryCutoffSettings.holidays,
        maxDeliveryDays: deliveryCutoffSettings.maxDeliveryDays,
        minDeliveryDays: deliveryCutoffSettings.minDeliveryDays,
        processingDays: deliveryCutoffSettings.processingDays,
        timezone: parsed.values.timezone,
        workingDays: deliveryCutoffSettings.workingDays,
      });
    }

    if (isLowStockCampaign) {
      const lowStockSettings = buildCampaignLowStockSettingsValues(
        parsed.values,
      );

      await updateLowStockSettingsForShop(id, shop.id, lowStockSettings);
    }

    if (isBadgeCampaign) {
      const badgeSettings = buildCampaignBadgeSettingsValues(parsed.values);

      await updateBadgeSettingsForShop(id, shop.id, badgeSettings);
    }

    if (isPublishRequest) {
      await publishCampaignForShop(id, shop.id);
      await syncStorefrontInlineConfig({ admin, shop });
    } else {
      await syncInlineConfigIfPublished();
    }

    return redirect(`/app/campaigns/${id}`);
  } catch (error) {
    console.error(
      isPublishRequest
        ? "Failed to publish campaign"
        : "Failed to update campaign draft",
      error,
    );

    return {
      values: parsed.values,
      designValues: parsedDesign.values,
      mobileDesignValues: parsedDesign.mobileValues,
      errors: buildCampaignPersistenceError(error, {
        action: isPublishRequest ? "publish" : "save",
        values: parsed.values,
      }),
    };
  }
};

export default function EditCampaignPage() {
  const {
    id,
    values,
    targetingOptions,
    designValues,
    mobileDesignValues,
    structureEdited,
    structureHtml,
    structureCss,
    structureMessages,
    mobileStructureEdited,
    mobileStructureHtml,
    mobileStructureCss,
    assetError,
    designMediaOptions,
    designViewModel,
    discountApiError,
    discountOptions,
    discountValues,
    behaviorTargetingValues,
    marketApiError,
    marketOptions,
    marketRules,
    advancedDiscountRules,
    emailTimers,
    experiments,
    uniqueCodePools,
    uniqueCodeStats,
    uniqueCodes,
    translationsViewModel,
    defaultLocale,
    publication,
    isProPlan,
    lockedFeatures,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const activeCampaignValues = actionData?.values ?? values;
  const activeDesignValues = actionData?.designValues ?? designValues;
  const activeMobileDesignValues =
    actionData?.mobileDesignValues ?? mobileDesignValues;
  const translationValues =
    actionData?.translationValues ?? translationsViewModel.values;
  const [draftCampaignValues, setDraftCampaignValues] =
    useState(activeCampaignValues);
  const [draftDesignValues, setDraftDesignValues] =
    useState(activeDesignValues);
  const [draftMobileDesignValues, setDraftMobileDesignValues] = useState(
    activeMobileDesignValues,
  );
  const [sharedPreviewDevice, setSharedPreviewDevice] =
    useState<PreviewDevice>("desktop");
  const [sharedPreviewPlacementOverride, setSharedPreviewPlacementOverride] =
    useState<{
      key: string;
      placement: PreviewPlacement;
    } | null>(null);
  const [
    experimentAutoWinnerSaveBarState,
    setExperimentAutoWinnerSaveBarState,
  ] = useState({
    dirty: false,
    saving: false,
  });
  const [behaviorTargetingSaveBarState, setBehaviorTargetingSaveBarState] =
    useState({
      dirty: false,
      saving: false,
    });
  // The structural HTML/CSS overrides live in their own modals (not in the
  // tracked design values), so they report dirtiness explicitly to drive the
  // contextual save bar.
  const [structureDirty, setStructureDirty] = useState(false);
  // Current structure overrides lifted from the design editor so they ride along
  // with the campaign form save (saveDraft parses structure* from the form).
  const [structureForm, setStructureForm] =
    useState<StructureFormPayload | null>(null);
  const [discardVersion, setDiscardVersion] = useState(0);
  const persistedDraftKey = useMemo(
    () =>
      JSON.stringify({
        campaign: activeCampaignValues,
        design: activeDesignValues,
        mobileDesign: activeMobileDesignValues,
      }),
    [activeCampaignValues, activeDesignValues, activeMobileDesignValues],
  );
  const currentDraftKey = useMemo(
    () =>
      JSON.stringify({
        campaign: draftCampaignValues,
        design: draftDesignValues,
        mobileDesign: draftMobileDesignValues,
      }),
    [draftCampaignValues, draftDesignValues, draftMobileDesignValues],
  );
  const hasCampaignDraftUnsavedChanges = currentDraftKey !== persistedDraftKey;
  const hasUnsavedChanges =
    hasCampaignDraftUnsavedChanges ||
    experimentAutoWinnerSaveBarState.dirty ||
    behaviorTargetingSaveBarState.dirty ||
    structureDirty;
  const sharedPreviewPlacementKey = draftCampaignValues.placementTypes.join("|");
  const sharedDefaultPreviewPlacement = toPreviewPlacement(
    draftCampaignValues.placementType,
    draftCampaignValues.type,
  );
  const sharedPreviewPlacement =
    sharedPreviewPlacementOverride?.key === sharedPreviewPlacementKey
      ? sharedPreviewPlacementOverride.placement
      : sharedDefaultPreviewPlacement;
  const updateSharedPreviewPlacement = (placement: PreviewPlacement) => {
    setSharedPreviewPlacementOverride({
      key: sharedPreviewPlacementKey,
      placement,
    });
  };
  // Structural HTML override → tree. Prefer the live Design-editor payload when
  // present so the Campaign tab preview stays identical before saving too.
  const savedStructureTree = useMemo(
    () => (structureEdited && structureHtml ? htmlToTree(structureHtml) : null),
    [structureEdited, structureHtml],
  );
  const savedMobileStructureTree = useMemo(
    () =>
      mobileStructureEdited && mobileStructureHtml
        ? htmlToTree(mobileStructureHtml)
        : null,
    [mobileStructureEdited, mobileStructureHtml],
  );
  const campaignPreviewStructureTree = useMemo(() => {
    if (structureForm) {
      return structureForm.structureEdited && structureForm.structureHtml
        ? htmlToTree(structureForm.structureHtml)
        : null;
    }
    return savedStructureTree;
  }, [savedStructureTree, structureForm]);
  const campaignPreviewMobileStructureTree = useMemo(() => {
    if (structureForm) {
      return structureForm.mobileStructureEdited &&
        structureForm.mobileStructureHtml
        ? htmlToTree(structureForm.mobileStructureHtml)
        : null;
    }
    return savedMobileStructureTree;
  }, [savedMobileStructureTree, structureForm]);
  const campaignPreviewStructureCss = structureForm
    ? structureForm.structureEdited
      ? structureForm.structureCss
      : ""
    : structureCss;
  const campaignPreviewMobileStructureCss = structureForm
    ? structureForm.mobileStructureEdited
      ? structureForm.mobileStructureCss
      : ""
    : mobileStructureCss;
  const savedCustomMessages = useMemo(
    () => parseCustomMessages(structureMessages),
    [structureMessages],
  );
  // Live custom messages, mirrored from the CampaignForm's Message tab so the
  // separately rendered Design/structure preview fills data-cp-slot="custom-<id>"
  // slots with the text the merchant is currently editing (not just the last
  // saved value).
  const [liveCustomMessages, setLiveCustomMessages] =
    useState(savedCustomMessages);
  const hasFreeShippingGoal =
    draftCampaignValues.type === "FREE_SHIPPING_GOAL" ||
    draftCampaignValues.goal === "FREE_SHIPPING";
  const updateDraftProgressStyle = (
    progressStyle: CampaignFormValues["freeShippingProgressStyle"],
  ) => {
    setDraftCampaignValues((currentValues) => ({
      ...currentValues,
      freeShippingProgressStyle: progressStyle,
    }));
  };
  const updateCampaignDraftValues = useCallback(
    (nextValues: CampaignFormValues) => {
      setDraftCampaignValues((currentValues) =>
        mergeCampaignDraftNonTargetingValues(currentValues, nextValues),
      );
    },
    [],
  );
  const updateTargetingDraftValues = useCallback(
    (nextValues: CampaignFormValues) => {
      setDraftCampaignValues((currentValues) =>
        mergeCampaignDraftTargetingValues(currentValues, nextValues),
      );
    },
    [],
  );
  const draftPreviewViewModel = useMemo(
    () => ({
      ...designViewModel,
      offer:
        buildActionDiscountOfferPreview(actionData) ?? designViewModel.offer,
      type: draftCampaignValues.type,
      timezone: draftCampaignValues.timezone || designViewModel.timezone,
      headline: draftCampaignValues.headline || designViewModel.headline,
      subheadline: draftCampaignValues.subheadline,
      ctaText: draftCampaignValues.ctaText || designViewModel.ctaText,
      ctaUrl: draftCampaignValues.ctaUrl || designViewModel.ctaUrl,
      expiredText:
        draftCampaignValues.expiredText || designViewModel.expiredText,
      placements:
        draftCampaignValues.placementTypes.length > 0
          ? draftCampaignValues.placementTypes
          : [draftCampaignValues.placementType],
      timer: {
        ...buildCampaignTimerSettingsValues(draftCampaignValues),
        endsAt: draftCampaignValues.endsAt || null,
      },
      freeShipping: hasFreeShippingGoal
        ? buildDraftFreeShippingPreview(draftCampaignValues)
        : null,
    }),
    [actionData, designViewModel, draftCampaignValues, hasFreeShippingGoal],
  );
  const submittingAction = readNavigationAction(navigation.formData);
  const isSavingDraft = submittingAction === "saveDraft";
  const isPublishing = submittingAction === "publishCampaign";
  const discardDraft = () => {
    setDraftCampaignValues(activeCampaignValues);
    setDraftDesignValues(activeDesignValues);
    setDraftMobileDesignValues(activeMobileDesignValues);
    setLiveCustomMessages(savedCustomMessages);
    setStructureDirty(false);
    setDiscardVersion((version) => version + 1);
    window.dispatchEvent(new CustomEvent("promo-pulse:campaign-discard"));
    window.dispatchEvent(
      new CustomEvent("promo-pulse:experiment-auto-winner-discard"),
    );
    window.dispatchEvent(
      new CustomEvent("promo-pulse:behavior-targeting-discard"),
    );
  };

  useEffect(() => {
    const syncDraft = window.setTimeout(() => {
      setDraftCampaignValues(activeCampaignValues);
      setDraftDesignValues(activeDesignValues);
      setDraftMobileDesignValues(activeMobileDesignValues);
      setLiveCustomMessages(savedCustomMessages);
    }, 0);

    return () => window.clearTimeout(syncDraft);
  }, [
    activeCampaignValues,
    activeDesignValues,
    activeMobileDesignValues,
    persistedDraftKey,
    savedCustomMessages,
  ]);

  useShopifySaveBar({
    dirty: hasUnsavedChanges,
    disabled:
      navigation.state === "submitting" ||
      experimentAutoWinnerSaveBarState.saving ||
      behaviorTargetingSaveBarState.saving,
    saving:
      isSavingDraft ||
      experimentAutoWinnerSaveBarState.saving ||
      behaviorTargetingSaveBarState.saving,
  });

  useEffect(() => {
    const handleExperimentAutoWinnerState = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          dirty?: boolean;
          saving?: boolean;
        }>
      ).detail;

      setExperimentAutoWinnerSaveBarState({
        dirty: Boolean(detail?.dirty),
        saving: Boolean(detail?.saving),
      });
    };

    const handleBehaviorTargetingState = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          dirty?: boolean;
          saving?: boolean;
        }>
      ).detail;

      setBehaviorTargetingSaveBarState({
        dirty: Boolean(detail?.dirty),
        saving: Boolean(detail?.saving),
      });
    };

    window.addEventListener(
      "promo-pulse:experiment-auto-winner-state",
      handleExperimentAutoWinnerState,
    );
    window.addEventListener(
      "promo-pulse:behavior-targeting-state",
      handleBehaviorTargetingState,
    );

    return () => {
      window.removeEventListener(
        "promo-pulse:experiment-auto-winner-state",
        handleExperimentAutoWinnerState,
      );
      window.removeEventListener(
        "promo-pulse:behavior-targeting-state",
        handleBehaviorTargetingState,
      );
    };
  }, []);

  const campaignStatusLabel = formatCampaignOption(activeCampaignValues.status);
  const campaignTypeLabel =
    formatUnifiedCampaignTypeLabel(activeCampaignValues);
  const campaignPlacementLabel = formatPlacementSelectionLabel(
    activeCampaignValues.placementTypes,
  );
  const publicationStatus = buildPublicationStatus(
    publication,
    hasCampaignDraftUnsavedChanges,
    activeCampaignValues.status,
  );
  const hasPublishableChanges =
    hasCampaignDraftUnsavedChanges ||
    !publication.hasPublishedVersion ||
    publication.hasUnpublishedChanges;
  const errorAttentionSectionKey = getActionErrorSectionKey(actionData);
  // Lets a control (e.g. the timer progress note in Design) jump to the Campaign
  // section where the schedule lives. Reset shortly after so it can re-fire.
  const [requestedSectionKey, setRequestedSectionKey] = useState<string | null>(
    null,
  );
  const goToSection = (key: string) => {
    setRequestedSectionKey(key);
    window.setTimeout(() => setRequestedSectionKey(null), 200);
  };

  return (
    <>
      <CampaignDraftSaveBar
        disabled={
          navigation.state === "submitting" ||
          experimentAutoWinnerSaveBarState.saving
        }
        saving={isSavingDraft || experimentAutoWinnerSaveBarState.saving}
        onDiscard={discardDraft}
        onSave={() => {
          // Behavior targeting saves independently via a fetcher, so trigger it
          // alongside whatever the active tab needs to persist.
          if (behaviorTargetingSaveBarState.dirty) {
            window.dispatchEvent(
              new CustomEvent("promo-pulse:behavior-targeting-save"),
            );
          }

          if (hasCampaignDraftUnsavedChanges || structureDirty) {
            if (requestCampaignDraftSubmitFromActiveForm("saveDraft")) {
              return;
            }

            window.dispatchEvent(new CustomEvent("promo-pulse:campaign-save"));
            return;
          }

          if (experimentAutoWinnerSaveBarState.dirty) {
            window.dispatchEvent(
              new CustomEvent("promo-pulse:experiment-auto-winner-save"),
            );
          }
        }}
      />
      <s-page inlineSize="large" heading="Edit campaign">
        {assetError && (
          <AppAlert tone="critical" title="Visual assets were not generated">
            <s-paragraph>{assetError}</s-paragraph>
          </AppAlert>
        )}
        <CampaignEditorLayout
          attentionSectionKey={requestedSectionKey ?? errorAttentionSectionKey}
          actionBar={{
            campaignSectionKey: "campaign",
            campaignTypeLabel,
            campaignTypeValue: activeCampaignValues.type,
            formId: "campaign-basics-form",
            isSubmitting: navigation.state === "submitting",
            isPublishing,
            onPublish: () => {
              if (requestCampaignDraftSubmitFromActiveForm("publishCampaign")) {
                return;
              }

              window.dispatchEvent(
                new CustomEvent("promo-pulse:campaign-publish"),
              );
            },
            placementLabel: campaignPlacementLabel,
            publicationState: publicationStatus.state,
            publicationStatusLabel: publicationStatus.label,
            publishDisabled: !hasPublishableChanges,
            publishLabel: publication.hasPublishedVersion
              ? "Publish changes"
              : "Publish",
            statusLabel: campaignStatusLabel,
            statusValue: activeCampaignValues.status,
            experimentRunning: experiments.some(
              (experiment) => experiment.status === "RUNNING",
            ),
            experimentSectionKey: "experiments",
          }}
          sections={[
            {
              key: "campaign",
              label: "Campaign",
              description:
                "Configure the campaign goal, copy, schedule, status, and storefront placement. Product, country, and visitor eligibility now live in Targeting so campaign setup stays focused on what the campaign is and where it appears.",
              content: (
                <CampaignForm
                  campaignId={id}
                  confirmOnSubmit={false}
                  design={draftDesignValues}
                  mobileDesign={draftMobileDesignValues}
                  structureTree={campaignPreviewStructureTree}
                  mobileStructureTree={campaignPreviewMobileStructureTree}
                  structureCss={campaignPreviewStructureCss}
                  mobileStructureCss={campaignPreviewMobileStructureCss}
                  structureMessages={structureMessages}
                  onCustomMessagesChange={setLiveCustomMessages}
                  designHiddenInputs={
                    <>
                      <CampaignDesignDraftHiddenInputs
                        mobileValues={draftMobileDesignValues}
                        values={draftDesignValues}
                      />
                      <StructureFormHiddenInputs structure={structureForm} />
                    </>
                  }
                  formId="campaign-basics-form"
                  hiddenBuilderTabs={["targeting"]}
                  hasSaveBarChanges={
                    hasCampaignDraftUnsavedChanges || structureDirty
                  }
                  idPrefix="campaign-basics"
                  key={`${JSON.stringify(activeCampaignValues)}:${discardVersion}`}
                  lockedTargetingFeatures={{
                    advanced: lockedFeatures.advancedTargeting,
                    basic: lockedFeatures.basicTargeting,
                    geo: lockedFeatures.geoMarketTargeting,
                    recurringTimers: lockedFeatures.recurringTimers,
                    scheduling: lockedFeatures.scheduling,
                  }}
                  messageAddon={
                    lockedFeatures.multiLanguage ? (
                      <PlanUpgradeCallout
                        message={lockedFeatures.multiLanguage}
                        title="Translations are locked"
                      />
                    ) : null
                  }
                  messageInitialLocale={defaultLocale}
                  messageLocales={translationsViewModel.locales.map(
                    (localeOption) => localeOption.locale,
                  )}
                  messageResolvedTranslations={
                    translationsViewModel.resolvedValues
                  }
                  messageTranslationErrors={actionData?.translationErrors}
                  messageTranslations={
                    lockedFeatures.multiLanguage ? undefined : translationValues
                  }
                  mode="edit"
                  previewDevice={sharedPreviewDevice}
                  previewPlacement={sharedPreviewPlacement}
                  previewViewModel={draftPreviewViewModel}
                  showTopbar={false}
                  syncExternalValues
                  targetingOptions={targetingOptions}
                  values={draftCampaignValues}
                  errors={actionData?.errors}
                  onDesignChange={setDraftDesignValues}
                  onMobileDesignChange={setDraftMobileDesignValues}
                  onPreviewDeviceChange={setSharedPreviewDevice}
                  onPreviewPlacementChange={updateSharedPreviewPlacement}
                  onValuesChange={updateCampaignDraftValues}
                />
              ),
            },
            {
              key: "offers",
              label: "Offers",
              description:
                "Connect the promotion to real Shopify discount behavior. Use basic discounts for shared codes, unique codes for per-visitor offers, advanced rules for complex cart logic, and email timers for off-store campaigns.",
              content: (
                <OffersEditor
                  advancedRulesCount={advancedDiscountRules.length}
                  campaignType={activeCampaignValues.type}
                  campaignTypeLabel={formatCampaignOption(
                    activeCampaignValues.type,
                  )}
                  discountMode={
                    (actionData?.discountValues ?? discountValues).mode
                  }
                  sections={[
                    {
                      key: "basic-discount",
                      label: "Basic discount",
                      description:
                        "Shared Shopify code or linked existing discount.",
                      content: (
                        <DiscountSettingsEditor
                          apiError={discountApiError}
                          discountOptions={discountOptions}
                          errors={actionData?.discountErrors}
                          lockedReason={lockedFeatures.discountSync}
                          notice={actionData?.discountNotice}
                          values={actionData?.discountValues ?? discountValues}
                        />
                      ),
                    },
                    {
                      key: "unique-codes",
                      label: "Unique codes",
                      description:
                        "One generated discount code per visitor/session.",
                      content: (
                        <UniqueCodesEditor
                          codes={uniqueCodes}
                          errors={actionData?.uniqueCodeErrors}
                          lockedReason={lockedFeatures.uniqueCodes}
                          notice={actionData?.uniqueCodeNotice}
                          pools={uniqueCodePools}
                          stats={uniqueCodeStats}
                          values={
                            actionData?.uniqueCodeValues ??
                            actionData?.discountValues ??
                            discountValues
                          }
                        />
                      ),
                    },
                    {
                      key: "advanced-rules",
                      label: "Advanced rules",
                      description:
                        "Shopify Functions logic for complex cart offers.",
                      content: (
                        <AdvancedDiscountRulesEditor
                          errors={actionData?.advancedDiscountErrors}
                          lockedReason={lockedFeatures.advancedDiscounts}
                          notice={actionData?.advancedDiscountNotice}
                          rules={advancedDiscountRules}
                        />
                      ),
                    },
                    {
                      key: "email-timer",
                      label: "Email timer",
                      description: "Countdown image URL for email campaigns.",
                      content: (
                        <EmailTimerEditor
                          errors={actionData?.emailTimerErrors}
                          lockedReason={lockedFeatures.emailTimers}
                          timers={emailTimers}
                        />
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: "experiments",
              label: "Experiments",
              description:
                "Create variants, define traffic split and the primary metric, review performance, and apply a winner when the result is clear enough to replace the live campaign.",
              content: (
                <ExperimentsEditor
                  baseDesign={activeDesignValues}
                  baseViewModel={draftPreviewViewModel}
                  designMediaOptions={designMediaOptions}
                  errors={actionData?.experimentErrors}
                  experiments={experiments}
                  isProPlan={isProPlan}
                  lockedReason={lockedFeatures.experiments}
                  notice={actionData?.experimentNotice}
                />
              ),
            },
            {
              key: "targeting",
              label: "Targeting",
              description:
                "Control who can see this campaign across product eligibility, collections, tags, countries, and consent-safe behavior signals. Placement decides where the widget appears; targeting decides whether a shopper is eligible.",
              content: (
                <div className="counterpulse-targeting-section-stack">
                  <CampaignForm
                    campaignId={id}
                    confirmOnSubmit={false}
                    design={draftDesignValues}
                    mobileDesign={draftMobileDesignValues}
                    structureTree={savedStructureTree}
                    structureCss={structureCss}
                    designHiddenInputs={
                      <CampaignDesignDraftHiddenInputs
                        mobileValues={draftMobileDesignValues}
                        values={draftDesignValues}
                      />
                    }
                    formId="campaign-targeting-form"
                    hiddenBuilderTabs={[
                      "setup",
                      "message",
                      "placement",
                      "schedule",
                      "review",
                    ]}
                    idPrefix="campaign-targeting"
                    initialTab="targeting"
                    key={`targeting:${JSON.stringify(activeCampaignValues)}:${discardVersion}`}
                    lockedTargetingFeatures={{
                      advanced: lockedFeatures.advancedTargeting,
                      basic: lockedFeatures.basicTargeting,
                      geo: lockedFeatures.geoMarketTargeting,
                      recurringTimers: lockedFeatures.recurringTimers,
                      scheduling: lockedFeatures.scheduling,
                    }}
                    listenForSaveEvents={false}
                    mode="edit"
                    previewDevice={sharedPreviewDevice}
                    previewPlacement={sharedPreviewPlacement}
                    showBuilderTabs={false}
                    showPreview={false}
                    showTopbar={false}
                    syncExternalValues
                    targetingOptions={targetingOptions}
                    values={draftCampaignValues}
                    errors={actionData?.errors}
                    onDesignChange={setDraftDesignValues}
                    onMobileDesignChange={setDraftMobileDesignValues}
                    onPreviewDeviceChange={setSharedPreviewDevice}
                    onPreviewPlacementChange={updateSharedPreviewPlacement}
                    onValuesChange={updateTargetingDraftValues}
                  />
                  <BehaviorTargetingEditor
                    key={`behavior:${JSON.stringify(behaviorTargetingValues)}`}
                    errors={actionData?.behaviorTargetingErrors}
                    lockedReason={lockedFeatures.behaviorTargeting}
                    notice={actionData?.behaviorTargetingNotice}
                    values={
                      actionData?.behaviorTargetingValues ??
                      behaviorTargetingValues
                    }
                  />
                </div>
              ),
            },
            {
              key: "markets",
              label: "Markets",
              description:
                "Configure Shopify Market rules that affect campaign eligibility, currency matching, free-shipping thresholds, and delivery promises. Campaign copy stays language-based in Campaign > Message.",
              content: (
                <CampaignMarketsEditor
                  apiError={marketApiError}
                  errors={actionData?.marketErrors}
                  lockedReason={lockedFeatures.markets}
                  locales={translationsViewModel.locales.map(
                    (localeOption) => localeOption.locale,
                  )}
                  markets={marketOptions}
                  notice={actionData?.marketNotice}
                  rules={marketRules}
                />
              ),
            },
            {
              key: "design",
              label: "Design",
              description:
                "Control visual presets, layouts, colors, gradients, typography, timer treatment, icon behavior, width, positioning, and the live placement preview used to validate the final storefront presentation.",
              content: (
                <CampaignDesignEditor
                  designMediaOptions={designMediaOptions}
                  errors={actionData?.designErrors}
                  design={draftDesignValues}
                  mobileDesign={draftMobileDesignValues}
                  customMessages={liveCustomMessages}
                  isProPlan={isProPlan}
                  lockedCustomCssReason={lockedFeatures.customCss}
                  progressStyle={
                    hasFreeShippingGoal
                      ? draftCampaignValues.freeShippingProgressStyle
                      : undefined
                  }
                  previewDevice={sharedPreviewDevice}
                  previewPlacement={sharedPreviewPlacement}
                  onChange={setDraftDesignValues}
                  onMobileChange={setDraftMobileDesignValues}
                  onPreviewDeviceChange={setSharedPreviewDevice}
                  onPreviewPlacementChange={updateSharedPreviewPlacement}
                  onProgressStyleChange={updateDraftProgressStyle}
                  viewModel={draftPreviewViewModel}
                  structureEdited={structureEdited}
                  structureHtml={structureHtml}
                  structureCss={structureCss}
                  mobileStructureEdited={mobileStructureEdited}
                  mobileStructureHtml={mobileStructureHtml}
                  mobileStructureCss={mobileStructureCss}
                  resetSignal={discardVersion}
                  onStructureDirtyChange={setStructureDirty}
                  onStructureChange={setStructureForm}
                  onGoToSchedule={() => goToSection("campaign")}
                />
              ),
            },
          ]}
        />
      </s-page>
    </>
  );
}

const campaignDraftSaveBarId = "counterpulse-campaign-draft-save-bar";

function buildActionDiscountOfferPreview(
  actionData: ActionData | undefined,
): CampaignViewModel["offer"] | undefined {
  const discountValues = actionData?.uniqueCodeNotice
    ? actionData.uniqueCodeValues
    : actionData?.discountNotice
      ? actionData.discountValues
      : undefined;

  if (!discountValues) return undefined;

  return buildDiscountOfferPreviewFromValues(discountValues);
}

function buildDiscountOfferPreviewFromValues(
  values: DiscountSettingsValues,
): CampaignViewModel["offer"] {
  if (values.mode === "UNIQUE_CODES") {
    return {
      method: "UNIQUE_CODE",
      code: buildPreviewUniqueCode(values.uniqueCodePrefix),
      isUniqueCode: true,
      canApply: values.uniqueCodeAutoApply !== false,
    };
  }

  if (values.mode === "CREATE_NEW" || values.mode === "LINK_EXISTING") {
    const code = (
      values.discountCode ||
      values.existingCodeOrId ||
      values.shopifyDiscountId
    ).trim();

    if (!code) return null;

    return {
      method: "CODE",
      code,
      isUniqueCode: false,
      canApply: true,
    };
  }

  return null;
}

function buildPreviewUniqueCode(prefix: string | null | undefined) {
  const normalizedPrefix = (prefix || "PP")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 16);

  return `${normalizedPrefix || "PP"}-A1B2C3`;
}

const campaignTargetingDraftFields = [
  "productSelection",
  "productIds",
  "excludeProductIds",
  "collectionIds",
  "productTags",
  "urlContains",
  "excludedUrlContains",
  "countrySelection",
  "countries",
] as const satisfies ReadonlyArray<keyof CampaignFormValues>;

function mergeCampaignDraftNonTargetingValues(
  currentValues: CampaignFormValues,
  nextValues: CampaignFormValues,
) {
  const mergedValues: CampaignFormValues = { ...nextValues };

  for (const field of campaignTargetingDraftFields) {
    mergedValues[field] = currentValues[field] as never;
  }

  return areCampaignFormValuesEqual(currentValues, mergedValues)
    ? currentValues
    : mergedValues;
}

function mergeCampaignDraftTargetingValues(
  currentValues: CampaignFormValues,
  nextValues: CampaignFormValues,
) {
  const mergedValues: CampaignFormValues = { ...currentValues };

  for (const field of campaignTargetingDraftFields) {
    mergedValues[field] = nextValues[field] as never;
  }

  return areCampaignFormValuesEqual(currentValues, mergedValues)
    ? currentValues
    : mergedValues;
}

function areCampaignFormValuesEqual(
  currentValues: CampaignFormValues,
  nextValues: CampaignFormValues,
) {
  return JSON.stringify(currentValues) === JSON.stringify(nextValues);
}

function requestCampaignDraftSubmitFromActiveForm(
  action: "saveDraft" | "publishCampaign",
) {
  const activeForm =
    document.querySelector<HTMLFormElement>(
      ".counterpulse-editor-panel:not([hidden]) form[data-campaign-form]",
    ) ?? document.querySelector<HTMLFormElement>("form[data-campaign-form]");

  if (!activeForm) return false;

  const actionInput = activeForm.elements.namedItem("_action");

  if (actionInput instanceof HTMLInputElement) {
    actionInput.value = action;
  }

  activeForm.requestSubmit();
  return true;
}

function CampaignDraftSaveBar({
  disabled,
  onDiscard,
  onSave,
  saving,
}: {
  disabled: boolean;
  onDiscard: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <ui-save-bar id={campaignDraftSaveBarId}>
      <button
        disabled={disabled}
        type="button"
        variant="primary"
        onClick={onSave}
      >
        {saving ? "Saving..." : "Save"}
      </button>
      <button disabled={disabled} type="button" onClick={onDiscard}>
        Discard
      </button>
    </ui-save-bar>
  );
}

function useShopifySaveBar({
  dirty,
  disabled,
  saving,
}: {
  dirty: boolean;
  disabled: boolean;
  saving: boolean;
}) {
  useEffect(() => {
    const saveBar = window.shopify?.saveBar;

    if (!saveBar) return;

    if (dirty && !disabled) {
      void saveBar.show(campaignDraftSaveBarId);
      return;
    }

    if (!saving) {
      void saveBar.hide(campaignDraftSaveBarId);
    }
  }, [dirty, disabled, saving]);

  useEffect(
    () => () => {
      void window.shopify?.saveBar?.hide(campaignDraftSaveBarId);
    },
    [],
  );
}

function buildDraftFreeShippingPreview(
  values: CampaignFormValues,
): CampaignViewModel["freeShipping"] {
  const settings = buildCampaignFreeShippingSettingsValues(values);
  const thresholdAmount = Number(settings.thresholdAmount);

  return {
    thresholdAmount: Number.isFinite(thresholdAmount) ? thresholdAmount : 0,
    currencyCode: settings.currencyCode,
    includeDiscountedSubtotal: settings.includeDiscountedSubtotal,
    emptyCartMessage: settings.emptyCartMessage,
    successMessage: settings.successMessage,
    progressStyle: settings.progressStyle,
  };
}

function CampaignDesignDraftHiddenInputs({
  mobileValues,
  values,
}: {
  mobileValues: CampaignDesignValues;
  values: CampaignDesignValues;
}) {
  return (
    <>
      <input
        name="mobileDesignJson"
        type="hidden"
        value={JSON.stringify(mobileValues)}
      />
      {Object.entries(values).map(([key, value]) => (
        <input
          key={key}
          name={key}
          type="hidden"
          value={typeof value === "boolean" ? String(value) : String(value)}
        />
      ))}
    </>
  );
}

// Structure overrides (lifted from the design editor) as hidden inputs so they
// submit with the campaign form. parseCampaignStructureForm reads these names.
function StructureFormHiddenInputs({
  structure,
}: {
  structure: StructureFormPayload | null;
}) {
  if (!structure) return null;
  return (
    <>
      <input
        name="structureEdited"
        type="hidden"
        value={structure.structureEdited ? "true" : "false"}
      />
      <input
        name="structureHtml"
        type="hidden"
        value={structure.structureHtml}
      />
      <input name="structureCss" type="hidden" value={structure.structureCss} />
      <input
        name="mobileStructureEdited"
        type="hidden"
        value={structure.mobileStructureEdited ? "true" : "false"}
      />
      <input
        name="mobileStructureHtml"
        type="hidden"
        value={structure.mobileStructureHtml}
      />
      <input
        name="mobileStructureCss"
        type="hidden"
        value={structure.mobileStructureCss}
      />
    </>
  );
}

function readNavigationAction(formData: FormData | undefined) {
  const action = formData?.get("_action");

  return typeof action === "string" ? action : "";
}

function getActionErrorSectionKey(actionData: ActionData | undefined) {
  if (!actionData) return undefined;
  if (hasErrorValues(actionData.designErrors)) return "design";
  if (
    hasErrorValues(actionData.discountErrors) ||
    hasErrorValues(actionData.uniqueCodeErrors) ||
    hasErrorValues(actionData.advancedDiscountErrors) ||
    hasErrorValues(actionData.emailTimerErrors)
  ) {
    return "offers";
  }
  if (hasErrorValues(actionData.experimentErrors)) return "experiments";
  if (
    hasErrorValues(actionData.behaviorTargetingErrors) ||
    hasErrorValues(actionData.marketErrors)
  ) {
    return "targeting";
  }
  if (
    hasErrorValues(actionData.errors) ||
    hasErrorValues(actionData.translationErrors)
  ) {
    return "campaign";
  }

  return undefined;
}

function hasErrorValues(errors: unknown) {
  return (
    !!errors &&
    typeof errors === "object" &&
    Object.values(errors).some(Boolean)
  );
}

function buildPublicationStatus(
  publication: LoaderData["publication"],
  hasUnsavedChanges: boolean,
  status: CampaignFormValues["status"],
) {
  if (hasUnsavedChanges) {
    return {
      label: "Unsaved changes",
      state: "unsaved" as const,
    };
  }

  if (!publication.hasPublishedVersion) {
    return {
      label: "Not published",
      state: "not-published" as const,
    };
  }

  if (publication.hasUnpublishedChanges) {
    return {
      label: "Saved changes not published",
      state: "saved-unpublished" as const,
    };
  }

  if (status !== "ACTIVE") {
    return {
      label: "Published, inactive",
      state: "published-inactive" as const,
    };
  }

  return {
    label: "LIVE",
    state: "live" as const,
  };
}
