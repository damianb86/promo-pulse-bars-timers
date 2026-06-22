import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation } from "react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AdvancedDiscountRuleStatus,
  AdvancedDiscountRuleType,
  EmailTimerExpiredBehavior,
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
  Prisma,
} from "@prisma/client";

import {
  AdvancedDiscountRulesEditor,
  type AdvancedDiscountRuleErrors,
  type AdvancedDiscountRuleRow,
} from "../components/AdvancedDiscountRulesEditor";
import {
  BehaviorTargetingEditor,
  type BehaviorTargetingErrors,
} from "../components/BehaviorTargetingEditor";
import { CampaignDesignEditor } from "../components/CampaignDesignEditor";
import { CampaignEditorLayout } from "../components/CampaignEditorLayout";
import { CampaignForm } from "../components/CampaignForm";
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
import {
  hasCampaignDesignErrors,
  parseResponsiveCampaignDesignFormData,
} from "../services/campaign-design-form.server";
import {
  loadCampaignDesignFileOption,
  loadCampaignDesignMediaOptions,
} from "../services/campaign-design-media.server";
import {
  hasCampaignFormErrors,
  parseCampaignFormData,
} from "../services/campaign-form.server";
import { loadCampaignTargetingOptions } from "../services/campaign-targeting-options.server";
import { getShopSettingsOrDefaults } from "../services/shopSettings.server";
import {
  hasCampaignTranslationErrors,
  parseCampaignTranslationsFormData,
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
  type AdvancedDiscountRuleInput,
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
  autoDeclareWinningVariant,
  calculateExperimentResults,
  createExperiment,
  declareWinningVariant,
  listExperimentsForCampaign,
  pauseExperiment,
  startExperiment,
  stopExperiment,
  updateExperiment,
  updateExperimentAutoWinner,
  type ExperimentResults,
  type ExperimentVariantInput,
} from "../services/experiments";
import {
  buildEmailTimerImageUrl,
  buildEmailTimerSnippet,
  createEmailTimerForCampaign,
  listEmailTimersForCampaign,
  type EmailTimerDesignInput,
  type EmailTimerFontFamily,
} from "../services/email-timers/emailTimers.server";
import {
  deleteMarketRule,
  fetchShopMarkets,
  listMarketRulesForCampaign,
  saveMarketRule,
  type MarketRuleInput,
  type ShopifyMarket,
} from "../services/markets/markets.server";
import {
  createBasicCodeDiscount,
  createFreeShippingCodeDiscount,
  getDiscountByCodeOrId,
  listCodeDiscounts,
  SHOPIFY_DISCOUNT_SCOPE_MESSAGE,
  syncCampaignDatesFromDiscount,
  type ShopifyGraphqlClient,
  type ShopifyDiscountSummary,
} from "../services/shopifyDiscounts.server";
import {
  canUseFeature,
  getEffectiveShopPlan,
  getLockedFeatureReason,
  validateCampaignPlanAccess,
} from "../services/planLimits.server";
import { canUsePremiumFeature } from "../services/premiumFeatures.server";
import {
  defaultBadgeSettingsValues,
  toBadgePosition,
  toBadgeShape,
  type BadgeSettingsValues,
} from "../types/badge";
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
  defaultCampaignDesignValues,
  emptyCampaignDesignMediaOptions,
} from "../types/campaign-design";
import {
  campaignEditableStatusOptions,
  campaignGoalOptions,
  campaignTypeOptions,
  formatCampaignOption,
  getDefaultPlacementForCampaignType,
  placementTypeOptions,
  type CampaignGoalValue,
  type CampaignTypeValue,
  type EditableCampaignStatusValue,
  type PlacementTypeValue,
} from "../types/campaign-options";
import {
  buildCampaignBadgeSettingsValues,
  buildCampaignDeliveryCutoffSettingsValues,
  buildCampaignLowStockSettingsValues,
  defaultCampaignFormValues,
  buildCampaignTimerSettingsValues,
  buildCampaignTargetingValues,
  buildCampaignFreeShippingSettingsValues,
  emptyCampaignTargetingOptions,
  type CampaignFormErrors,
  type CampaignFormValues,
  type CampaignTargetingOptions,
  type CountrySelectionValue,
  type ProductSelectionValue,
} from "../types/campaign-form";
import {
  defaultDeliveryCutoffSettingsValues,
  toAfterCutoffBehavior,
  type DeliveryCutoffSettingsValues,
} from "../types/delivery-cutoff";
import {
  defaultDiscountSettingsValues,
  type DiscountOption,
  type DiscountSettingsErrors,
  type DiscountSettingsValues,
} from "../types/discount";
import {
  defaultFreeShippingSettingsValues,
  type FreeShippingSettingsValues,
} from "../types/free-shipping";
import {
  defaultLowStockSettingsValues,
  type LowStockSettingsValues,
} from "../types/low-stock";
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

type LoaderData = {
  id: string;
  values: CampaignFormValues;
  targetingOptions: CampaignTargetingOptions;
  designValues: CampaignDesignValues;
  mobileDesignValues: CampaignDesignValues;
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
  const designValues = toCampaignDesignValues(campaign.design);
  const mobileDesignValues = toCampaignMobileDesignValues(
    campaign.design,
    designValues,
  );
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
        defaultCampaignFormValues.cartTimerDurationMinutes,
      cartTimerResetBehavior: defaultCampaignFormValues.cartTimerResetBehavior,
      productSelection,
      productIds: targetingListText(campaign.targeting?.productIds),
      excludeProductIds: targetingListText(
        campaign.targeting?.excludeProductIds,
      ),
      collectionIds: targetingListText(campaign.targeting?.collectionIds),
      productTags: targetingListText(campaign.targeting?.productTags),
      customSelector: placement?.customSelector ?? "",
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

export const action = async ({
  params,
  request,
}: ActionFunctionArgs): Promise<ActionData | Response> => {
  const { admin, session, redirect } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const id = params.id;

  if (!id) {
    return { errors: { form: "Campaign id is required." } };
  }

  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "saveBasics");
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

  if (intent === "saveDesign") {
    const parsed = parseResponsiveCampaignDesignFormData(
      formData,
      effectivePlan,
    );

    if (hasCampaignDesignErrors(parsed.errors)) {
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
      );
      return redirect(`/app/campaigns/${id}`);
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

    const parsed = parseCampaignTranslationsFormData(formData);

    if (hasCampaignTranslationErrors(parsed.errors)) {
      return {
        translationErrors: parsed.errors,
        translationValues: parsed.values,
      };
    }

    try {
      await updateCampaignTranslationsForShop(id, shop.id, parsed.translations);
      return redirect(`/app/campaigns/${id}`);
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
        return redirect(`/app/campaigns/${id}`);
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

        return redirect(`/app/campaigns/${id}`);
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
          uniqueCodeStartsAt: parsed.startsAt,
          uniqueCodeEndsAt: parsed.endsAt,
        });

        return redirect(`/app/campaigns/${id}`);
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

      return redirect(`/app/campaigns/${id}`);
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

    if (!enabled) {
      await clearDiscountSyncForShop(id, shop.id);
      return redirect(`/app/campaigns/${id}`);
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
        uniqueCodePrefix: parsed.values.uniqueCodePrefix,
        uniqueCodeExpiresMinutes: parsed.uniqueCodeExpiresMinutes,
        uniqueCodeAutoApply: parsed.values.uniqueCodeAutoApply,
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
      });
      const result = await generateCodeBatch({
        shopId: shop.id,
        campaignId: id,
        poolId: pool.id,
        totalCodes: totalCodesToGenerate.value,
        admin,
      });

      return {
        uniqueCodeNotice: `Generated ${result.codes.length} unique codes.`,
        uniqueCodeValues: parsed.values,
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

      return redirect(`/app/campaigns/${id}`);
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

        return redirect(`/app/campaigns/${id}`);
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

      return redirect(`/app/campaigns/${id}`);
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

        return redirect(`/app/campaigns/${id}`);
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
        return {
          advancedDiscountNotice: result.warning,
        };
      }

      return redirect(`/app/campaigns/${id}`);
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
    intent === "detectExperimentWinner" ||
    intent === "applyExperimentWinner"
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

        return redirect(`/app/campaigns/${id}`);
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
        const parsed = parseExperimentFormData(formData);

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
      } else if (intent === "detectExperimentWinner") {
        const result = await autoDeclareWinningVariant({
          shopId: shop.id,
          experimentId,
        });

        if (!result.declared) {
          return {
            experimentErrors: {
              form: "No winner met the configured sample, runtime, and confidence rules.",
            },
          };
        }
      } else if (intent === "applyExperimentWinner") {
        await applyWinningVariantToCampaign({
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

      return redirect(`/app/campaigns/${id}`);
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
    ? parseCampaignTranslationsFormData(formData)
    : null;
  const isPublishRequest = intent === "publishCampaign";

  if (
    hasCampaignFormErrors(parsed.errors) ||
    hasCampaignDesignErrors(parsedDesign.errors) ||
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
  const isFreeShippingCampaign =
    parsed.values.type === "FREE_SHIPPING_GOAL" ||
    parsed.values.goal === "FREE_SHIPPING";
  const isDeliveryCutoffCampaign =
    parsed.values.type === "DELIVERY_CUTOFF" ||
    parsed.values.goal === "DELIVERY_CUTOFF";
  const isLowStockCampaign =
    parsed.values.type === "LOW_STOCK" ||
    parsed.values.goal === "LOW_STOCK_URGENCY";
  const isBadgeCampaign =
    parsed.values.type === "PRODUCT_BADGE" ||
    parsed.values.goal === "PRODUCT_BADGE";
  const baseTranslationValues = parsedTranslations?.values.en;

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

    if (isFreeShippingCampaign && parsed.values.freeShippingAutoDiscount) {
      const discountGate = canUseFeature(shop, "discount_sync");

      if (!discountGate.allowed) {
        return {
          values: parsed.values,
          designValues: parsedDesign.values,
          mobileDesignValues: parsedDesign.mobileValues,
          errors: {
            freeShippingDiscountCode: discountGate.reason,
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
      targeting,
      headline: baseTranslationValues?.headline ?? parsed.values.headline,
      subheadline:
        baseTranslationValues?.subheadline ?? parsed.values.subheadline,
      ctaText: baseTranslationValues?.ctaText ?? parsed.values.ctaText,
      ctaUrl: baseTranslationValues?.ctaUrl ?? parsed.values.ctaUrl,
      expiredText:
        baseTranslationValues?.expiredText ?? parsed.values.expiredText,
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
    );

    if (isFreeShippingCampaign) {
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
      }
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
      errors: {
        form: isPublishRequest
          ? "Campaign could not be published. Check the fields and try again."
          : "Campaign draft could not be saved. Check the fields and try again.",
      },
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
  const hasUnsavedChanges = currentDraftKey !== persistedDraftKey;
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
  const draftPreviewViewModel = useMemo(
    () => ({
      ...designViewModel,
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
    [designViewModel, draftCampaignValues, hasFreeShippingGoal],
  );
  const submittingAction = readNavigationAction(navigation.formData);
  const isSavingDraft = submittingAction === "saveDraft";
  const isPublishing = submittingAction === "publishCampaign";
  const discardDraft = () => {
    setDraftCampaignValues(activeCampaignValues);
    setDraftDesignValues(activeDesignValues);
    setDraftMobileDesignValues(activeMobileDesignValues);
    setDiscardVersion((version) => version + 1);
    window.dispatchEvent(new CustomEvent("promo-pulse:campaign-discard"));
  };

  useEffect(() => {
    const syncDraft = window.setTimeout(() => {
      setDraftCampaignValues(activeCampaignValues);
      setDraftDesignValues(activeDesignValues);
      setDraftMobileDesignValues(activeMobileDesignValues);
    }, 0);

    return () => window.clearTimeout(syncDraft);
  }, [
    activeCampaignValues,
    activeDesignValues,
    activeMobileDesignValues,
    persistedDraftKey,
  ]);

  useShopifySaveBar({
    dirty: hasUnsavedChanges,
    disabled: navigation.state === "submitting",
    saving: isSavingDraft,
  });

  const campaignStatusLabel = formatCampaignOption(activeCampaignValues.status);
  const campaignTypeLabel =
    formatUnifiedCampaignTypeLabel(activeCampaignValues);
  const campaignPlacementLabel = formatPlacementSelectionLabel(
    activeCampaignValues.placementTypes,
  );
  const publicationStatus = buildPublicationStatus(
    publication,
    hasUnsavedChanges,
  );
  const errorAttentionSectionKey = getActionErrorSectionKey(actionData);

  return (
    <>
      <CampaignDraftSaveBar
        disabled={navigation.state === "submitting"}
        saving={isSavingDraft}
        onDiscard={discardDraft}
        onSave={() => {
          window.dispatchEvent(new CustomEvent("promo-pulse:campaign-save"));
        }}
      />
      <s-page inlineSize="large" heading="Edit campaign">
        <CampaignEditorLayout
          attentionSectionKey={errorAttentionSectionKey}
          actionBar={{
            campaignSectionKey: "campaign",
            campaignTypeLabel,
            formId: "campaign-basics-form",
            isSubmitting: navigation.state === "submitting",
            isPublishing,
            onPublish: () => {
              window.dispatchEvent(
                new CustomEvent("promo-pulse:campaign-publish"),
              );
            },
            placementLabel: campaignPlacementLabel,
            publicationState: publicationStatus.state,
            publicationStatusLabel: publicationStatus.label,
            publishLabel: publication.hasPublishedVersion
              ? "Publish changes"
              : "Publish",
            statusLabel: campaignStatusLabel,
            statusValue: activeCampaignValues.status,
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
                  designHiddenInputs={
                    <CampaignDesignDraftHiddenInputs
                      mobileValues={draftMobileDesignValues}
                      values={draftDesignValues}
                    />
                  }
                  formId="campaign-basics-form"
                  hiddenBuilderTabs={["targeting"]}
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
                  messageResolvedTranslations={
                    translationsViewModel.resolvedValues
                  }
                  messageTranslationErrors={actionData?.translationErrors}
                  messageTranslations={
                    lockedFeatures.multiLanguage ? undefined : translationValues
                  }
                  mode="edit"
                  showTopbar={false}
                  syncExternalValues
                  targetingOptions={targetingOptions}
                  values={draftCampaignValues}
                  errors={actionData?.errors}
                  onDesignChange={setDraftDesignValues}
                  onMobileDesignChange={setDraftMobileDesignValues}
                  onValuesChange={setDraftCampaignValues}
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
              label: "A/B testing",
              description:
                "Create variants, define traffic split and the primary metric, review performance, and apply a winner when the result is clear enough to replace the live campaign.",
              content: (
                <ExperimentsEditor
                  errors={actionData?.experimentErrors}
                  experiments={experiments}
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
                    showBuilderTabs={false}
                    showPreview={false}
                    showTopbar={false}
                    syncExternalValues
                    targetingOptions={targetingOptions}
                    values={draftCampaignValues}
                    errors={actionData?.errors}
                    onDesignChange={setDraftDesignValues}
                    onMobileDesignChange={setDraftMobileDesignValues}
                    onValuesChange={setDraftCampaignValues}
                  />
                  <BehaviorTargetingEditor
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
                  isProPlan={isProPlan}
                  lockedCustomCssReason={lockedFeatures.customCss}
                  progressStyle={
                    hasFreeShippingGoal
                      ? draftCampaignValues.freeShippingProgressStyle
                      : undefined
                  }
                  onChange={setDraftDesignValues}
                  onMobileChange={setDraftMobileDesignValues}
                  onProgressStyleChange={updateDraftProgressStyle}
                  viewModel={draftPreviewViewModel}
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
      label: "Saved changes not live",
      state: "saved-unpublished" as const,
    };
  }

  return {
    label: "Live",
    state: "live" as const,
  };
}

function formatUnifiedCampaignTypeLabel(values: CampaignFormValues) {
  if (values.type === "PRODUCT_TIMER") return "Product timer";
  if (values.goal === "ANNOUNCEMENT") return "Announcement";

  return (
    campaignGoalOptions.find((option) => option.value === values.goal)?.label ??
    formatCampaignOption(values.type)
  );
}

function toDateTimeLocalValue(date: Date | string | null) {
  if (!date) return "";
  const parsedDate = typeof date === "string" ? new Date(date) : date;

  if (Number.isNaN(parsedDate.getTime())) return "";

  const localDate = new Date(
    parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000,
  );

  return localDate.toISOString().slice(0, 16);
}

function toCampaignTimerFormValues(
  timerSettings: {
    durationMinutes?: number | null;
    expiredBehavior?: string | null;
    mode?: string | null;
    recurringDays?: unknown;
    resetBehavior?: string | null;
  } | null,
): Pick<
  CampaignFormValues,
  | "timerDurationMinutes"
  | "timerExpiredBehavior"
  | "timerMode"
  | "timerRecurringHour"
  | "timerRecurringMinute"
  | "timerResetBehavior"
> {
  const recurringCutoff = readRecurringCutoff(timerSettings?.recurringDays);

  return {
    timerMode:
      timerSettings?.mode === "EVERGREEN_SESSION" ||
      timerSettings?.mode === "RECURRING_DAILY"
        ? timerSettings.mode
        : "FIXED_DATE",
    timerDurationMinutes: String(timerSettings?.durationMinutes ?? 120),
    timerResetBehavior:
      timerSettings?.resetBehavior === "NEVER" ||
      timerSettings?.resetBehavior === "DAILY" ||
      timerSettings?.resetBehavior === "WEEKLY"
        ? timerSettings.resetBehavior
        : "ON_SESSION_END",
    timerExpiredBehavior:
      timerSettings?.expiredBehavior === "HIDE_TIMER" ||
      timerSettings?.expiredBehavior === "REPEAT_COUNTDOWN" ||
      timerSettings?.expiredBehavior === "SHOW_CUSTOM_TITLE" ||
      timerSettings?.expiredBehavior === "DO_NOTHING"
        ? timerSettings.expiredBehavior
        : "UNPUBLISH_TIMER",
    timerRecurringHour: String(recurringCutoff.hour),
    timerRecurringMinute: String(recurringCutoff.minute),
  };
}

function readRecurringCutoff(value: unknown) {
  const firstRule = Array.isArray(value) ? value[0] : value;

  if (!firstRule || typeof firstRule !== "object") {
    return { hour: 23, minute: 59 };
  }

  const rule = firstRule as {
    cutoffHour?: unknown;
    cutoffMinute?: unknown;
    hour?: unknown;
    minute?: unknown;
  };
  const hour = Number(rule.cutoffHour ?? rule.hour);
  const minute = Number(rule.cutoffMinute ?? rule.minute);

  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 23,
    minute:
      Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 59,
  };
}

function parseTotalCodesToGenerate(
  formData: FormData,
): { ok: true; value: number } | { ok: false; error: string } {
  const value = Number(formData.get("totalCodesToGenerate"));

  if (!Number.isInteger(value) || value < 1 || value > 500) {
    return {
      ok: false,
      error: "Generate between 1 and 500 codes at a time.",
    };
  }

  return { ok: true, value };
}

function parseBehaviorTargetingFormData(formData: FormData): {
  values: BehaviorTargetingRules;
  errors: BehaviorTargetingErrors;
} {
  const errors: BehaviorTargetingErrors = {};
  const rawValues = {
    enabled: isFormCheckboxChecked(formData, "behaviorEnabled"),
    segments: formData.getAll("behaviorSegments").map(String),
    campaignIds: parseMultilineIds(formData.get("behaviorCampaignIds")),
    lookbackDays: readBehaviorInteger(
      formData,
      "behaviorLookbackDays",
      30,
      1,
      365,
      "lookbackDays",
      errors,
    ),
    inactiveCartMinutes: readBehaviorInteger(
      formData,
      "behaviorInactiveCartMinutes",
      60,
      15,
      10080,
      "inactiveCartMinutes",
      errors,
    ),
    highIntentMinEvents: readBehaviorInteger(
      formData,
      "behaviorHighIntentMinEvents",
      3,
      2,
      20,
      "highIntentMinEvents",
      errors,
    ),
    highIntentWindowMinutes: readBehaviorInteger(
      formData,
      "behaviorHighIntentWindowMinutes",
      60,
      5,
      1440,
      "highIntentWindowMinutes",
      errors,
    ),
  };
  const values = normalizeBehaviorTargetingRules(rawValues);

  if (values.enabled && values.segments.length === 0) {
    errors.form =
      "Choose at least one behavior segment or disable behavior targeting.";
  }

  return { values, errors };
}

function readBehaviorInteger(
  formData: FormData,
  key: string,
  fallback: number,
  min: number,
  max: number,
  field: keyof BehaviorTargetingErrors,
  errors: BehaviorTargetingErrors,
) {
  const rawValue = readFormString(formData, key);
  const parsed = Number(rawValue);

  if (!rawValue) return fallback;

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    errors[field] = `Enter a whole number from ${min} to ${max}.`;
    return fallback;
  }

  return parsed;
}

function parseEmailTimerFormData(formData: FormData): {
  errors: EmailTimerErrors;
  design: EmailTimerDesignInput;
  expiredBehavior: EmailTimerExpiredBehavior;
} {
  const errors: EmailTimerErrors = {};
  const width = Number(formData.get("emailTimerWidth"));
  const height = Number(formData.get("emailTimerHeight"));
  const cornerRadius = Number(formData.get("emailTimerCornerRadius"));
  const borderWidth = Number(formData.get("emailTimerBorderWidth"));
  const paddingX = Number(formData.get("emailTimerPaddingX"));
  const paddingY = Number(formData.get("emailTimerPaddingY"));
  const presetKey = readEmailTimerPresetKey(
    String(formData.get("emailTimerPresetKey") ?? ""),
  );
  const fontFamily = readEmailTimerFontFamily(
    String(formData.get("emailTimerFontFamily") ?? ""),
  );
  const backgroundColor = readEmailTimerHexColor(
    formData.get("emailTimerBackgroundColor"),
    "#111827",
    "backgroundColor",
    errors,
  );
  const textColor = readEmailTimerHexColor(
    formData.get("emailTimerTextColor"),
    "#FFFFFF",
    "textColor",
    errors,
  );
  const accentColor = readEmailTimerHexColor(
    formData.get("emailTimerAccentColor"),
    "#F97316",
    "accentColor",
    errors,
  );
  const labelColor = readEmailTimerHexColor(
    formData.get("emailTimerLabelColor"),
    "#FDBA74",
    "labelColor",
    errors,
  );
  const borderColor = readEmailTimerHexColor(
    formData.get("emailTimerBorderColor"),
    "#111827",
    "borderColor",
    errors,
  );
  const headingText = String(
    formData.get("emailTimerHeadingText") ?? "ENDS IN",
  ).trim();
  const daysLabel = readEmailTimerLabel(
    formData.get("emailTimerDaysLabel"),
    "Days",
    "daysLabel",
    errors,
  );
  const hoursLabel = readEmailTimerLabel(
    formData.get("emailTimerHoursLabel"),
    "Hrs",
    "hoursLabel",
    errors,
  );
  const minutesLabel = readEmailTimerLabel(
    formData.get("emailTimerMinutesLabel"),
    "Mins",
    "minutesLabel",
    errors,
  );
  const secondsLabel = readEmailTimerLabel(
    formData.get("emailTimerSecondsLabel"),
    "Secs",
    "secondsLabel",
    errors,
  );
  const expiredBehavior = readEmailTimerExpiredBehavior(
    String(formData.get("emailTimerExpiredBehavior") ?? ""),
  );
  const showDays = formData.getAll("emailTimerShowDays").includes("true");
  const showHours = formData.getAll("emailTimerShowHours").includes("true");
  const showMinutes = formData.getAll("emailTimerShowMinutes").includes("true");
  const showSeconds = formData.getAll("emailTimerShowSeconds").includes("true");
  const hasVisibleUnit = showDays || showHours || showMinutes || showSeconds;

  if (!Number.isInteger(width) || width < 240 || width > 1200) {
    errors.width = "Enter a width from 240 to 1200 pixels.";
  }

  if (!Number.isInteger(height) || height < 80 || height > 400) {
    errors.height = "Enter a height from 80 to 400 pixels.";
  }

  if (
    !Number.isInteger(cornerRadius) ||
    cornerRadius < 0 ||
    cornerRadius > 40
  ) {
    errors.cornerRadius = "Enter a corner radius from 0 to 40 pixels.";
  }

  if (!Number.isInteger(borderWidth) || borderWidth < 0 || borderWidth > 16) {
    errors.borderWidth = "Enter a border width from 0 to 16 pixels.";
  }

  if (!Number.isInteger(paddingX) || paddingX < 0 || paddingX > 160) {
    errors.paddingX = "Enter horizontal padding from 0 to 160 pixels.";
  }

  if (!Number.isInteger(paddingY) || paddingY < 0 || paddingY > 120) {
    errors.paddingY = "Enter vertical padding from 0 to 120 pixels.";
  }

  if (!hasVisibleUnit) {
    errors.form = "Show at least one timer unit.";
  }

  if (!fontFamily) {
    errors.form = "Email timer font is invalid.";
  }

  if (headingText.length > 24) {
    errors.headingText = "Heading text can be up to 24 characters.";
  }

  if (!expiredBehavior) {
    errors.form = "Expired behavior is invalid.";
  }

  return {
    errors,
    design: {
      presetKey,
      width: Number.isInteger(width) ? width : 600,
      height: Number.isInteger(height) ? height : 180,
      backgroundColor,
      textColor,
      accentColor,
      labelColor,
      borderColor,
      fontFamily: fontFamily ?? "BLOCK",
      cornerRadius: Number.isInteger(cornerRadius) ? cornerRadius : 0,
      borderWidth: Number.isInteger(borderWidth) ? borderWidth : 0,
      paddingX: Number.isInteger(paddingX) ? paddingX : 34,
      paddingY: Number.isInteger(paddingY) ? paddingY : 24,
      showHeading: formData.getAll("emailTimerShowHeading").includes("true"),
      headingText: headingText || "ENDS IN",
      showLabels: formData.getAll("emailTimerShowLabels").includes("true"),
      showDays: hasVisibleUnit ? showDays : true,
      showHours,
      showMinutes,
      showSeconds,
      daysLabel,
      hoursLabel,
      minutesLabel,
      secondsLabel,
    },
    expiredBehavior: expiredBehavior ?? EmailTimerExpiredBehavior.SHOW_EXPIRED,
  };
}

function readEmailTimerPresetKey(value: string) {
  return /^[a-z0-9-]{1,40}$/.test(value) ? value : "custom";
}

function readEmailTimerFontFamily(value: string): EmailTimerFontFamily | null {
  if (
    value === "BLOCK" ||
    value === "DIGITAL" ||
    value === "WIDE" ||
    value === "COMPACT"
  ) {
    return value;
  }

  return null;
}

function readEmailTimerHexColor(
  value: FormDataEntryValue | null,
  fallback: string,
  field:
    | "backgroundColor"
    | "textColor"
    | "accentColor"
    | "labelColor"
    | "borderColor",
  errors: EmailTimerErrors,
) {
  const candidate = typeof value === "string" ? value.trim() : "";

  if (/^#[0-9a-f]{6}$/i.test(candidate)) {
    return candidate.toUpperCase();
  }

  errors[field] = "Enter a valid hex color.";
  return fallback;
}

function readEmailTimerLabel(
  value: FormDataEntryValue | null,
  fallback: string,
  field: "daysLabel" | "hoursLabel" | "minutesLabel" | "secondsLabel",
  errors: EmailTimerErrors,
) {
  const candidate = typeof value === "string" ? value.trim() : "";

  if (candidate.length > 10) {
    errors[field] = "Use 10 characters or fewer.";
    return fallback;
  }

  return candidate || fallback;
}

function readEmailTimerExpiredBehavior(value: string) {
  if (
    value === EmailTimerExpiredBehavior.SHOW_EXPIRED ||
    value === EmailTimerExpiredBehavior.SHOW_ZERO ||
    value === EmailTimerExpiredBehavior.HIDE
  ) {
    return value;
  }

  return null;
}

async function loadTargetingOptions(
  admin: Awaited<ReturnType<typeof authenticateAdmin>>["admin"],
) {
  try {
    return await loadCampaignTargetingOptions(admin);
  } catch (error) {
    console.error("Failed to load campaign targeting options", error);
    return emptyCampaignTargetingOptions;
  }
}

async function loadDesignMediaOptions(
  admin: Awaited<ReturnType<typeof authenticateAdmin>>["admin"],
) {
  try {
    return await loadCampaignDesignMediaOptions(admin);
  } catch (error) {
    console.error("Failed to load campaign design media options", error);
    return emptyCampaignDesignMediaOptions;
  }
}

function parseMarketRuleFormData(formData: FormData): {
  errors: MarketRuleErrors;
  input: MarketRuleInput;
} {
  const errors: MarketRuleErrors = {};
  const marketId = readFormString(formData, "marketRuleMarketId");
  const countryCode = readFormString(
    formData,
    "marketRuleCountryCode",
  ).toUpperCase();
  const locale = normalizeMarketLocale(
    readFormString(formData, "marketRuleLocale"),
  );
  const currencyCode = readFormString(
    formData,
    "marketRuleCurrencyCode",
  ).toUpperCase();
  const thresholdAmount = parseMarketThreshold(
    readFormString(formData, "marketRuleThresholdAmount"),
    errors,
  );
  const deliverySettings = parseMarketJsonObject(
    readFormString(formData, "marketRuleDeliverySettingsJson"),
    "Delivery cutoff JSON must be a JSON object.",
    errors,
  );

  if (!marketId && !countryCode && !locale && !currencyCode) {
    errors.form = "Choose at least one market, country, locale, or currency.";
  }

  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    errors.countryCode = "Country must be a 2-letter ISO code.";
    errors.form = errors.countryCode;
  }

  if (locale && !/^[a-z]{2}(-[a-z0-9]{2,8})?$/i.test(locale)) {
    errors.locale = "Locale must look like en or es-ES.";
    errors.form = errors.locale;
  }

  if (currencyCode && !/^[A-Z]{3}$/.test(currencyCode)) {
    errors.currencyCode = "Currency must be a 3-letter ISO code.";
    errors.form = errors.currencyCode;
  }

  return {
    errors,
    input: {
      enabled: isFormCheckboxChecked(formData, "marketRuleEnabled"),
      marketId: marketId || null,
      countryCode: countryCode || null,
      locale: locale || null,
      currencyCode: currencyCode || null,
      thresholdAmount,
      deliverySettings,
    },
  };
}

function parseMarketThreshold(value: string, errors: MarketRuleErrors) {
  if (!value) return null;

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    errors.thresholdAmount = "Enter a zero or positive threshold amount.";
    errors.form = errors.thresholdAmount;
    return null;
  }

  return number.toFixed(2);
}

function parseMarketJsonObject(
  value: string,
  message: string,
  errors: MarketRuleErrors,
): Prisma.InputJsonObject {
  if (!value.trim()) return {};

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.deliverySettingsJson = message;
      errors.form = message;
      return {};
    }

    return parsed as Prisma.InputJsonObject;
  } catch {
    errors.deliverySettingsJson = `${message.replace(/\.$/, "")} and valid JSON.`;
    errors.form = errors.deliverySettingsJson;
    return {};
  }
}

function readFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function hasTranslationInputs(formData: FormData) {
  return Array.from(formData.keys()).some((key) =>
    key.startsWith("translation."),
  );
}

function normalizeMarketLocale(value: string) {
  return value.replace("_", "-").toLowerCase();
}

function isFormCheckboxChecked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function parseAdvancedDiscountRuleFormData(formData: FormData): {
  errors: AdvancedDiscountRuleErrors;
  input: AdvancedDiscountRuleInput;
} {
  const errors: AdvancedDiscountRuleErrors = {};
  const title = String(formData.get("title") ?? "").trim();
  const ruleType = readAdvancedDiscountRuleType(
    String(formData.get("ruleType") ?? ""),
  );
  const status = readAdvancedDiscountRuleStatus(
    String(formData.get("ruleStatus") ?? ""),
  );
  const thresholds = parseAdvancedDiscountThresholds(
    String(formData.get("thresholdsJson") ?? ""),
    errors,
  );
  const discountValue = parseOptionalPercentage(
    formData.get("discountValue"),
    "discountValue",
    errors,
  );
  const shippingDiscountValue = parseOptionalPercentage(
    formData.get("shippingDiscountValue"),
    "shippingDiscountValue",
    errors,
  );

  if (!title) {
    errors.form = "Rule title is required.";
  }

  if (!ruleType) {
    errors.form = "Rule type is invalid.";
  }

  if (!status) {
    errors.form = "Rule status is invalid.";
  }

  return {
    errors,
    input: {
      title,
      ruleType: ruleType ?? AdvancedDiscountRuleType.TIERED_DISCOUNT,
      status: status ?? AdvancedDiscountRuleStatus.DRAFT,
      thresholds,
      productIds: parseMultilineIds(formData.get("productIds")),
      collectionIds: parseMultilineIds(formData.get("collectionIds")),
      discountValue,
      shippingDiscountValue,
      startsAt: String(formData.get("startsAt") ?? "").trim() || null,
      endsAt: String(formData.get("endsAt") ?? "").trim() || null,
    },
  };
}

function parseAdvancedDiscountThresholds(
  value: string,
  errors: AdvancedDiscountRuleErrors,
) {
  const rawValue = value.trim();

  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      errors.thresholdsJson = "Thresholds must be a JSON array.";
      errors.form = errors.thresholdsJson;
      return [];
    }

    return parsed;
  } catch {
    errors.thresholdsJson = "Thresholds JSON is invalid.";
    errors.form = errors.thresholdsJson;
    return [];
  }
}

function parseOptionalPercentage(
  value: FormDataEntryValue | null,
  key: "discountValue" | "shippingDiscountValue",
  errors: AdvancedDiscountRuleErrors,
) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return null;

  const number = Number(rawValue);

  if (!Number.isFinite(number) || number <= 0 || number > 100) {
    errors[key] = "Enter a percentage between 0.01 and 100.";
    errors.form = errors[key];
    return null;
  }

  return number;
}

function parseMultilineIds(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readAdvancedDiscountRuleType(value: string) {
  if (
    value === AdvancedDiscountRuleType.SPEND_X_GET_Y ||
    value === AdvancedDiscountRuleType.TIERED_DISCOUNT ||
    value === AdvancedDiscountRuleType.FREE_GIFT ||
    value === AdvancedDiscountRuleType.PRODUCT_SHIPPING_COMBO ||
    value === AdvancedDiscountRuleType.CART_CONTENTS
  ) {
    return value;
  }

  return null;
}

function readAdvancedDiscountRuleStatus(value: string) {
  if (
    value === AdvancedDiscountRuleStatus.DRAFT ||
    value === AdvancedDiscountRuleStatus.ACTIVE ||
    value === AdvancedDiscountRuleStatus.PAUSED ||
    value === AdvancedDiscountRuleStatus.ARCHIVED
  ) {
    return value;
  }

  return null;
}

function parseExperimentFormData(formData: FormData): {
  errors: ExperimentErrors;
  name: string;
  primaryMetric: ExperimentPrimaryMetric;
  variants: ExperimentVariantInput[];
} {
  const errors: ExperimentErrors = {};
  const name = String(formData.get("name") ?? "").trim();
  const primaryMetric = readExperimentPrimaryMetric(
    String(formData.get("primaryMetric") ?? ""),
  );
  const ids = formData.getAll("variantId").map((value) => String(value));
  const names = formData.getAll("variantName").map((value) => String(value));
  const weights = formData
    .getAll("variantWeight")
    .map((value) => Number(value));
  const statuses = formData
    .getAll("variantStatus")
    .map((value) => String(value));
  const textOverrides = formData.getAll("textOverride");
  const designOverrides = formData.getAll("designOverride");
  const discountOverrides = formData.getAll("discountOverride");
  const placementOverrides = formData.getAll("placementOverride");
  const variantCount = Math.max(names.length, weights.length);

  if (!name) {
    errors.form = "Experiment name is required.";
  }

  if (!primaryMetric) {
    errors.form = "Primary metric is required.";
  }

  const variants: ExperimentVariantInput[] = [];

  for (let index = 0; index < variantCount; index += 1) {
    const variantName = (names[index] ?? "").trim();
    const status = readExperimentVariantStatus(statuses[index] ?? "");

    if (!variantName) {
      errors.form = "Each variant needs a name.";
    }

    if (!Number.isFinite(weights[index]) || weights[index] < 0) {
      errors.form = "Variant weights must be zero or greater.";
    }

    if (!status) {
      errors.form = "Variant status is invalid.";
    }

    variants.push({
      id: ids[index]?.trim() || undefined,
      name: variantName,
      weight: Number.isFinite(weights[index]) ? weights[index] : 0,
      status: status ?? ExperimentVariantStatus.DRAFT,
      textOverride: parseJsonOverride(
        textOverrides[index],
        "Text override",
        errors,
      ),
      designOverride: parseJsonOverride(
        designOverrides[index],
        "Design override",
        errors,
      ),
      discountOverride: parseJsonOverride(
        discountOverrides[index],
        "Discount override",
        errors,
      ),
      placementOverride: parseJsonOverride(
        placementOverrides[index],
        "Placement override",
        errors,
      ),
    });
  }

  if (variants.length < 2) {
    errors.form = "Create at least two variants.";
  }

  if (
    variants.filter(
      (variant) =>
        variant.status !== ExperimentVariantStatus.ARCHIVED &&
        variant.weight > 0,
    ).length < 2
  ) {
    errors.form = "At least two variants need positive weights.";
  }

  return {
    errors,
    name,
    primaryMetric: primaryMetric ?? ExperimentPrimaryMetric.CLICK_RATE,
    variants,
  };
}

function parseAutoWinnerSettingsFormData(formData: FormData) {
  return {
    enabled: isFormCheckboxChecked(formData, "autoWinnerEnabled"),
    minSampleSize: Number(formData.get("autoWinnerMinSampleSize")),
    minRuntimeHours: Number(formData.get("autoWinnerMinRuntimeHours")),
    confidenceThreshold: Number(formData.get("autoWinnerConfidenceThreshold")),
  };
}

function parseJsonOverride(
  value: FormDataEntryValue | undefined,
  label: string,
  errors: ExperimentErrors,
) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.form = `${label} must be a JSON object.`;
      return null;
    }

    return parsed;
  } catch {
    errors.form = `${label} is not valid JSON.`;
    return null;
  }
}

function readExperimentPrimaryMetric(value: string) {
  if (value === "CTR" || value === ExperimentPrimaryMetric.CLICK_RATE) {
    return ExperimentPrimaryMetric.CLICK_RATE;
  }

  if (
    value === ExperimentPrimaryMetric.ADD_TO_CART_RATE ||
    value === ExperimentPrimaryMetric.CHECKOUT_RATE ||
    value === ExperimentPrimaryMetric.REVENUE_PER_VISITOR
  ) {
    return value;
  }

  return null;
}

function readExperimentVariantStatus(value: string) {
  if (
    value === ExperimentVariantStatus.DRAFT ||
    value === ExperimentVariantStatus.ACTIVE ||
    value === ExperimentVariantStatus.PAUSED ||
    value === ExperimentVariantStatus.WINNER ||
    value === ExperimentVariantStatus.LOSER ||
    value === ExperimentVariantStatus.ARCHIVED
  ) {
    return value;
  }

  return null;
}

function toExperimentRow(
  experiment: {
    id: string;
    name: string;
    status: string;
    primaryMetric: string;
    trafficSplitStrategy: string;
    startsAt: Date | string | null;
    endsAt: Date | string | null;
    winnerVariantId: string | null;
    autoWinnerEnabled: boolean;
    autoWinnerMinSampleSize: number;
    autoWinnerMinRuntimeHours: number;
    autoWinnerConfidenceThreshold: number;
    variants: Array<{
      id: string;
      name: string;
      weight: number;
      status: string;
      designOverride: unknown;
      textOverride: unknown;
      discountOverride: unknown;
      placementOverride: unknown;
    }>;
  },
  results: ExperimentResults,
): ExperimentRow {
  return {
    id: experiment.id,
    name: experiment.name,
    status: experiment.status,
    primaryMetric: experiment.primaryMetric,
    trafficSplitStrategy: experiment.trafficSplitStrategy,
    startsAt: toShortDateTime(experiment.startsAt),
    endsAt: toShortDateTime(experiment.endsAt),
    winnerVariantId: experiment.winnerVariantId ?? "",
    autoWinnerEnabled: experiment.autoWinnerEnabled,
    autoWinnerMinSampleSize: experiment.autoWinnerMinSampleSize,
    autoWinnerMinRuntimeHours: experiment.autoWinnerMinRuntimeHours,
    autoWinnerConfidenceThreshold: experiment.autoWinnerConfidenceThreshold,
    variants: experiment.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      weight: variant.weight,
      status: variant.status,
      designOverrideJson: jsonTextareaValue(variant.designOverride),
      textOverrideJson: jsonTextareaValue(variant.textOverride),
      discountOverrideJson: jsonTextareaValue(variant.discountOverride),
      placementOverrideJson: jsonTextareaValue(variant.placementOverride),
    })),
    results: {
      runtimeHours: results.runtimeHours,
      currencyCode: results.currencyCode,
      variants: results.variants.map((variant) => ({
        variantId: variant.variantId,
        variantName: variant.variantName,
        impressions: variant.impressions,
        clicks: variant.clicks,
        ctr: variant.ctr,
        addToCart: variant.addToCart,
        checkoutStarted: variant.checkoutStarted,
        orders: variant.orders,
        revenue: variant.revenue,
        revenuePerVisitor: variant.revenuePerVisitor,
        conversionRate: variant.conversionRate,
        visitors: variant.visitors,
        primaryMetricValue: variant.primaryMetricValue,
      })),
    },
  };
}

function emptyExperimentResults(experiment: {
  id: string;
  campaignId: string;
  status: string;
  primaryMetric: string;
  winnerVariantId: string | null;
  autoWinnerEnabled: boolean;
  autoWinnerMinSampleSize: number;
  autoWinnerMinRuntimeHours: number;
  autoWinnerConfidenceThreshold: number;
  variants: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}): ExperimentResults {
  return {
    experimentId: experiment.id,
    campaignId: experiment.campaignId,
    status: experiment.status as ExperimentStatus,
    primaryMetric: experiment.primaryMetric as ExperimentPrimaryMetric,
    winnerVariantId: experiment.winnerVariantId,
    runtimeHours: 0,
    currencyCode: "USD",
    autoWinner: {
      enabled: experiment.autoWinnerEnabled,
      minSampleSize: experiment.autoWinnerMinSampleSize,
      minRuntimeHours: experiment.autoWinnerMinRuntimeHours,
      confidenceThreshold: experiment.autoWinnerConfidenceThreshold,
    },
    variants: experiment.variants.map((variant) => ({
      variantId: variant.id,
      variantName: variant.name,
      status: variant.status as ExperimentVariantStatus,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      addToCart: 0,
      addToCartRate: 0,
      checkoutStarted: 0,
      checkoutRate: 0,
      orders: 0,
      revenue: 0,
      revenuePerVisitor: 0,
      conversionRate: 0,
      visitors: 0,
      primaryMetricValue: 0,
    })),
  };
}

function jsonTextareaValue(value: unknown) {
  if (!value || typeof value !== "object") return "";

  return JSON.stringify(value, null, 2);
}

function toUniqueCodePoolRow(pool: {
  id: string;
  prefix: string;
  discountType: string;
  value: { toString(): string } | null;
  status: string;
  totalGenerated: number;
  totalAssigned: number;
  totalUsed: number;
  expiresAt: Date | string | null;
}): UniqueCodePoolRow {
  return {
    id: pool.id,
    prefix: pool.prefix,
    discountType: formatEnum(pool.discountType),
    value: pool.value?.toString() ?? "",
    status: formatEnum(pool.status),
    totalGenerated: pool.totalGenerated,
    totalAssigned: pool.totalAssigned,
    totalUsed: pool.totalUsed,
    expiresAt: toShortDateTime(pool.expiresAt),
  };
}

function toUniqueCodeRow(code: {
  id: string;
  code: string;
  status: string;
  visitorId: string | null;
  assignedAt: Date | string | null;
  expiresAt: Date | string | null;
  usedAt: Date | string | null;
}): UniqueCodeRow {
  return {
    id: code.id,
    code: code.code,
    status: formatEnum(code.status),
    visitorId: code.visitorId ?? "",
    assignedAt: toShortDateTime(code.assignedAt),
    expiresAt: toShortDateTime(code.expiresAt),
    usedAt: toShortDateTime(code.usedAt),
  };
}

function toEmailTimerRow(
  timer: {
    id: string;
    publicToken: string;
    mode: string;
    endsAt: Date | string | null;
    expiredBehavior: string;
    design: unknown;
    createdAt: Date | string;
  },
  request: Request,
): EmailTimerRow {
  const design = readJsonObject(timer.design);
  const width = clampIntegerValue(design.width, 240, 1200, 600);
  const height = clampIntegerValue(design.height, 80, 400, 180);
  const imageUrl = buildEmailTimerImageUrl(request, timer.publicToken);

  return {
    id: timer.id,
    imageUrl,
    snippet: buildEmailTimerSnippet(imageUrl, width),
    width,
    height,
    preset: formatEmailTimerPreset(readStringValue(design.presetKey, "custom")),
    fontFamily: formatEnum(readStringValue(design.fontFamily, "BLOCK")),
    mode: formatEnum(timer.mode),
    expiredBehavior: formatEnum(timer.expiredBehavior),
    endsAt: toShortDateTime(timer.endsAt),
    createdAt: toShortDateTime(timer.createdAt),
  };
}

function toAdvancedDiscountRuleRow(rule: {
  id: string;
  title: string;
  ruleType: string;
  status: string;
  thresholds: unknown;
  productIds: unknown;
  collectionIds: unknown;
  discountValue: { toString(): string } | null;
  shippingDiscountValue: { toString(): string } | null;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  shopifyDiscountId: string | null;
}): AdvancedDiscountRuleRow {
  return {
    id: rule.id,
    title: rule.title,
    ruleType: rule.ruleType,
    status: rule.status,
    thresholdsJson: jsonTextareaValue(rule.thresholds),
    productIds: jsonListText(rule.productIds),
    collectionIds: jsonListText(rule.collectionIds),
    discountValue: rule.discountValue?.toString() ?? "",
    shippingDiscountValue: rule.shippingDiscountValue?.toString() ?? "",
    startsAt: toShortDateTime(rule.startsAt),
    endsAt: toShortDateTime(rule.endsAt),
    shopifyDiscountId: rule.shopifyDiscountId ?? "",
  };
}

function jsonListText(value: unknown) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function readJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readStringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function clampIntegerValue(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;

  return Math.max(min, Math.min(max, parsed));
}

function toShortDateTime(date: Date | string | null) {
  if (!date) return "";

  const parsedDate = typeof date === "string" ? new Date(date) : date;

  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toISOString().slice(0, 16).replace("T", " ");
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEmailTimerPreset(value: string) {
  if (value === "custom") return "Custom";

  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toCampaignGoal(value: string, type: string): CampaignGoalValue {
  if (campaignGoalOptions.some((option) => option.value === value)) {
    return value as CampaignGoalValue;
  }

  if (type === "DELIVERY_CUTOFF") return "DELIVERY_CUTOFF";
  if (type === "PRODUCT_BADGE") return "PRODUCT_BADGE";
  return "ANNOUNCEMENT";
}

function toCampaignType(value: string): CampaignTypeValue {
  if (campaignTypeOptions.some((option) => option.value === value)) {
    return value as CampaignTypeValue;
  }

  return "COUNTDOWN_BAR";
}

function toCampaignStatus(value: string): EditableCampaignStatusValue {
  if (campaignEditableStatusOptions.some((option) => option.value === value)) {
    return value as EditableCampaignStatusValue;
  }

  return "DRAFT";
}

function toPlacementType(value: string): PlacementTypeValue {
  if (placementTypeOptions.some((option) => option.value === value)) {
    return value as PlacementTypeValue;
  }

  return "TOP_BAR";
}

function formatPlacementSelectionLabel(placements: PlacementTypeValue[]) {
  const labels = placements.map(
    (placement) =>
      placementTypeOptions.find((option) => option.value === placement)
        ?.label ?? formatCampaignOption(placement),
  );

  return labels.length > 0 ? labels.join(" + ") : "No placement";
}

type CampaignTargetingRecord = {
  countries?: unknown;
  productIds?: unknown;
  collectionIds?: unknown;
  productTags?: unknown;
  excludeProductIds?: unknown;
} | null;

function inferProductSelection(
  targeting: CampaignTargetingRecord,
): ProductSelectionValue {
  if (targetingStringList(targeting?.productIds).length > 0) {
    return "SPECIFIC_PRODUCTS";
  }
  if (targetingStringList(targeting?.collectionIds).length > 0) {
    return "COLLECTIONS";
  }
  if (targetingStringList(targeting?.productTags).length > 0) return "TAGS";

  return "ALL_PRODUCTS";
}

function inferCountrySelection(
  targeting: CampaignTargetingRecord,
): CountrySelectionValue {
  return targetingStringList(targeting?.countries).length > 0
    ? "SPECIFIC_COUNTRIES"
    : "ALL_WORLD";
}

function targetingListText(value: unknown) {
  return targetingStringList(value).join("\n");
}

function targetingStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

type CampaignDesignRecord =
  | (Partial<Omit<CampaignDesignValues, "customCss">> & {
      customCss?: string | null;
      mobileDesign?: unknown;
    })
  | null;

function toCampaignDesignValues(
  design: CampaignDesignRecord,
): CampaignDesignValues {
  const baseDesign = { ...(design ?? {}) } as Partial<CampaignDesignValues> & {
    mobileDesign?: unknown;
  };
  delete baseDesign.mobileDesign;

  return {
    ...defaultCampaignDesignValues,
    ...baseDesign,
    customCss: design?.customCss ?? "",
  };
}

function toCampaignMobileDesignValues(
  design: CampaignDesignRecord,
  desktopValues: CampaignDesignValues,
): CampaignDesignValues {
  const mobileDesign =
    design && readCampaignDesignJsonObject(design.mobileDesign);

  return {
    ...desktopValues,
    ...mobileDesign,
    customCss:
      typeof mobileDesign?.customCss === "string"
        ? mobileDesign.customCss
        : desktopValues.customCss,
  };
}

function readCampaignDesignJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<CampaignDesignValues>)
    : null;
}

function toFreeShippingSettingsValues(
  settings: {
    thresholdAmount: { toString(): string };
    currencyCode: string;
    includeDiscountedSubtotal: boolean;
    emptyCartMessage?: string | null;
    successMessage?: string | null;
    progressStyle: string;
    thresholdRules?: unknown;
  } | null,
): FreeShippingSettingsValues {
  if (!settings) return defaultFreeShippingSettingsValues;

  return {
    thresholdAmount: settings.thresholdAmount.toString(),
    currencyCode: settings.currencyCode,
    includeDiscountedSubtotal: settings.includeDiscountedSubtotal,
    emptyCartMessage:
      settings.emptyCartMessage ??
      defaultFreeShippingSettingsValues.emptyCartMessage,
    successMessage:
      settings.successMessage ??
      defaultFreeShippingSettingsValues.successMessage,
    progressStyle: isFreeShippingProgressStyle(settings.progressStyle)
      ? settings.progressStyle
      : defaultFreeShippingSettingsValues.progressStyle,
    thresholdRulesJson: settings.thresholdRules
      ? JSON.stringify(settings.thresholdRules, null, 2)
      : "",
  };
}

function toCampaignFreeShippingFormValues(
  settings: {
    thresholdAmount: { toString(): string };
    currencyCode: string;
    includeDiscountedSubtotal: boolean;
    emptyCartMessage?: string | null;
    successMessage?: string | null;
    progressStyle: string;
  } | null,
  discountSync: {
    discountCode?: string | null;
    title?: string | null;
    valueType?: string | null;
    minimumSubtotal?: { toString(): string } | string | number | null;
    appliesOncePerCustomer?: boolean | null;
    showCodeOnStorefront?: boolean | null;
  } | null,
): Pick<
  CampaignFormValues,
  | "freeShippingThresholdAmount"
  | "freeShippingCurrencyCode"
  | "freeShippingIncludeDiscountedSubtotal"
  | "freeShippingProgressStyle"
  | "freeShippingEmptyCartMessage"
  | "freeShippingSuccessMessage"
  | "freeShippingAutoDiscount"
  | "freeShippingDiscountCode"
  | "freeShippingDiscountTitle"
  | "freeShippingDiscountAppliesOncePerCustomer"
  | "freeShippingShowDiscountCode"
> {
  const freeShippingValues = toFreeShippingSettingsValues(settings);
  const hasFreeShippingDiscount = discountSync?.valueType === "FREE_SHIPPING";

  return {
    freeShippingThresholdAmount:
      freeShippingValues.thresholdAmount ||
      readStringLike(discountSync?.minimumSubtotal) ||
      defaultFreeShippingSettingsValues.thresholdAmount,
    freeShippingCurrencyCode: freeShippingValues.currencyCode,
    freeShippingIncludeDiscountedSubtotal:
      freeShippingValues.includeDiscountedSubtotal,
    freeShippingProgressStyle: freeShippingValues.progressStyle,
    freeShippingEmptyCartMessage: freeShippingValues.emptyCartMessage,
    freeShippingSuccessMessage: freeShippingValues.successMessage,
    freeShippingAutoDiscount: hasFreeShippingDiscount,
    freeShippingDiscountCode:
      discountSync?.discountCode ??
      defaultCampaignFormValues.freeShippingDiscountCode,
    freeShippingDiscountTitle:
      discountSync?.title ??
      defaultCampaignFormValues.freeShippingDiscountTitle,
    freeShippingDiscountAppliesOncePerCustomer:
      discountSync?.appliesOncePerCustomer ?? false,
    freeShippingShowDiscountCode:
      discountSync?.showCodeOnStorefront ??
      defaultCampaignFormValues.freeShippingShowDiscountCode,
  };
}

function readStringLike(
  value:
    | {
        toString(): string;
      }
    | string
    | number
    | null
    | undefined,
) {
  if (value === null || value === undefined) return "";

  return String(value);
}

function toCampaignDeliveryCutoffFormValues(
  settings: {
    cutoffHour: number;
    cutoffMinute: number;
    processingDays: number;
    minDeliveryDays: number;
    maxDeliveryDays: number;
    workingDays: unknown;
    holidays: unknown;
    countryRules: unknown;
    afterCutoffBehavior?: string | null;
  } | null,
  campaignTimezone: string,
): Pick<
  CampaignFormValues,
  | "deliveryCutoffHour"
  | "deliveryCutoffMinute"
  | "deliveryProcessingDays"
  | "deliveryMinDays"
  | "deliveryMaxDays"
  | "deliveryWorkingDays"
  | "deliveryAfterCutoffBehavior"
> {
  const values = toDeliveryCutoffSettingsValues(settings, campaignTimezone);

  return {
    deliveryCutoffHour: values.cutoffHour,
    deliveryCutoffMinute: values.cutoffMinute,
    deliveryProcessingDays: values.processingDays,
    deliveryMinDays: values.minDeliveryDays,
    deliveryMaxDays: values.maxDeliveryDays,
    deliveryWorkingDays: readDeliveryWorkingDays(values.workingDaysJson),
    deliveryAfterCutoffBehavior: values.afterCutoffBehavior,
  };
}

function toCampaignLowStockFormValues(
  settings: {
    threshold: number;
    showExactQuantity: boolean;
    fallbackMessage?: string | null;
  } | null,
): Pick<
  CampaignFormValues,
  "lowStockThreshold" | "lowStockShowExactQuantity" | "lowStockFallbackMessage"
> {
  const values = toLowStockSettingsValues(settings);

  return {
    lowStockThreshold: values.threshold,
    lowStockShowExactQuantity: values.showExactQuantity,
    lowStockFallbackMessage: values.fallbackMessage,
  };
}

function toCampaignBadgeFormValues(
  settings: {
    badgeText: string;
    badgeShape: string;
    badgePosition: string;
  } | null,
): Pick<CampaignFormValues, "badgeText" | "badgeShape" | "badgePosition"> {
  const values = toBadgeSettingsValues(settings);

  return {
    badgeText: values.badgeText,
    badgeShape: values.badgeShape,
    badgePosition: values.badgePosition,
  };
}

function readDeliveryWorkingDays(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      const days = parsed
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);

      if (days.length > 0) return Array.from(new Set(days)).join(",");
    }
  } catch {
    return defaultCampaignFormValues.deliveryWorkingDays;
  }

  return defaultCampaignFormValues.deliveryWorkingDays;
}

async function loadDiscountOptions(admin: ShopifyGraphqlClient): Promise<{
  discounts: DiscountOption[];
  error: string;
}> {
  try {
    return {
      discounts: await listCodeDiscounts(admin, { first: 20 }),
      error: "",
    };
  } catch (error) {
    return {
      discounts: [],
      error:
        error instanceof Error ? error.message : SHOPIFY_DISCOUNT_SCOPE_MESSAGE,
    };
  }
}

async function loadMarketOptions(admin: ShopifyGraphqlClient): Promise<{
  markets: ShopifyMarket[];
  error: string;
}> {
  try {
    return {
      markets: await fetchShopMarkets(admin),
      error: "",
    };
  } catch (error) {
    return {
      markets: [],
      error:
        error instanceof Error
          ? error.message
          : "Shopify Markets could not be loaded.",
    };
  }
}

function toMarketOptionRow(market: ShopifyMarket): MarketOptionRow {
  return {
    id: market.handle || market.id,
    name: market.name,
    handle: market.handle,
    enabled: market.enabled,
    primary: market.primary,
    countryCodes: market.countryCodes.join(", "),
    locale: market.locale,
    currencyCode: market.currencyCode,
  };
}

function toMarketRuleRow(rule: {
  id: string;
  enabled: boolean;
  marketId: string | null;
  countryCode: string | null;
  locale: string | null;
  currencyCode: string | null;
  thresholdAmount: { toString(): string } | null;
  deliverySettings: unknown;
}): MarketRuleRow {
  return {
    id: rule.id,
    enabled: rule.enabled,
    marketId: rule.marketId ?? "",
    countryCode: rule.countryCode ?? "",
    locale: rule.locale ?? "",
    currencyCode: rule.currencyCode ?? "",
    thresholdAmount: rule.thresholdAmount?.toString() ?? "",
    deliverySettingsJson: jsonTextareaValue(rule.deliverySettings),
    scopeSummary: summarizeMarketRuleScope(rule),
  };
}

function summarizeMarketRuleScope(rule: {
  marketId: string | null;
  countryCode: string | null;
  locale: string | null;
  currencyCode: string | null;
}) {
  const parts = [
    rule.marketId ? `market: ${rule.marketId}` : "",
    rule.countryCode ? `country: ${rule.countryCode}` : "",
    rule.locale ? `locale: ${rule.locale}` : "",
    rule.currencyCode ? `currency: ${rule.currencyCode}` : "",
  ].filter(Boolean);

  return parts.join(" | ") || "No scope";
}

async function linkExistingDiscount({
  admin,
  campaignId,
  shopId,
  codeOrId,
  syncStartEnd,
}: {
  admin: ShopifyGraphqlClient;
  campaignId: string;
  shopId: string;
  codeOrId: string;
  syncStartEnd: boolean;
}) {
  try {
    const discount = await getDiscountByCodeOrId(admin, codeOrId);

    if (!discount) {
      throw new Error(
        "Shopify did not find that discount. Check the code or ID and try again.",
      );
    }

    await saveDiscountForCampaign({
      campaignId,
      shopId,
      discount,
      syncStartEnd,
    });

    return {
      discountCode: discount.code,
      shopifyDiscountId: discount.id,
      notice: "",
    };
  } catch (error) {
    const manualCode = codeOrId.startsWith("gid://shopify/Discount")
      ? null
      : codeOrId.trim().toUpperCase();
    const manualId = codeOrId.startsWith("gid://shopify/Discount")
      ? codeOrId.trim()
      : null;

    if (!manualCode && !manualId) {
      throw error;
    }

    await updateDiscountSyncForShop(campaignId, shopId, {
      shopifyDiscountId: manualId,
      discountCode: manualCode,
      method: "CODE",
      syncStartEnd: false,
      lastSyncedAt: null,
    });

    return {
      discountCode: manualCode,
      shopifyDiscountId: manualId,
      notice:
        error instanceof Error
          ? `${error.message} The manual discount reference was saved without date sync.`
          : "The manual discount reference was saved without date sync.",
    };
  }
}

async function createOrLinkFreeShippingDiscountForCampaign({
  admin,
  campaignId,
  shopId,
  values,
  startsAt,
  endsAt,
}: {
  admin: ShopifyGraphqlClient;
  campaignId: string;
  shopId: string;
  values: CampaignFormValues;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  const thresholdAmount = Number(values.freeShippingThresholdAmount);
  const discountCode = values.freeShippingDiscountCode.trim().toUpperCase();
  let discount: ShopifyDiscountSummary | null = null;

  try {
    discount = await createFreeShippingCodeDiscount(admin, {
      title: values.freeShippingDiscountTitle,
      code: discountCode,
      startsAt,
      endsAt,
      minimumSubtotal: thresholdAmount,
      appliesOncePerCustomer: values.freeShippingDiscountAppliesOncePerCustomer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!/already|exists|taken|code/i.test(message)) {
      throw error;
    }

    discount = await getDiscountByCodeOrId(admin, discountCode);

    if (!discount) {
      throw error;
    }
  }

  return updateDiscountSyncForShop(campaignId, shopId, {
    shopifyDiscountId: discount.id,
    discountCode: discount.code ?? discountCode,
    method: "CODE",
    syncStartEnd: false,
    startsAt,
    endsAt,
    lastSyncedAt: new Date(),
    title: values.freeShippingDiscountTitle,
    valueType: "FREE_SHIPPING",
    value: null,
    minimumSubtotal: thresholdAmount.toFixed(2),
    appliesOncePerCustomer: values.freeShippingDiscountAppliesOncePerCustomer,
    showCodeOnStorefront: values.freeShippingShowDiscountCode,
  });
}

async function saveDiscountForCampaign({
  campaignId,
  shopId,
  discount,
  syncStartEnd,
}: {
  campaignId: string;
  shopId: string;
  discount: ShopifyDiscountSummary;
  syncStartEnd: boolean;
}) {
  const syncedDates = syncCampaignDatesFromDiscount({ syncStartEnd }, discount);

  return updateDiscountSyncForShop(campaignId, shopId, {
    shopifyDiscountId: discount.id,
    discountCode: discount.code,
    method: "CODE",
    syncStartEnd,
    startsAt: syncedDates?.startsAt,
    endsAt: syncedDates?.endsAt,
    lastSyncedAt: syncedDates?.lastSyncedAt ?? null,
  });
}

function toDiscountSettingsValues(
  settings: {
    shopifyDiscountId?: string | null;
    discountCode?: string | null;
    method?: string | null;
    syncStartEnd: boolean;
    title?: string | null;
    valueType?: string | null;
    value?: { toString(): string } | string | number | null;
    minimumSubtotal?: { toString(): string } | string | number | null;
    appliesOncePerCustomer?: boolean | null;
    uniqueCodePrefix?: string | null;
    uniqueCodeExpiresMinutes?: number | null;
    uniqueCodeAutoApply?: boolean | null;
    uniqueCodeStartsAt?: Date | string | null;
    uniqueCodeEndsAt?: Date | string | null;
  } | null,
): DiscountSettingsValues {
  if (!settings) return defaultDiscountSettingsValues;

  if (settings.method === "UNIQUE_CODE") {
    return {
      ...defaultDiscountSettingsValues,
      mode: "UNIQUE_CODES",
      existingCodeOrId: "",
      discountCode: "",
      shopifyDiscountId: "",
      syncStartEnd: settings.syncStartEnd,
      title: settings.title ?? "",
      valueType: toDiscountValueType(settings.valueType),
      value: settings.value?.toString() ?? defaultDiscountSettingsValues.value,
      startsAt: toDateTimeLocalValue(settings.uniqueCodeStartsAt ?? null),
      endsAt: toDateTimeLocalValue(settings.uniqueCodeEndsAt ?? null),
      minimumSubtotal: settings.minimumSubtotal?.toString() ?? "",
      appliesOncePerCustomer: settings.appliesOncePerCustomer ?? false,
      uniqueCodePrefix:
        settings.uniqueCodePrefix ??
        defaultDiscountSettingsValues.uniqueCodePrefix,
      uniqueCodeExpiresMinutes:
        settings.uniqueCodeExpiresMinutes?.toString() ??
        defaultDiscountSettingsValues.uniqueCodeExpiresMinutes,
      uniqueCodeAutoApply:
        settings.uniqueCodeAutoApply ??
        defaultDiscountSettingsValues.uniqueCodeAutoApply,
    };
  }

  return {
    ...defaultDiscountSettingsValues,
    mode: "LINK_EXISTING",
    existingCodeOrId: settings.discountCode ?? settings.shopifyDiscountId ?? "",
    discountCode: settings.discountCode ?? "",
    shopifyDiscountId: settings.shopifyDiscountId ?? "",
    syncStartEnd: settings.syncStartEnd,
  };
}

function toDiscountValueType(value: string | null | undefined) {
  if (
    value === "PERCENTAGE" ||
    value === "FIXED_AMOUNT" ||
    value === "FREE_SHIPPING"
  ) {
    return value;
  }

  return defaultDiscountSettingsValues.valueType;
}

function toLowStockSettingsValues(
  settings: {
    threshold: number;
    showExactQuantity: boolean;
    fallbackMessage?: string | null;
  } | null,
): LowStockSettingsValues {
  if (!settings) return defaultLowStockSettingsValues;

  return {
    threshold: String(settings.threshold),
    showExactQuantity: settings.showExactQuantity,
    fallbackMessage:
      settings.fallbackMessage ?? defaultLowStockSettingsValues.fallbackMessage,
  };
}

function toBadgeSettingsValues(
  settings: {
    badgeText: string;
    badgeShape: string;
    badgePosition: string;
  } | null,
): BadgeSettingsValues {
  if (!settings) return defaultBadgeSettingsValues;

  return {
    badgeText: settings.badgeText || defaultBadgeSettingsValues.badgeText,
    badgeShape: toBadgeShape(settings.badgeShape),
    badgePosition: toBadgePosition(settings.badgePosition),
  };
}

function isFreeShippingProgressStyle(
  value: string,
): value is FreeShippingSettingsValues["progressStyle"] {
  return value === "BAR" || value === "COMPACT" || value === "CIRCULAR";
}

function toDeliveryCutoffSettingsValues(
  settings: {
    cutoffHour: number;
    cutoffMinute: number;
    processingDays: number;
    minDeliveryDays: number;
    maxDeliveryDays: number;
    workingDays: unknown;
    holidays: unknown;
    countryRules: unknown;
    afterCutoffBehavior?: string | null;
  } | null,
  campaignTimezone: string,
): DeliveryCutoffSettingsValues {
  if (!settings) {
    return {
      ...defaultDeliveryCutoffSettingsValues,
      timezone:
        campaignTimezone || defaultDeliveryCutoffSettingsValues.timezone,
    };
  }

  return {
    afterCutoffBehavior: toAfterCutoffBehavior(settings.afterCutoffBehavior),
    countryRulesJson: stringifyJsonSetting(settings.countryRules, "{}"),
    cutoffHour: String(settings.cutoffHour),
    cutoffMinute: String(settings.cutoffMinute),
    holidaysJson: stringifyJsonSetting(settings.holidays, "[]"),
    maxDeliveryDays: String(settings.maxDeliveryDays),
    minDeliveryDays: String(settings.minDeliveryDays),
    processingDays: String(settings.processingDays),
    timezone: campaignTimezone || defaultDeliveryCutoffSettingsValues.timezone,
    workingDaysJson: stringifyJsonSetting(settings.workingDays, "[1,2,3,4,5]"),
  };
}

function stringifyJsonSetting(value: unknown, fallback: string) {
  return value ? JSON.stringify(value, null, 2) : fallback;
}
