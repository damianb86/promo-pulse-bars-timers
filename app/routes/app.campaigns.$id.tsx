import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";

import { BadgeSettingsEditor } from "../components/BadgeSettingsEditor";
import { CampaignDesignEditor } from "../components/CampaignDesignEditor";
import { CampaignEditorLayout } from "../components/CampaignEditorLayout";
import { CampaignForm } from "../components/CampaignForm";
import { CampaignTranslationsEditor } from "../components/CampaignTranslationsEditor";
import { DeliveryCutoffSettingsEditor } from "../components/DeliveryCutoffSettingsEditor";
import { DiscountSettingsEditor } from "../components/DiscountSettingsEditor";
import { FreeShippingSettingsEditor } from "../components/FreeShippingSettingsEditor";
import { LowStockSettingsEditor } from "../components/LowStockSettingsEditor";
import { PlanUpgradeCallout } from "../components/PlanUpgradeCallout";
import {
  clearDiscountSyncForShop,
  getCampaignForShop,
  updateBadgeSettingsForShop,
  updateCampaignBasicsForShop,
  updateCampaignDesignForShop,
  updateCampaignTranslationsForShop,
  updateDeliveryCutoffSettingsForShop,
  updateDiscountSyncForShop,
  updateFreeShippingSettingsForShop,
  updateLowStockSettingsForShop,
} from "../models/campaign.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import {
  hasCampaignDesignErrors,
  parseCampaignDesignFormData,
} from "../services/campaign-design-form.server";
import {
  hasCampaignFormErrors,
  parseCampaignFormData,
} from "../services/campaign-form.server";
import {
  hasCampaignTranslationErrors,
  parseCampaignTranslationsFormData,
} from "../services/campaign-translations-form.server";
import {
  hasBadgeSettingsErrors,
  parseBadgeSettingsFormData,
} from "../services/badge-settings-form.server";
import {
  hasDeliveryCutoffSettingsErrors,
  parseDeliveryCutoffSettingsFormData,
} from "../services/delivery-cutoff-settings-form.server";
import {
  hasDiscountSettingsErrors,
  parseDiscountSettingsFormData,
} from "../services/discount-settings-form.server";
import {
  hasFreeShippingSettingsErrors,
  parseFreeShippingSettingsFormData,
} from "../services/free-shipping-settings-form.server";
import {
  hasLowStockSettingsErrors,
  parseLowStockSettingsFormData,
} from "../services/low-stock-settings-form.server";
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
import { authenticate } from "../shopify.server";
import {
  defaultBadgeSettingsValues,
  toBadgePosition,
  toBadgeShape,
  type BadgeSettingsErrors,
  type BadgeSettingsValues,
} from "../types/badge";
import type {
  CampaignDesignErrors,
  CampaignDesignValues,
} from "../types/campaign-design";
import { defaultCampaignDesignValues } from "../types/campaign-design";
import {
  campaignEditableStatusOptions,
  campaignGoalOptions,
  campaignTypeOptions,
  getDefaultPlacementForCampaignType,
  placementTypeOptions,
  type CampaignGoalValue,
  type CampaignTypeValue,
  type EditableCampaignStatusValue,
  type PlacementTypeValue,
} from "../types/campaign-options";
import type {
  CampaignFormErrors,
  CampaignFormValues,
} from "../types/campaign-form";
import {
  defaultDeliveryCutoffSettingsValues,
  toAfterCutoffBehavior,
  type DeliveryCutoffSettingsErrors,
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
  type FreeShippingSettingsErrors,
  type FreeShippingSettingsValues,
} from "../types/free-shipping";
import {
  defaultLowStockSettingsValues,
  type LowStockSettingsErrors,
  type LowStockSettingsValues,
} from "../types/low-stock";
import type {
  CampaignTranslationFormErrors,
  CampaignTranslationsByLocale,
} from "../types/localization";
import {
  getCampaignTranslationsViewModel,
  type CampaignTranslationsViewModel,
} from "../utils/campaign-localization";
import {
  buildCampaignViewModel,
  type CampaignViewModel,
} from "../utils/campaign-view-model";

type LoaderData = {
  id: string;
  values: CampaignFormValues;
  badgeValues: BadgeSettingsValues;
  designValues: CampaignDesignValues;
  designViewModel: CampaignViewModel;
  deliveryCutoffValues: DeliveryCutoffSettingsValues;
  discountApiError: string;
  discountOptions: DiscountOption[];
  discountValues: DiscountSettingsValues;
  freeShippingValues: FreeShippingSettingsValues;
  lowStockValues: LowStockSettingsValues;
  hasBadge: boolean;
  hasDeliveryCutoff: boolean;
  hasFreeShippingGoal: boolean;
  hasLowStock: boolean;
  translationsViewModel: CampaignTranslationsViewModel;
  isProPlan: boolean;
  lockedFeatures: {
    badge: string;
    customCss: string;
    deliveryCutoff: string;
    discountSync: string;
    multiLanguage: string;
  };
};

type ActionData = {
  badgeErrors?: BadgeSettingsErrors;
  badgeValues?: BadgeSettingsValues;
  errors?: CampaignFormErrors;
  values?: CampaignFormValues;
  designErrors?: CampaignDesignErrors;
  designValues?: CampaignDesignValues;
  deliveryCutoffErrors?: DeliveryCutoffSettingsErrors;
  deliveryCutoffValues?: DeliveryCutoffSettingsValues;
  discountErrors?: DiscountSettingsErrors;
  discountNotice?: string;
  discountValues?: DiscountSettingsValues;
  freeShippingErrors?: FreeShippingSettingsErrors;
  freeShippingValues?: FreeShippingSettingsValues;
  lowStockErrors?: LowStockSettingsErrors;
  lowStockValues?: LowStockSettingsValues;
  translationErrors?: CampaignTranslationFormErrors;
  translationValues?: CampaignTranslationsByLocale;
};

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const id = params.id;

  if (!id) {
    throw new Response("Campaign id is required.", { status: 400 });
  }

  const campaign = await getCampaignForShop(id, shop.id);

  if (!campaign) {
    throw new Response("Campaign not found.", { status: 404 });
  }

  const translation =
    campaign.translations.find((item) => item.locale === "en") ??
    campaign.translations[0];
  const placement = campaign.placements[0];
  const designValues = toCampaignDesignValues(campaign.design);
  const hasFreeShippingGoal =
    campaign.type === "FREE_SHIPPING_GOAL" || campaign.goal === "FREE_SHIPPING";
  const hasDeliveryCutoff =
    campaign.type === "DELIVERY_CUTOFF" || campaign.goal === "DELIVERY_CUTOFF";
  const hasLowStock =
    campaign.type === "LOW_STOCK" || campaign.goal === "LOW_STOCK_URGENCY";
  const hasBadge =
    campaign.type === "PRODUCT_BADGE" || campaign.goal === "PRODUCT_BADGE";
  const effectivePlan = getEffectiveShopPlan(shop);
  const lockedFeatures = {
    badge: getLockedFeatureReason(shop, "product_badges"),
    customCss: getLockedFeatureReason(shop, "custom_css"),
    deliveryCutoff: getLockedFeatureReason(shop, "delivery_cutoff"),
    discountSync: getLockedFeatureReason(shop, "discount_sync"),
    multiLanguage: getLockedFeatureReason(shop, "multi_language"),
  };
  const discountListResult = lockedFeatures.discountSync
    ? { discounts: [], error: "" }
    : await loadDiscountOptions(admin);

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
      headline: translation?.headline ?? "",
      subheadline: translation?.subheadline ?? "",
      ctaText: translation?.ctaText ?? "",
      ctaUrl: translation?.ctaUrl ?? "",
    },
    designValues,
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
    badgeValues: toBadgeSettingsValues(campaign.badgeSettings),
    deliveryCutoffValues: toDeliveryCutoffSettingsValues(
      campaign.deliveryCutoffSettings,
      campaign.timezone,
    ),
    discountApiError: discountListResult.error,
    discountOptions: discountListResult.discounts,
    discountValues: toDiscountSettingsValues(campaign.discountSync),
    freeShippingValues: toFreeShippingSettingsValues(
      campaign.freeShippingSettings,
    ),
    lowStockValues: toLowStockSettingsValues(campaign.lowStockSettings),
    hasBadge,
    hasDeliveryCutoff,
    hasFreeShippingGoal,
    hasLowStock,
    translationsViewModel: getCampaignTranslationsViewModel({
      name: campaign.name,
      type: campaign.type,
      goal: campaign.goal,
      translations: campaign.translations,
    }),
    isProPlan: effectivePlan === "PRO",
    lockedFeatures,
  };
};

export const action = async ({
  params,
  request,
}: ActionFunctionArgs): Promise<ActionData | Response> => {
  const { admin, session, redirect } = await authenticate.admin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const id = params.id;

  if (!id) {
    return { errors: { form: "Campaign id is required." } };
  }

  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "saveBasics");
  const effectivePlan = getEffectiveShopPlan(shop);

  if (intent === "saveDesign") {
    const parsed = parseCampaignDesignFormData(formData, effectivePlan);

    if (hasCampaignDesignErrors(parsed.errors)) {
      return {
        designErrors: parsed.errors,
        designValues: parsed.values,
      };
    }

    try {
      await updateCampaignDesignForShop(id, shop.id, parsed.values);
      return redirect(`/app/campaigns/${id}`);
    } catch (error) {
      console.error("Failed to update campaign design", error);

      return {
        designValues: parsed.values,
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

  if (intent === "saveFreeShippingSettings") {
    const parsed = parseFreeShippingSettingsFormData(formData);

    if (hasFreeShippingSettingsErrors(parsed.errors)) {
      return {
        freeShippingErrors: parsed.errors,
        freeShippingValues: parsed.values,
      };
    }

    try {
      await updateFreeShippingSettingsForShop(id, shop.id, {
        thresholdAmount: parsed.thresholdAmount,
        currencyCode: parsed.values.currencyCode,
        includeDiscountedSubtotal: parsed.values.includeDiscountedSubtotal,
        emptyCartMessage: parsed.values.emptyCartMessage,
        successMessage: parsed.values.successMessage,
        progressStyle: parsed.values.progressStyle,
        thresholdRules: parsed.thresholdRules,
      });
      return redirect(`/app/campaigns/${id}`);
    } catch (error) {
      console.error("Failed to update free shipping settings", error);

      return {
        freeShippingValues: parsed.values,
        freeShippingErrors: {
          form: "Free shipping settings could not be saved. Check the fields and try again.",
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

  if (intent === "saveLowStockSettings") {
    const parsed = parseLowStockSettingsFormData(formData);

    if (hasLowStockSettingsErrors(parsed.errors)) {
      return {
        lowStockErrors: parsed.errors,
        lowStockValues: parsed.values,
      };
    }

    try {
      await updateLowStockSettingsForShop(id, shop.id, {
        fallbackMessage: parsed.values.fallbackMessage,
        showExactQuantity: parsed.values.showExactQuantity,
        threshold: parsed.threshold,
      });
      return redirect(`/app/campaigns/${id}`);
    } catch (error) {
      console.error("Failed to update low stock settings", error);

      return {
        lowStockValues: parsed.values,
        lowStockErrors: {
          form: "Low stock settings could not be saved. Check the fields and try again.",
        },
      };
    }
  }

  if (intent === "saveBadgeSettings") {
    const badgeGate = canUseFeature(shop, "product_badges");

    if (!badgeGate.allowed) {
      return {
        badgeErrors: {
          form: badgeGate.reason,
        },
      };
    }

    const parsed = parseBadgeSettingsFormData(formData);

    if (hasBadgeSettingsErrors(parsed.errors)) {
      return {
        badgeErrors: parsed.errors,
        badgeValues: parsed.values,
      };
    }

    try {
      await updateBadgeSettingsForShop(id, shop.id, parsed.values);
      return redirect(`/app/campaigns/${id}`);
    } catch (error) {
      console.error("Failed to update badge settings", error);

      return {
        badgeValues: parsed.values,
        badgeErrors: {
          form: "Badge settings could not be saved. Check the fields and try again.",
        },
      };
    }
  }

  if (intent === "saveDeliveryCutoffSettings") {
    const deliveryCutoffGate = canUseFeature(shop, "delivery_cutoff");

    if (!deliveryCutoffGate.allowed) {
      return {
        deliveryCutoffErrors: {
          form: deliveryCutoffGate.reason,
        },
      };
    }

    const parsed = parseDeliveryCutoffSettingsFormData(formData);

    if (hasDeliveryCutoffSettingsErrors(parsed.errors)) {
      return {
        deliveryCutoffErrors: parsed.errors,
        deliveryCutoffValues: parsed.values,
      };
    }

    try {
      await updateDeliveryCutoffSettingsForShop(id, shop.id, {
        afterCutoffBehavior: parsed.values.afterCutoffBehavior,
        countryRules: parsed.countryRules,
        cutoffHour: parsed.cutoffHour,
        cutoffMinute: parsed.cutoffMinute,
        holidays: parsed.holidays,
        maxDeliveryDays: parsed.maxDeliveryDays,
        minDeliveryDays: parsed.minDeliveryDays,
        processingDays: parsed.processingDays,
        timezone: parsed.values.timezone,
        workingDays: parsed.workingDays,
      });
      return redirect(`/app/campaigns/${id}`);
    } catch (error) {
      console.error("Failed to update delivery cutoff settings", error);

      return {
        deliveryCutoffValues: parsed.values,
        deliveryCutoffErrors: {
          form: "Delivery cutoff settings could not be saved. Check the fields and try again.",
        },
      };
    }
  }

  const parsed = parseCampaignFormData(formData, {
    allowInactiveStatuses: true,
  });

  if (hasCampaignFormErrors(parsed.errors)) {
    return {
      errors: parsed.errors,
      values: parsed.values,
    };
  }

  try {
    const planErrors = await validateCampaignPlanAccess(shop, parsed.values, {
      campaignId: id,
    });

    if (planErrors.length > 0) {
      return {
        values: parsed.values,
        errors: {
          form: planErrors.join(" "),
        },
      };
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
      headline: parsed.values.headline,
      subheadline: parsed.values.subheadline,
      ctaText: parsed.values.ctaText,
      ctaUrl: parsed.values.ctaUrl,
    });

    return redirect("/app/campaigns");
  } catch (error) {
    console.error("Failed to update campaign", error);

    return {
      values: parsed.values,
      errors: {
        form: "Campaign could not be updated. Check the fields and try again.",
      },
    };
  }
};

export default function EditCampaignPage() {
  const {
    id,
    values,
    designValues,
    designViewModel,
    badgeValues,
    deliveryCutoffValues,
    discountApiError,
    discountOptions,
    discountValues,
    freeShippingValues,
    lowStockValues,
    hasBadge,
    hasDeliveryCutoff,
    hasFreeShippingGoal,
    hasLowStock,
    translationsViewModel,
    isProPlan,
    lockedFeatures,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const translationValues =
    actionData?.translationValues ?? translationsViewModel.values;

  return (
    <s-page heading="Edit campaign">
      <CampaignEditorLayout
        details={
          <CampaignForm
            mode="edit"
            values={actionData?.values ?? values}
            errors={actionData?.errors}
          />
        }
        settings={
          <>
            <DiscountSettingsEditor
              apiError={discountApiError}
              discountOptions={discountOptions}
              errors={actionData?.discountErrors}
              lockedReason={lockedFeatures.discountSync}
              notice={actionData?.discountNotice}
              values={actionData?.discountValues ?? discountValues}
            />
            {hasBadge ||
            hasDeliveryCutoff ||
            hasFreeShippingGoal ||
            hasLowStock ? (
              <>
                <LowStockSettingsEditor
                  enabled={hasLowStock}
                  errors={actionData?.lowStockErrors}
                  values={actionData?.lowStockValues ?? lowStockValues}
                />
                <BadgeSettingsEditor
                  enabled={hasBadge}
                  errors={actionData?.badgeErrors}
                  lockedReason={lockedFeatures.badge}
                  values={actionData?.badgeValues ?? badgeValues}
                />
                <DeliveryCutoffSettingsEditor
                  enabled={hasDeliveryCutoff}
                  errors={actionData?.deliveryCutoffErrors}
                  lockedReason={lockedFeatures.deliveryCutoff}
                  values={
                    actionData?.deliveryCutoffValues ?? deliveryCutoffValues
                  }
                />
                <FreeShippingSettingsEditor
                  enabled={hasFreeShippingGoal}
                  errors={actionData?.freeShippingErrors}
                  values={actionData?.freeShippingValues ?? freeShippingValues}
                />
              </>
            ) : null}
          </>
        }
        translations={
          lockedFeatures.multiLanguage ? (
            <PlanUpgradeCallout
              message={lockedFeatures.multiLanguage}
              title="Translations are locked"
            />
          ) : (
            <CampaignTranslationsEditor
              errors={actionData?.translationErrors}
              initialValues={translationValues}
              key={`${id}:${JSON.stringify(translationValues)}`}
              resolvedValues={translationsViewModel.resolvedValues}
            />
          )
        }
        design={
          <CampaignDesignEditor
            errors={actionData?.designErrors}
            initialDesign={actionData?.designValues ?? designValues}
            isProPlan={isProPlan}
            lockedCustomCssReason={lockedFeatures.customCss}
            viewModel={designViewModel}
          />
        }
      />
    </s-page>
  );
}

function toDateTimeLocalValue(date: Date | string | null) {
  if (!date) return "";
  const parsedDate = typeof date === "string" ? new Date(date) : date;

  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toISOString().slice(0, 16);
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

type CampaignDesignRecord =
  | (Partial<Omit<CampaignDesignValues, "customCss">> & {
      customCss?: string | null;
    })
  | null;

function toCampaignDesignValues(
  design: CampaignDesignRecord,
): CampaignDesignValues {
  return {
    ...defaultCampaignDesignValues,
    ...design,
    customCss: design?.customCss ?? "",
  };
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
    syncStartEnd: boolean;
  } | null,
): DiscountSettingsValues {
  if (!settings) return defaultDiscountSettingsValues;

  return {
    ...defaultDiscountSettingsValues,
    mode: "LINK_EXISTING",
    existingCodeOrId: settings.discountCode ?? settings.shopifyDiscountId ?? "",
    discountCode: settings.discountCode ?? "",
    shopifyDiscountId: settings.shopifyDiscountId ?? "",
    syncStartEnd: settings.syncStartEnd,
  };
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
