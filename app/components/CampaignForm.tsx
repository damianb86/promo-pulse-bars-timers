import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  CampaignPreviewPanel,
  type PreviewPlacement,
} from "./CampaignPreviewPanel";
import type { PreviewDevice } from "./DevicePreviewToggle";
import { TimezoneCombobox } from "./TimezoneCombobox";
import { CampaignTranslationsEditor } from "./CampaignTranslationsEditor";
import {
  campaignGoalOptions,
  campaignEditableStatusOptions,
  campaignStatusOptions,
  campaignTypeOptions,
  placementTypeOptions,
  type CampaignGoalValue,
  type CampaignTypeValue,
  type PlacementTypeValue,
} from "../types/campaign-options";
import { CampaignControlStatusBadge } from "./CampaignControlStatusBadge";
import {
  defaultCampaignDesignValues,
  type CampaignDesignValues,
} from "../types/campaign-design";
import type {
  CampaignTargetingOptions,
  CampaignFormErrors,
  CampaignFormValues,
  CampaignTimerExpiredBehaviorValue,
  CampaignTimerModeValue,
  CountrySelectionValue,
  ProductSelectionValue,
} from "../types/campaign-form";
import {
  buildCampaignBadgeSettingsValues,
  buildCampaignDeliveryCutoffSettingsValues,
  buildCampaignFreeShippingSettingsValues,
  buildCampaignLowStockSettingsValues,
  buildCampaignTimerSettingsValues,
  emptyCampaignTargetingOptions,
  parseDeliveryWorkingDays,
  splitCampaignList,
} from "../types/campaign-form";
import { badgePositionOptions, badgeShapeOptions } from "../types/badge";
import { afterCutoffBehaviorOptions } from "../types/delivery-cutoff";
import { freeShippingProgressStyleOptions } from "../types/free-shipping";
import type {
  CampaignTranslationFormErrors,
  CampaignTranslationsByLocale,
  StorefrontLocale,
} from "../types/localization";
import { buildCampaignViewModel } from "../utils/campaign-view-model";

type CampaignFormProps = {
  campaignId?: string;
  confirmOnSubmit?: boolean;
  design?: CampaignDesignValues;
  designHiddenInputs?: ReactNode;
  mobileDesign?: CampaignDesignValues;
  values: CampaignFormValues;
  errors?: CampaignFormErrors;
  formId?: string;
  hiddenBuilderTabs?: BuilderTabKey[];
  idPrefix?: string;
  initialTab?: BuilderTabKey;
  lockedTargetingFeatures?: {
    advanced: string;
    basic: string;
    geo: string;
    recurringTimers?: string;
    scheduling?: string;
  };
  listenForSaveEvents?: boolean;
  messageAddon?: ReactNode;
  messageInitialLocale?: StorefrontLocale;
  messageResolvedTranslations?: CampaignTranslationsByLocale;
  messageTranslationErrors?: CampaignTranslationFormErrors;
  messageTranslations?: CampaignTranslationsByLocale;
  mode: "create" | "edit";
  showBuilderTabs?: boolean;
  showPreview?: boolean;
  showTopbar?: boolean;
  syncExternalValues?: boolean;
  targetingOptions?: CampaignTargetingOptions;
  topbarActions?: ReactNode;
  onDesignChange?: (values: CampaignDesignValues) => void;
  onMobileDesignChange?: (values: CampaignDesignValues) => void;
  onValuesChange?: (values: CampaignFormValues) => void;
};

type ResourceFieldName = "productIds" | "excludeProductIds" | "collectionIds";
type TextListFieldName =
  | ResourceFieldName
  | "productTags"
  | "countries"
  | "urlContains"
  | "excludedUrlContains";
type AiApplyValuesEventDetail = {
  design?: CampaignDesignValues;
  values?: Partial<CampaignFormValues>;
};

type ResourceChip = {
  id: string;
  label: string;
};

type ShopifyResourcePickerType = "product" | "collection";

type ShopifyResourcePickerResult = Array<{
  id?: string;
  title?: string;
  handle?: string;
}>;

type BuilderTabKey =
  | "setup"
  | "message"
  | "placement"
  | "targeting"
  | "schedule"
  | "review";

const builderTabs: Array<{
  key: BuilderTabKey;
  label: string;
  title: string;
  pill: string;
  description: string;
}> = [
  {
    key: "setup",
    label: "Setup",
    title: "Campaign setup",
    pill: "Intent",
    description:
      "Define the campaign type and status before editing copy or placements.",
  },
  {
    key: "message",
    label: "Message",
    title: "Copy and call to action",
    pill: "Copy",
    description:
      "Write the customer-facing message and CTA that will appear in the live preview.",
  },
  {
    key: "placement",
    label: "Placement",
    title: "Storefront placement",
    pill: "Surface",
    description:
      "Choose the storefront surfaces where this campaign is allowed to render. Select more than one when the same campaign should appear in several places.",
  },
  {
    key: "targeting",
    label: "Targeting",
    title: "Product and audience targeting",
    pill: "Eligibility",
    description:
      "Limit which products, collections, tags, or countries can show this campaign. These filters are separate from where the widget is placed.",
  },
  {
    key: "schedule",
    label: "Schedule",
    title: "Timing and timezone",
    pill: "Real time",
    description:
      "Set real start/end timing and the UTC offset representative used for timer calculations.",
  },
  {
    key: "review",
    label: "Review",
    title: "Review before saving",
    pill: "Checks",
    description:
      "Check the important settings before confirming changes that can affect the storefront.",
  },
];

const timerModeOptions: Array<{
  description: string;
  disabledFeature?: "recurringTimers";
  label: string;
  value: CampaignTimerModeValue;
}> = [
  {
    description: "Timer that ends at the specific date.",
    label: "Countdown to a date",
    value: "FIXED_DATE",
  },
  {
    description: "Individual fixed minutes countdown for each buyer session.",
    label: "Fixed minutes",
    value: "EVERGREEN_SESSION",
  },
  {
    description: "E.g. every day until the configured cutoff time.",
    disabledFeature: "recurringTimers",
    label: "Daily recurring timer",
    value: "RECURRING_DAILY",
  },
];

const timerExpiredBehaviorOptions: Array<{
  label: string;
  value: CampaignTimerExpiredBehaviorValue;
}> = [
  { label: "Unpublish timer", value: "UNPUBLISH_TIMER" },
  { label: "Hide the timer for the buyer", value: "HIDE_TIMER" },
  { label: "Repeat the countdown", value: "REPEAT_COUNTDOWN" },
  { label: "Show custom title", value: "SHOW_CUSTOM_TITLE" },
  { label: "Do nothing", value: "DO_NOTHING" },
];

const cartTimerResetBehaviorOptions: Array<{
  label: string;
  value: CampaignFormValues["cartTimerResetBehavior"];
}> = [
  { label: "Per cart session", value: "ON_SESSION_END" },
  { label: "Never reset for the visitor", value: "NEVER" },
  { label: "Reset daily", value: "DAILY" },
  { label: "Reset weekly", value: "WEEKLY" },
];

const deliveryWeekdayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;

const goalIconLabels: Record<CampaignFormValues["goal"], string> = {
  FLASH_SALE: "Flash sale",
  FREE_SHIPPING: "Free shipping",
  CART_RESCUE: "Cart rescue",
  DELIVERY_CUTOFF: "Delivery cutoff",
  LOW_STOCK_URGENCY: "Low stock urgency",
  PRODUCT_BADGE: "Product badge",
  ANNOUNCEMENT: "Announcement",
};

type CampaignSetupPreset = {
  design?: Partial<CampaignDesignValues>;
  form?: Partial<CampaignFormValues>;
  goal?: CampaignGoalValue;
  placementType: PlacementTypeValue;
  productSelection?: ProductSelectionValue;
  type?: CampaignTypeValue;
};

type CampaignTypeChoice = {
  description: string;
  goal: CampaignGoalValue;
  icon: "goal" | "type";
  label: string;
  type: CampaignTypeValue;
  value: string;
};

const countdownBarDesignPreset: Partial<CampaignDesignValues> = {
  alignment: "CENTER",
  backgroundType: "GRADIENT",
  borderRadius: 0,
  borderSize: 0,
  contentGap: 8,
  contentMaxWidth: 980,
  fullWidth: true,
  gradientAngle: 90,
  gradientEndColor: "#B975F4",
  gradientStartColor: "#45E4D9",
  icon: "FIRE",
  layout: "INLINE",
  paddingBlock: 10,
  paddingInline: 18,
  positionMode: "FLOW",
  positionSticky: true,
  showButton: true,
  showIcon: true,
  timerFormat: "COLON",
  timerShowLabels: false,
  timerStyle: "PLAIN",
};

const campaignTypeSetupPresets: Record<CampaignTypeValue, CampaignSetupPreset> =
  {
    COUNTDOWN_BAR: {
      design: countdownBarDesignPreset,
      form: {
        timerExpiredBehavior: "UNPUBLISH_TIMER",
        timerMode: "FIXED_DATE",
      },
      placementType: "TOP_BAR",
      productSelection: "ALL_PRODUCTS",
    },
    PRODUCT_TIMER: {
      design: {
        alignment: "CENTER",
        borderRadius: 8,
        contentMaxWidth: 560,
        fullWidth: false,
        icon: "CLOCK",
        layout: "BALANCED",
        paddingBlock: 16,
        paddingInline: 18,
        positionMode: "FLOW",
        positionSticky: false,
        showButton: false,
        showIcon: true,
        timerFormat: "UNITS",
        timerShowLabels: true,
        timerStyle: "BOXES",
      },
      form: {
        timerExpiredBehavior: "UNPUBLISH_TIMER",
        timerMode: "FIXED_DATE",
      },
      placementType: "PRODUCT_PAGE",
    },
    CART_TIMER: {
      design: {
        alignment: "CENTER",
        borderRadius: 8,
        contentMaxWidth: 420,
        fullWidth: false,
        icon: "CLOCK",
        layout: "STANDARD",
        paddingBlock: 12,
        paddingInline: 14,
        positionMode: "FLOW",
        positionSticky: false,
        showButton: false,
        showIcon: true,
        timerFormat: "UNITS",
        timerShowLabels: true,
        timerStyle: "GROUPED",
      },
      form: {
        cartTimerDurationMinutes: "120",
        cartTimerResetBehavior: "ON_SESSION_END",
        timerDurationMinutes: "120",
        timerExpiredBehavior: "HIDE_TIMER",
        timerMode: "EVERGREEN_SESSION",
        timerResetBehavior: "ON_SESSION_END",
      },
      goal: "CART_RESCUE",
      placementType: "CART_DRAWER",
      productSelection: "ALL_PRODUCTS",
    },
    FREE_SHIPPING_GOAL: {
      design: {
        alignment: "CENTER",
        borderRadius: 8,
        contentMaxWidth: 520,
        fullWidth: false,
        icon: "TRUCK",
        layout: "BALANCED",
        paddingBlock: 12,
        paddingInline: 14,
        positionMode: "FLOW",
        positionSticky: false,
        showButton: false,
        showIcon: true,
        templateKey: "free-shipping",
        timerFormat: "COLON",
        timerShowLabels: false,
        timerShowSeconds: false,
        timerStyle: "PLAIN",
      },
      form: {
        freeShippingAutoDiscount: false,
        freeShippingDiscountCode: "FREESHIP",
        freeShippingDiscountTitle: "Promo Pulse free shipping",
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      goal: "FREE_SHIPPING",
      placementType: "CART_DRAWER",
      productSelection: "ALL_PRODUCTS",
    },
    DELIVERY_CUTOFF: {
      design: {
        alignment: "CENTER",
        borderRadius: 8,
        contentMaxWidth: 560,
        fullWidth: false,
        icon: "CLOCK",
        layout: "BALANCED",
        paddingBlock: 14,
        paddingInline: 18,
        positionMode: "FLOW",
        positionSticky: false,
        showButton: false,
        showIcon: true,
        timerFormat: "UNITS",
        timerShowLabels: true,
        timerStyle: "GROUPED",
      },
      form: {
        deliveryAfterCutoffBehavior: "SHOW_NEXT_WINDOW",
        deliveryCutoffHour: "14",
        deliveryCutoffMinute: "0",
        deliveryMaxDays: "5",
        deliveryMinDays: "2",
        deliveryProcessingDays: "0",
        deliveryWorkingDays: "1,2,3,4,5",
        timerExpiredBehavior: "UNPUBLISH_TIMER",
        timerMode: "FIXED_DATE",
      },
      goal: "DELIVERY_CUTOFF",
      placementType: "PRODUCT_PAGE",
    },
    LOW_STOCK: {
      design: {
        alignment: "CENTER",
        borderRadius: 6,
        contentMaxWidth: 520,
        fullWidth: false,
        icon: "TAG",
        layout: "INLINE",
        paddingBlock: 10,
        paddingInline: 14,
        positionMode: "FLOW",
        positionSticky: false,
        showButton: false,
        showIcon: true,
        timerFormat: "UNITS",
        timerShowLabels: false,
        timerStyle: "PLAIN",
      },
      form: {
        lowStockFallbackMessage: "Only a few left",
        lowStockShowExactQuantity: false,
        lowStockThreshold: "5",
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      goal: "LOW_STOCK_URGENCY",
      placementType: "PRODUCT_PAGE",
    },
    PRODUCT_BADGE: {
      design: {
        alignment: "CENTER",
        borderRadius: 999,
        contentMaxWidth: 320,
        fullWidth: false,
        icon: "NONE",
        layout: "INLINE",
        paddingBlock: 6,
        paddingInline: 12,
        positionMode: "FLOW",
        positionSticky: false,
        showButton: false,
        showIcon: false,
        timerFormat: "COLON",
        timerShowLabels: false,
        timerShowSeconds: false,
        timerStyle: "PLAIN",
      },
      form: {
        badgePosition: "TOP_RIGHT",
        badgeShape: "PILL",
        badgeText: "Limited offer",
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      goal: "PRODUCT_BADGE",
      placementType: "COLLECTION_CARD",
      productSelection: "ALL_PRODUCTS",
    },
  };

const campaignGoalSetupPresets: Record<CampaignGoalValue, CampaignSetupPreset> =
  {
    FLASH_SALE: {
      ...campaignTypeSetupPresets.COUNTDOWN_BAR,
      type: "COUNTDOWN_BAR",
    },
    FREE_SHIPPING: {
      ...campaignTypeSetupPresets.FREE_SHIPPING_GOAL,
      type: "FREE_SHIPPING_GOAL",
    },
    CART_RESCUE: {
      ...campaignTypeSetupPresets.CART_TIMER,
      type: "CART_TIMER",
    },
    DELIVERY_CUTOFF: {
      ...campaignTypeSetupPresets.DELIVERY_CUTOFF,
      type: "DELIVERY_CUTOFF",
    },
    LOW_STOCK_URGENCY: {
      ...campaignTypeSetupPresets.LOW_STOCK,
      type: "LOW_STOCK",
    },
    PRODUCT_BADGE: {
      ...campaignTypeSetupPresets.PRODUCT_BADGE,
      type: "PRODUCT_BADGE",
    },
    ANNOUNCEMENT: {
      design: {
        ...countdownBarDesignPreset,
        icon: "NONE",
        showIcon: false,
        timerShowSeconds: false,
      },
      form: {
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      placementType: "TOP_BAR",
      productSelection: "ALL_PRODUCTS",
      type: "COUNTDOWN_BAR",
    },
  };

const campaignTypeChoiceOptions: CampaignTypeChoice[] = [
  {
    description:
      "A sitewide urgency bar with timer and CTA. Best for short sales or announcements with a clear deadline.",
    goal: "FLASH_SALE",
    icon: "goal",
    label: "Flash sale",
    type: "COUNTDOWN_BAR",
    value: "FLASH_SALE",
  },
  {
    description:
      "A focused countdown near product content when urgency belongs to a product offer.",
    goal: "FLASH_SALE",
    icon: "type",
    label: "Product timer",
    type: "PRODUCT_TIMER",
    value: "PRODUCT_TIMER",
  },
  {
    description:
      "A cart or drawer timer for checkout urgency and cart rescue flows.",
    goal: "CART_RESCUE",
    icon: "goal",
    label: "Cart rescue",
    type: "CART_TIMER",
    value: "CART_RESCUE",
  },
  {
    description:
      "A cart progress campaign tied to a real free-shipping threshold.",
    goal: "FREE_SHIPPING",
    icon: "goal",
    label: "Free shipping",
    type: "FREE_SHIPPING_GOAL",
    value: "FREE_SHIPPING",
  },
  {
    description:
      "An order-by timer based on cutoff time, timezone, and delivery settings.",
    goal: "DELIVERY_CUTOFF",
    icon: "goal",
    label: "Delivery cutoff",
    type: "DELIVERY_CUTOFF",
    value: "DELIVERY_CUTOFF",
  },
  {
    description:
      "Inventory-aware urgency messaging without fake scarcity claims.",
    goal: "LOW_STOCK_URGENCY",
    icon: "goal",
    label: "Low stock urgency",
    type: "LOW_STOCK",
    value: "LOW_STOCK_URGENCY",
  },
  {
    description:
      "A compact product or collection badge for merchandising messages.",
    goal: "PRODUCT_BADGE",
    icon: "goal",
    label: "Product badge",
    type: "PRODUCT_BADGE",
    value: "PRODUCT_BADGE",
  },
  {
    description:
      "A general storefront announcement without a discount or scarcity assumption.",
    goal: "ANNOUNCEMENT",
    icon: "goal",
    label: "Announcement",
    type: "COUNTDOWN_BAR",
    value: "ANNOUNCEMENT",
  },
];

export function CampaignForm({
  campaignId,
  confirmOnSubmit = true,
  design = defaultCampaignDesignValues,
  designHiddenInputs,
  mobileDesign = design,
  values,
  errors = {},
  formId,
  hiddenBuilderTabs = [],
  idPrefix = "campaign",
  initialTab = "setup",
  listenForSaveEvents = true,
  lockedTargetingFeatures,
  messageAddon,
  messageInitialLocale = "en",
  messageResolvedTranslations,
  messageTranslationErrors,
  messageTranslations,
  mode,
  showBuilderTabs = true,
  showPreview = true,
  showTopbar = true,
  syncExternalValues = false,
  targetingOptions = emptyCampaignTargetingOptions,
  topbarActions,
  onDesignChange,
  onMobileDesignChange,
  onValuesChange,
}: CampaignFormProps) {
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement | null>(null);
  const hiddenBuilderTabSet = useMemo(
    () => new Set(hiddenBuilderTabs),
    [hiddenBuilderTabs],
  );
  const visibleBuilderTabs = useMemo(() => {
    const tabs = builderTabs.filter((tab) => !hiddenBuilderTabSet.has(tab.key));

    return tabs.length > 0 ? tabs : builderTabs;
  }, [hiddenBuilderTabSet]);
  const visibleBuilderTabSet = useMemo(
    () => new Set(visibleBuilderTabs.map((tab) => tab.key)),
    [visibleBuilderTabs],
  );
  const [activeTab, setActiveTab] = useState<BuilderTabKey>(() =>
    visibleBuilderTabs.some((tab) => tab.key === initialTab)
      ? initialTab
      : visibleBuilderTabs[0].key,
  );
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [
    campaignPreviewPlacementOverride,
    setCampaignPreviewPlacementOverride,
  ] = useState<{
    key: string;
    placement: PreviewPlacement;
  } | null>(null);
  const [formValues, setFormValues] = useState(() => values);
  const [localDesignValues, setLocalDesignValues] = useState(() => design);
  const [localMobileDesignValues, setLocalMobileDesignValues] = useState(
    () => mobileDesign,
  );
  const [submitAction, setSubmitAction] = useState("saveDraft");
  const [aiSuggestionJson, setAiSuggestionJson] = useState("");
  const [showProductExclusions, setShowProductExclusions] = useState(
    () => values.excludeProductIds.trim().length > 0,
  );
  const [timerIdCopied, setTimerIdCopied] = useState(false);
  const [embedHtmlCopied, setEmbedHtmlCopied] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [resourceLabels, setResourceLabels] = useState<
    Record<ResourceFieldName, ResourceChip[]>
  >(() => ({
    collectionIds: buildResourceChips(values.collectionIds),
    excludeProductIds: buildResourceChips(values.excludeProductIds),
    productIds: buildResourceChips(values.productIds),
  }));
  const isSubmitting = navigation.state === "submitting";
  const scopedId = (value: string) => `${idPrefix}-${value}`;
  const effectiveDesign = onDesignChange ? design : localDesignValues;
  const effectiveMobileDesign = onMobileDesignChange
    ? mobileDesign
    : localMobileDesignValues;
  const basicTargetingLocked = lockedTargetingFeatures?.basic ?? "";
  const geoTargetingLocked = lockedTargetingFeatures?.geo ?? "";
  const advancedTargetingLocked = lockedTargetingFeatures?.advanced ?? "";
  const recurringTimersLocked = lockedTargetingFeatures?.recurringTimers ?? "";
  const schedulingLocked = lockedTargetingFeatures?.scheduling ?? "";
  const statusOptions =
    mode === "edit" ? campaignEditableStatusOptions : campaignStatusOptions;
  const statusLabel =
    statusOptions.find((option) => option.value === formValues.status)?.label ??
    "Draft";
  const submitLabel = mode === "create" ? "Save campaign" : "Update campaign";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: submitLabel,
    title: mode === "create" ? "Save this campaign?" : "Update this campaign?",
    children: (
      <p>
        Confirming will save these campaign settings. If the campaign is active,
        the storefront may update as soon as the request completes.
      </p>
    ),
  });
  const activeGoalLabel =
    campaignGoalOptions.find((option) => option.value === formValues.goal)
      ?.label ?? "Flash sale";
  const isCartRescueCampaign =
    formValues.type === "CART_TIMER" || formValues.goal === "CART_RESCUE";
  const isDeliveryCutoffCampaign =
    formValues.type === "DELIVERY_CUTOFF" ||
    formValues.goal === "DELIVERY_CUTOFF";
  const isFreeShippingCampaign =
    formValues.type === "FREE_SHIPPING_GOAL" ||
    formValues.goal === "FREE_SHIPPING";
  const isLowStockCampaign =
    formValues.type === "LOW_STOCK" || formValues.goal === "LOW_STOCK_URGENCY";
  const isBadgeCampaign =
    formValues.type === "PRODUCT_BADGE" || formValues.goal === "PRODUCT_BADGE";
  const activeCampaignTypeChoiceKey = getCampaignTypeChoiceKey(formValues);
  const activeCampaignTypeChoice =
    campaignTypeChoiceOptions.find(
      (option) => option.value === activeCampaignTypeChoiceKey,
    ) ?? campaignTypeChoiceOptions[0];
  const activeCampaignTypeLabel =
    activeCampaignTypeChoice?.label ?? activeGoalLabel;
  const activePlacementLabel = formatPlacementSelectionLabel(
    formValues.placementTypes,
  );
  const activeTabMeta =
    visibleBuilderTabs.find((tab) => tab.key === activeTab) ??
    visibleBuilderTabs[0];
  const syncMessageFieldsFromTranslations = useCallback(
    (
      nextTranslations: CampaignTranslationsByLocale,
      locale: StorefrontLocale,
    ) => {
      const nextMessage = nextTranslations[locale] ?? nextTranslations.en;

      setFormValues((currentValues) => ({
        ...currentValues,
        headline: nextMessage.headline,
        subheadline: nextMessage.subheadline,
        ctaText: nextMessage.ctaText,
        ctaUrl: nextMessage.ctaUrl,
        expiredText: nextMessage.expiredText,
      }));
    },
    [],
  );
  const selectedProductTags = splitCampaignList(formValues.productTags);
  const selectedCountries = splitCampaignList(formValues.countries).map(
    (country) => country.toUpperCase(),
  );
  const selectedDeliveryWorkingDays = useMemo(
    () => new Set(parseDeliveryWorkingDays(formValues.deliveryWorkingDays)),
    [formValues.deliveryWorkingDays],
  );
  const matchingProductTags = useMemo(
    () =>
      targetingOptions.productTags
        .filter(
          (tag) =>
            !selectedProductTags.includes(tag) &&
            tag.toLowerCase().includes(tagQuery.trim().toLowerCase()),
        )
        .slice(0, 8),
    [selectedProductTags, tagQuery, targetingOptions.productTags],
  );
  const matchingCountries = useMemo(
    () =>
      targetingOptions.countries
        .filter(
          (country) =>
            !selectedCountries.includes(country.code) &&
            [country.code, country.name]
              .join(" ")
              .toLowerCase()
              .includes(countryQuery.trim().toLowerCase()),
        )
        .slice(0, 10),
    [countryQuery, selectedCountries, targetingOptions.countries],
  );
  const countryLabelsByCode = useMemo(
    () =>
      new Map(
        targetingOptions.countries.map((country) => [
          country.code,
          country.name,
        ]),
      ),
    [targetingOptions.countries],
  );
  const campaignEmbedHtml = campaignId
    ? `<div class="pp-campaign-slot" data-promo-pulse-placement="CUSTOM_SELECTOR" data-promo-pulse-campaign-id="${campaignId}"></div>`
    : "";
  const previewPlacements = useMemo(
    () =>
      Array.from(new Set(formValues.placementTypes.map(toPreviewPlacement))),
    [formValues.placementTypes],
  );
  const campaignPreviewPlacementKey = formValues.placementTypes.join("|");
  const defaultCampaignPreviewPlacement = toPreviewPlacement(
    formValues.placementType,
  );
  const campaignPreviewPlacement =
    campaignPreviewPlacementOverride?.key === campaignPreviewPlacementKey
      ? campaignPreviewPlacementOverride.placement
      : defaultCampaignPreviewPlacement;
  const selectCampaignPreviewPlacement = (nextPlacement: PreviewPlacement) => {
    setCampaignPreviewPlacementOverride({
      key: campaignPreviewPlacementKey,
      placement: nextPlacement,
    });
  };
  const previewViewModel = useMemo(
    () =>
      buildCampaignViewModel({
        name: formValues.name || "Campaign preview",
        type: formValues.type,
        endsAt: formValues.endsAt || null,
        timezone: formValues.timezone || "UTC",
        placements: formValues.placementTypes.map((placementType) => ({
          placementType,
          enabled: true,
        })),
        translations: [
          {
            locale: "en",
            headline: formValues.headline || activeGoalLabel,
            subheadline: formValues.subheadline,
            ctaText: formValues.ctaText || "Shop now",
            ctaUrl: formValues.ctaUrl || "#",
            expiredText: formValues.expiredText || "This offer has ended.",
          },
        ],
        design: effectiveDesign,
        timerSettings: buildCampaignTimerSettingsValues(formValues),
        freeShippingSettings: isFreeShippingCampaign
          ? buildCampaignFreeShippingSettingsValues(formValues)
          : null,
        deliveryCutoffSettings: isDeliveryCutoffCampaign
          ? buildCampaignDeliveryCutoffSettingsValues(formValues)
          : null,
        lowStockSettings: isLowStockCampaign
          ? buildCampaignLowStockSettingsValues(formValues)
          : null,
        badgeSettings: isBadgeCampaign
          ? buildCampaignBadgeSettingsValues(formValues)
          : null,
        discountSync: formValues.freeShippingAutoDiscount
          ? {
              discountCode: formValues.freeShippingDiscountCode,
              showCodeOnStorefront: formValues.freeShippingShowDiscountCode,
            }
          : null,
      }),
    [
      activeGoalLabel,
      effectiveDesign,
      formValues,
      isBadgeCampaign,
      isDeliveryCutoffCampaign,
      isFreeShippingCampaign,
      isLowStockCampaign,
    ],
  );
  const summaryRows = useMemo(
    () => [
      ["Campaign type", activeCampaignTypeLabel],
      ["Placement", activePlacementLabel],
      ["Status", statusLabel],
      ["Starts", formatDateTimeLabel(formValues.startsAt, "Immediately")],
      ["Ends", formatDateTimeLabel(formValues.endsAt, "No fixed end")],
      ["Timezone", formValues.timezone || "UTC"],
    ],
    [
      activeCampaignTypeLabel,
      activePlacementLabel,
      formValues.endsAt,
      formValues.startsAt,
      formValues.timezone,
      statusLabel,
    ],
  );

  const updateField =
    <Key extends keyof CampaignFormValues>(field: Key) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const value = event.currentTarget.value as CampaignFormValues[Key];

      setFormValues((currentValues) => ({
        ...currentValues,
        [field]: value,
      }));
    };

  const updateCheckboxField =
    <Key extends keyof CampaignFormValues>(field: Key) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.currentTarget.checked as CampaignFormValues[Key];

      setFormValues((currentValues) => ({
        ...currentValues,
        [field]: value,
      }));
    };

  const toggleFreeShippingAutoDiscount = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const checked = event.currentTarget.checked;

    if (
      checked &&
      typeof window !== "undefined" &&
      !window.confirm(
        "Promo Pulse will create or link a Shopify free shipping discount code with this threshold the next time you save.",
      )
    ) {
      return;
    }

    setFormValues((currentValues) => ({
      ...currentValues,
      freeShippingAutoDiscount: checked,
    }));
  };

  const togglePlacement = (
    placementType: CampaignFormValues["placementType"],
  ) => {
    const willSelectPlacement =
      !formValues.placementTypes.includes(placementType);

    setFormValues((currentValues) => {
      const isSelected = currentValues.placementTypes.includes(placementType);
      const placementTypes = isSelected
        ? currentValues.placementTypes.filter((item) => item !== placementType)
        : [
            placementType,
            ...currentValues.placementTypes.filter(
              (item) => item !== placementType,
            ),
          ];
      const normalizedPlacementTypes =
        placementTypes.length > 0
          ? placementTypes
          : currentValues.placementTypes;
      const primaryPlacement =
        normalizedPlacementTypes[0] ?? currentValues.placementType;

      return {
        ...currentValues,
        placementType: primaryPlacement,
        placementTypes: normalizedPlacementTypes,
      };
    });

    if (
      willSelectPlacement &&
      (placementType === "TOP_BAR" || placementType === "BOTTOM_BAR")
    ) {
      updateDesignValues({
        ...effectiveDesign,
        borderRadius: 0,
        fullWidth: true,
      });
    }
  };

  const selectProductSelection = (productSelection: ProductSelectionValue) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      productSelection,
    }));
  };

  const selectCountrySelection = (countrySelection: CountrySelectionValue) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      countrySelection,
    }));
  };

  const selectTimerMode = (timerMode: CampaignTimerModeValue) => {
    if (timerMode === "RECURRING_DAILY" && recurringTimersLocked) return;

    setFormValues((currentValues) => ({
      ...currentValues,
      timerMode,
      startsAt: timerMode === "FIXED_DATE" ? currentValues.startsAt : "",
      endsAt: timerMode === "FIXED_DATE" ? currentValues.endsAt : "",
      timerExpiredBehavior:
        timerMode === "FIXED_DATE"
          ? currentValues.timerExpiredBehavior === "HIDE_TIMER"
            ? "UNPUBLISH_TIMER"
            : currentValues.timerExpiredBehavior
          : currentValues.timerExpiredBehavior === "UNPUBLISH_TIMER"
            ? "HIDE_TIMER"
            : currentValues.timerExpiredBehavior,
    }));
  };

  const selectTimerStart = (mode: "NOW" | "SCHEDULED") => {
    if (mode === "SCHEDULED" && schedulingLocked) return;

    setFormValues((currentValues) => ({
      ...currentValues,
      startsAt:
        mode === "NOW"
          ? ""
          : currentValues.startsAt || toDateTimeLocalInputValue(new Date()),
    }));
  };

  const copyTimerId = () => {
    if (!campaignId || !navigator.clipboard) return;

    navigator.clipboard
      .writeText(campaignId)
      .then(() => {
        setTimerIdCopied(true);
        window.setTimeout(() => setTimerIdCopied(false), 1800);
      })
      .catch(() => setTimerIdCopied(false));
  };

  const copyEmbedHtml = () => {
    if (!campaignEmbedHtml || !navigator.clipboard) return;

    navigator.clipboard
      .writeText(campaignEmbedHtml)
      .then(() => {
        setEmbedHtmlCopied(true);
        window.setTimeout(() => setEmbedHtmlCopied(false), 1800);
      })
      .catch(() => setEmbedHtmlCopied(false));
  };

  const setListField = (field: TextListFieldName, items: string[]) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: items.join("\n"),
    }));
  };

  const setManualListField =
    (field: TextListFieldName) =>
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setFormValues((currentValues) => ({
        ...currentValues,
        [field]: event.currentTarget.value,
      }));

      if (
        field === "productIds" ||
        field === "excludeProductIds" ||
        field === "collectionIds"
      ) {
        setResourceLabels((currentLabels) => ({
          ...currentLabels,
          [field]: buildResourceChips(event.currentTarget.value),
        }));
      }
    };

  const openResourcePicker = async (
    type: ShopifyResourcePickerType,
    field: ResourceFieldName,
  ) => {
    const shopify = getShopifyBridge();

    if (!shopify?.resourcePicker) {
      setPickerError(
        "Shopify Resource Picker is not available in this context. Use manual IDs below.",
      );
      return;
    }

    setPickerError("");

    const selected = await shopify.resourcePicker({
      action: "select",
      filter: type === "product" ? { variants: false } : undefined,
      multiple: true,
      selectionIds: splitCampaignList(formValues[field])
        .filter((id) => isSelectableResourceId(type, id))
        .map((id) => ({ id })),
      type,
    });

    if (!selected) return;

    const chips = selected
      .map((resource) => ({
        id: normalizeSelectableResourceId(type, resource.id),
        label:
          resource.title ?? resource.handle ?? shortResourceId(resource.id),
      }))
      .filter((chip): chip is ResourceChip => Boolean(chip.id));

    setResourceLabels((currentLabels) => ({
      ...currentLabels,
      [field]: chips,
    }));
    setListField(
      field,
      chips.map((chip) => chip.id),
    );
  };

  const removeResourceChip = (field: ResourceFieldName, id: string) => {
    const nextIds = splitCampaignList(formValues[field]).filter(
      (item) => item !== id,
    );

    setResourceLabels((currentLabels) => ({
      ...currentLabels,
      [field]: currentLabels[field].filter((chip) => chip.id !== id),
    }));
    setListField(field, nextIds);
  };

  const resourceChipsFor = (field: ResourceFieldName) => {
    const labelsById = new Map(
      resourceLabels[field].map((chip) => [chip.id, chip.label]),
    );

    return splitCampaignList(formValues[field]).map((id) => ({
      id,
      label: labelsById.get(id) ?? shortResourceId(id),
    }));
  };

  const addProductTag = (tag: string) => {
    if (!tag || selectedProductTags.includes(tag)) return;

    setListField("productTags", [...selectedProductTags, tag]);
    setTagQuery("");
  };

  const removeProductTag = (tag: string) => {
    setListField(
      "productTags",
      selectedProductTags.filter((selectedTag) => selectedTag !== tag),
    );
  };

  const selectFirstMatchingTag = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;

    event.preventDefault();

    if (matchingProductTags[0]) {
      addProductTag(matchingProductTags[0]);
    }
  };

  const addCountry = (code: string) => {
    const normalizedCode = code.toUpperCase();

    if (!normalizedCode || selectedCountries.includes(normalizedCode)) return;

    setListField("countries", [...selectedCountries, normalizedCode]);
    setCountryQuery("");
  };

  const removeCountry = (code: string) => {
    setListField(
      "countries",
      selectedCountries.filter((selectedCode) => selectedCode !== code),
    );
  };

  const selectFirstMatchingCountry = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== "Enter") return;

    event.preventDefault();

    if (matchingCountries[0]) {
      addCountry(matchingCountries[0].code);
    }
  };

  const selectCampaignTypeChoice = (choice: CampaignTypeChoice) => {
    const preset =
      choice.value === "PRODUCT_TIMER"
        ? campaignTypeSetupPresets.PRODUCT_TIMER
        : campaignGoalSetupPresets[choice.goal];

    setFormValues((currentValues) =>
      applySetupPreset(
        {
          ...currentValues,
          goal: choice.goal,
          type: choice.type,
        },
        preset,
      ),
    );
    updateDesignValues(applyDesignSetupPreset(effectiveDesign, preset.design));
  };

  const toggleDeliveryWorkingDay = (day: number) => {
    setFormValues((currentValues) => {
      const days = new Set(
        parseDeliveryWorkingDays(currentValues.deliveryWorkingDays),
      );

      if (days.has(day)) {
        days.delete(day);
      } else {
        days.add(day);
      }

      const nextDays = Array.from(days).sort((first, second) => first - second);

      return {
        ...currentValues,
        deliveryWorkingDays:
          nextDays.length > 0
            ? nextDays.join(",")
            : currentValues.deliveryWorkingDays,
      };
    });
  };

  const updateDesignValues = useCallback(
    (nextDesign: CampaignDesignValues) => {
      if (onDesignChange) {
        onDesignChange(nextDesign);
        onMobileDesignChange?.(nextDesign);
        return;
      }

      setLocalDesignValues(nextDesign);
      setLocalMobileDesignValues(nextDesign);
    },
    [onDesignChange, onMobileDesignChange],
  );

  useEffect(() => {
    if (!onDesignChange) {
      const syncDesign = window.setTimeout(() => {
        setLocalDesignValues(design);
        setLocalMobileDesignValues(mobileDesign);
      }, 0);

      return () => window.clearTimeout(syncDesign);
    }

    return undefined;
  }, [design, mobileDesign, onDesignChange]);

  useEffect(() => {
    onValuesChange?.(formValues);
  }, [formValues, onValuesChange]);

  useEffect(() => {
    if (!syncExternalValues) return undefined;

    const syncFormValues = window.setTimeout(() => {
      setFormValues(values);
    }, 0);

    return () => window.clearTimeout(syncFormValues);
  }, [syncExternalValues, values]);

  useEffect(() => {
    if (!listenForSaveEvents) return undefined;

    const submitWithAction = (action: "saveDraft" | "publishCampaign") => {
      setSubmitAction(action);
      window.setTimeout(() => formRef.current?.requestSubmit(), 0);
    };
    const handleSaveRequest = () => submitWithAction("saveDraft");
    const handlePublishRequest = () => submitWithAction("publishCampaign");
    const handleDiscardRequest = () => {
      setFormValues(values);
      setSubmitAction("saveDraft");
    };

    window.addEventListener("promo-pulse:campaign-save", handleSaveRequest);
    window.addEventListener(
      "promo-pulse:campaign-publish",
      handlePublishRequest,
    );
    window.addEventListener(
      "promo-pulse:campaign-discard",
      handleDiscardRequest,
    );

    return () => {
      window.removeEventListener(
        "promo-pulse:campaign-save",
        handleSaveRequest,
      );
      window.removeEventListener(
        "promo-pulse:campaign-publish",
        handlePublishRequest,
      );
      window.removeEventListener(
        "promo-pulse:campaign-discard",
        handleDiscardRequest,
      );
    };
  }, [listenForSaveEvents, values]);

  useEffect(() => {
    if (!visibleBuilderTabs.some((tab) => tab.key === activeTab)) {
      const syncActiveTab = window.setTimeout(() => {
        setActiveTab(visibleBuilderTabs[0].key);
      }, 0);

      return () => window.clearTimeout(syncActiveTab);
    }

    return undefined;
  }, [activeTab, visibleBuilderTabs]);

  useEffect(() => {
    const handleReviewRequest = () => {
      setActiveTab(
        visibleBuilderTabs.some((tab) => tab.key === "review")
          ? "review"
          : visibleBuilderTabs[0].key,
      );
    };
    const handleAiSuggestionJson = (event: Event) => {
      setAiSuggestionJson(
        event instanceof CustomEvent && typeof event.detail === "string"
          ? event.detail
          : "",
      );
    };
    const handleAiApplyValues = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;

      const detail = event.detail as AiApplyValuesEventDetail | undefined;
      const nextValues = detail?.values;

      if (nextValues) {
        setFormValues((currentValues) => ({
          ...currentValues,
          ...nextValues,
          placementTypes:
            nextValues.placementTypes && nextValues.placementTypes.length > 0
              ? nextValues.placementTypes
              : currentValues.placementTypes,
        }));
        setResourceLabels({
          collectionIds: buildResourceChips(nextValues.collectionIds ?? ""),
          excludeProductIds: buildResourceChips(
            nextValues.excludeProductIds ?? "",
          ),
          productIds: buildResourceChips(nextValues.productIds ?? ""),
        });
        setShowProductExclusions(
          Boolean(nextValues.excludeProductIds?.trim().length),
        );
      }

      if (detail?.design) {
        updateDesignValues(detail.design);
      }
    };

    window.addEventListener("promo-pulse:campaign-review", handleReviewRequest);
    window.addEventListener(
      "promo-pulse:ai-suggestion-json",
      handleAiSuggestionJson,
    );
    window.addEventListener("promo-pulse:ai-apply-values", handleAiApplyValues);

    return () => {
      window.removeEventListener(
        "promo-pulse:campaign-review",
        handleReviewRequest,
      );
      window.removeEventListener(
        "promo-pulse:ai-suggestion-json",
        handleAiSuggestionJson,
      );
      window.removeEventListener(
        "promo-pulse:ai-apply-values",
        handleAiApplyValues,
      );
    };
  }, [updateDesignValues, visibleBuilderTabs]);

  const canReview = visibleBuilderTabs.some((tab) => tab.key === "review");
  const shouldShowBuilderTabs =
    showBuilderTabs && visibleBuilderTabs.length > 1;
  const builderTabId = (key: BuilderTabKey) =>
    idPrefix === "campaign"
      ? `campaign-builder-tab-${key}`
      : scopedId(`builder-tab-${key}`);
  const builderPanelId = (key: BuilderTabKey) =>
    idPrefix === "campaign"
      ? `campaign-builder-panel-${key}`
      : scopedId(`builder-panel-${key}`);

  return (
    <>
      <Form
        data-campaign-form
        ref={formRef}
        id={formId}
        method="post"
        className="counterpulse-create-form"
        onSubmit={confirmOnSubmit ? confirmSubmit.onSubmit : undefined}
      >
        <input name="_action" type="hidden" value={submitAction} />
        <input
          data-ai-suggestion-json
          name="aiSuggestionJson"
          readOnly
          type="hidden"
          value={aiSuggestionJson}
        />
        {designHiddenInputs}

        {errors.form && (
          <AppAlert tone="critical" title="Campaign could not be saved">
            <s-paragraph>{errors.form}</s-paragraph>
          </AppAlert>
        )}

        {showTopbar && (
          <div
            className="counterpulse-create-topbar"
            aria-label="Campaign status"
          >
            <div className="counterpulse-create-status">
              <span>{activeCampaignTypeLabel}</span>
              <span>{activePlacementLabel}</span>
            </div>
            <div className="counterpulse-create-actions">
              {topbarActions}
              <CampaignControlStatusBadge
                label={statusLabel}
                status={formValues.status}
              />
              {canReview && (
                <button
                  className="counterpulse-button-secondary"
                  type="button"
                  onClick={() => setActiveTab("review")}
                >
                  Review
                </button>
              )}
              <button
                className="counterpulse-button"
                data-testid="campaign-save-button"
                type="submit"
              >
                {isSubmitting ? "Saving..." : submitLabel}
              </button>
            </div>
          </div>
        )}

        {shouldShowBuilderTabs && (
          <div
            className="counterpulse-builder-tabs"
            aria-label="Campaign builder"
            role="tablist"
          >
            {visibleBuilderTabs.map((tab) => (
              <button
                aria-controls={builderPanelId(tab.key)}
                aria-selected={activeTab === tab.key}
                className={activeTab === tab.key ? "is-active" : undefined}
                id={builderTabId(tab.key)}
                key={tab.key}
                role="tab"
                type="button"
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div
          className={[
            "counterpulse-create-builder-grid",
            showPreview ? "" : "counterpulse-create-builder-grid--single",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <section className="counterpulse-create-panel">
            <div className="counterpulse-panel-heading">
              <div>
                <p className="counterpulse-kicker">{activeTabMeta.label}</p>
                <h2 id={scopedId("builder-heading")}>{activeTabMeta.title}</h2>
                <p className="counterpulse-panel-description">
                  {activeTabMeta.description}
                </p>
              </div>
              <span className="counterpulse-pill">{activeTabMeta.pill}</span>
            </div>

            <BuilderPanel
              activeTab={activeTab}
              panelId={builderPanelId("setup")}
              shouldRender={visibleBuilderTabSet.has("setup")}
              tabId={builderTabId("setup")}
              tabKey="setup"
            >
              <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                <FormField label="Campaign name" error={errors.name} fullWidth>
                  <input
                    data-testid="campaign-name-input"
                    name="name"
                    value={formValues.name}
                    placeholder="Spring sale - free shipping countdown"
                    onChange={updateField("name")}
                  />
                </FormField>

                <FormField
                  label="Status"
                  error={errors.status}
                  info={
                    <FieldInfoButton label="Status" title="Campaign status">
                      <CampaignInfoContent
                        intro="Status controls whether the campaign can render now or stays hidden while you finish setup."
                        items={[
                          [
                            "Draft",
                            "Saved configuration only. It will not render on the storefront.",
                          ],
                          [
                            "Active",
                            "Eligible to render when schedule, placement, plan, and targeting rules match.",
                          ],
                          [
                            "Paused",
                            "Temporarily hidden without deleting settings or analytics history.",
                          ],
                          [
                            "Expired",
                            "Ended campaign state. Use it when the promotion should remain archived.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
                  <select
                    data-testid="campaign-status-select"
                    name="status"
                    value={formValues.status}
                    onChange={updateField("status")}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormGroup
                  label="Campaign type"
                  error={errors.goal ?? errors.type}
                  fullWidth
                  info={
                    <FieldInfoButton
                      label="Campaign type"
                      title="Campaign types"
                    >
                      <CampaignInfoContent
                        intro="Campaign type defines what Promo Pulse renders and which campaign settings become relevant. Choose one; Promo Pulse keeps the technical goal and rendering type synchronized."
                        items={[
                          [
                            "Flash sale",
                            "A sitewide urgency bar with timer and CTA. Best for short sales or deadline-based announcements.",
                          ],
                          [
                            "Product timer",
                            "A focused countdown near product content when urgency belongs to a product offer.",
                          ],
                          [
                            "Cart rescue",
                            "A cart or drawer timer for checkout urgency and cart rescue flows.",
                          ],
                          [
                            "Free shipping",
                            "A cart progress campaign tied to a real free-shipping threshold.",
                          ],
                          [
                            "Delivery cutoff",
                            "An order-by timer based on cutoff time, timezone, and delivery settings.",
                          ],
                          [
                            "Low stock urgency",
                            "Inventory-aware urgency messaging without fake scarcity claims.",
                          ],
                          [
                            "Product badge",
                            "A compact product or collection badge for merchandising messages.",
                          ],
                          [
                            "Announcement",
                            "A general storefront announcement without a discount or scarcity assumption.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
                  <input name="goal" type="hidden" value={formValues.goal} />
                  <input name="type" type="hidden" value={formValues.type} />
                  <div className="counterpulse-goal-list" role="radiogroup">
                    {campaignTypeChoiceOptions.map((option) => (
                      <button
                        aria-checked={
                          activeCampaignTypeChoiceKey === option.value
                        }
                        className="counterpulse-goal-card"
                        key={option.value}
                        role="radio"
                        type="button"
                        onClick={() => selectCampaignTypeChoice(option)}
                      >
                        <input
                          checked={activeCampaignTypeChoiceKey === option.value}
                          type="radio"
                          name="campaignTypeChoice"
                          value={option.value}
                          onChange={() => selectCampaignTypeChoice(option)}
                        />
                        <span
                          className="counterpulse-goal-card__icon"
                          aria-hidden="true"
                        >
                          {option.icon === "type" ? (
                            <CampaignTypeIcon type={option.type} />
                          ) : (
                            <GoalIcon goal={option.goal} />
                          )}
                        </span>
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </FormGroup>

                {(formValues.type === "FREE_SHIPPING_GOAL" ||
                  formValues.goal === "FREE_SHIPPING") && (
                  <section
                    className="counterpulse-targeting-card counterpulse-free-shipping-setup-card"
                    aria-labelledby={scopedId("free-shipping-setup-heading")}
                  >
                    <div className="counterpulse-targeting-card__header">
                      <h3 id={scopedId("free-shipping-setup-heading")}>
                        Free shipping threshold
                      </h3>
                      <p>
                        Configure the cart subtotal goal used by the storefront
                        progress bar. Optional discount sync creates or links a
                        real Shopify free-shipping code with the same threshold.
                      </p>
                    </div>

                    <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                      <FormField
                        label="Threshold amount"
                        error={errors.freeShippingThresholdAmount}
                      >
                        <input
                          inputMode="decimal"
                          min="0.01"
                          name="freeShippingThresholdAmount"
                          step="0.01"
                          type="number"
                          value={formValues.freeShippingThresholdAmount}
                          onChange={updateField("freeShippingThresholdAmount")}
                        />
                      </FormField>

                      <FormField
                        label="Currency code"
                        error={errors.freeShippingCurrencyCode}
                      >
                        <input
                          maxLength={3}
                          name="freeShippingCurrencyCode"
                          value={formValues.freeShippingCurrencyCode}
                          onChange={updateField("freeShippingCurrencyCode")}
                        />
                      </FormField>

                      <FormField
                        label="Progress style"
                        error={errors.freeShippingProgressStyle}
                      >
                        <select
                          name="freeShippingProgressStyle"
                          value={formValues.freeShippingProgressStyle}
                          onChange={updateField("freeShippingProgressStyle")}
                        >
                          {freeShippingProgressStyleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <div className="counterpulse-toggle">
                        <label className="counterpulse-toggle-label">
                          <input
                            checked={
                              formValues.freeShippingIncludeDiscountedSubtotal
                            }
                            name="freeShippingIncludeDiscountedSubtotal"
                            type="checkbox"
                            onChange={updateCheckboxField(
                              "freeShippingIncludeDiscountedSubtotal",
                            )}
                          />
                          <span>Use discounted subtotal when available</span>
                        </label>
                      </div>

                      <FormField
                        label="Empty cart message"
                        error={errors.freeShippingEmptyCartMessage}
                        fullWidth
                      >
                        <textarea
                          name="freeShippingEmptyCartMessage"
                          rows={2}
                          value={formValues.freeShippingEmptyCartMessage}
                          onChange={updateField("freeShippingEmptyCartMessage")}
                        />
                      </FormField>

                      <FormField
                        label="Unlocked message"
                        error={errors.freeShippingSuccessMessage}
                        fullWidth
                      >
                        <textarea
                          name="freeShippingSuccessMessage"
                          rows={2}
                          value={formValues.freeShippingSuccessMessage}
                          onChange={updateField("freeShippingSuccessMessage")}
                        />
                      </FormField>
                    </div>

                    <div className="counterpulse-free-shipping-discount-box">
                      <label className="counterpulse-toggle-label">
                        <input
                          checked={formValues.freeShippingAutoDiscount}
                          name="freeShippingAutoDiscount"
                          type="checkbox"
                          onChange={toggleFreeShippingAutoDiscount}
                        />
                        <span>
                          Create or link the real Shopify discount code
                        </span>
                      </label>
                      <p>
                        When enabled, saving creates or links a Shopify free
                        shipping code and sets its minimum subtotal to this
                        threshold, so checkout enforces the same rule.
                      </p>

                      {formValues.freeShippingAutoDiscount && (
                        <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                          <FormField
                            label="Discount code"
                            error={errors.freeShippingDiscountCode}
                          >
                            <input
                              name="freeShippingDiscountCode"
                              value={formValues.freeShippingDiscountCode}
                              onChange={updateField("freeShippingDiscountCode")}
                            />
                          </FormField>

                          <FormField
                            label="Discount title"
                            error={errors.freeShippingDiscountTitle}
                          >
                            <input
                              name="freeShippingDiscountTitle"
                              value={formValues.freeShippingDiscountTitle}
                              onChange={updateField(
                                "freeShippingDiscountTitle",
                              )}
                            />
                          </FormField>

                          <div className="counterpulse-toggle">
                            <label className="counterpulse-toggle-label">
                              <input
                                checked={
                                  formValues.freeShippingDiscountAppliesOncePerCustomer
                                }
                                name="freeShippingDiscountAppliesOncePerCustomer"
                                type="checkbox"
                                onChange={updateCheckboxField(
                                  "freeShippingDiscountAppliesOncePerCustomer",
                                )}
                              />
                              <span>Limit to one use per customer</span>
                            </label>
                          </div>

                          <div className="counterpulse-toggle">
                            <label className="counterpulse-toggle-label">
                              <input
                                checked={
                                  formValues.freeShippingShowDiscountCode
                                }
                                name="freeShippingShowDiscountCode"
                                type="checkbox"
                                onChange={updateCheckboxField(
                                  "freeShippingShowDiscountCode",
                                )}
                              />
                              <span>Show discount code on storefront</span>
                            </label>
                            <p className="counterpulse-field-hint">
                              Leave this off when the code should only be kept
                              for Shopify checkout enforcement and not promoted
                              in the storefront banner.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {(formValues.type === "CART_TIMER" ||
                  formValues.goal === "CART_RESCUE") && (
                  <section
                    className="counterpulse-targeting-card counterpulse-free-shipping-setup-card"
                    aria-labelledby={scopedId("cart-rescue-setup-heading")}
                  >
                    <div className="counterpulse-targeting-card__header">
                      <h3 id={scopedId("cart-rescue-setup-heading")}>
                        Cart rescue timer
                      </h3>
                      <p>
                        Configure the per-cart reservation window used in the
                        cart page and drawer.
                      </p>
                    </div>

                    <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                      <FormField
                        label="Reservation minutes"
                        error={errors.cartTimerDurationMinutes}
                      >
                        <input
                          inputMode="numeric"
                          max={10080}
                          min={1}
                          name="cartTimerDurationMinutes"
                          type="number"
                          value={formValues.cartTimerDurationMinutes}
                          onChange={updateField("cartTimerDurationMinutes")}
                        />
                      </FormField>

                      <FormField
                        label="Reset behavior"
                        error={errors.cartTimerResetBehavior}
                      >
                        <select
                          name="cartTimerResetBehavior"
                          value={formValues.cartTimerResetBehavior}
                          onChange={updateField("cartTimerResetBehavior")}
                        >
                          {cartTimerResetBehaviorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                  </section>
                )}

                {(formValues.type === "DELIVERY_CUTOFF" ||
                  formValues.goal === "DELIVERY_CUTOFF") && (
                  <section
                    className="counterpulse-targeting-card counterpulse-free-shipping-setup-card"
                    aria-labelledby={scopedId("delivery-cutoff-setup-heading")}
                  >
                    <div className="counterpulse-targeting-card__header">
                      <h3 id={scopedId("delivery-cutoff-setup-heading")}>
                        Delivery promise
                      </h3>
                      <p>
                        Set the real order-by cutoff and delivery window shown
                        near product content.
                      </p>
                    </div>

                    <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                      <FormField
                        label="Cutoff hour"
                        error={errors.deliveryCutoffHour}
                      >
                        <input
                          inputMode="numeric"
                          max={23}
                          min={0}
                          name="deliveryCutoffHour"
                          type="number"
                          value={formValues.deliveryCutoffHour}
                          onChange={updateField("deliveryCutoffHour")}
                        />
                      </FormField>

                      <FormField
                        label="Cutoff minute"
                        error={errors.deliveryCutoffMinute}
                      >
                        <input
                          inputMode="numeric"
                          max={59}
                          min={0}
                          name="deliveryCutoffMinute"
                          type="number"
                          value={formValues.deliveryCutoffMinute}
                          onChange={updateField("deliveryCutoffMinute")}
                        />
                      </FormField>

                      <FormField
                        label="Processing days"
                        error={errors.deliveryProcessingDays}
                      >
                        <input
                          inputMode="numeric"
                          max={60}
                          min={0}
                          name="deliveryProcessingDays"
                          type="number"
                          value={formValues.deliveryProcessingDays}
                          onChange={updateField("deliveryProcessingDays")}
                        />
                      </FormField>

                      <FormField
                        label="Minimum delivery days"
                        error={errors.deliveryMinDays}
                      >
                        <input
                          inputMode="numeric"
                          max={60}
                          min={0}
                          name="deliveryMinDays"
                          type="number"
                          value={formValues.deliveryMinDays}
                          onChange={updateField("deliveryMinDays")}
                        />
                      </FormField>

                      <FormField
                        label="Maximum delivery days"
                        error={errors.deliveryMaxDays}
                      >
                        <input
                          inputMode="numeric"
                          max={90}
                          min={0}
                          name="deliveryMaxDays"
                          type="number"
                          value={formValues.deliveryMaxDays}
                          onChange={updateField("deliveryMaxDays")}
                        />
                      </FormField>

                      <FormField
                        label="After cutoff"
                        error={errors.deliveryAfterCutoffBehavior}
                      >
                        <select
                          name="deliveryAfterCutoffBehavior"
                          value={formValues.deliveryAfterCutoffBehavior}
                          onChange={updateField("deliveryAfterCutoffBehavior")}
                        >
                          {afterCutoffBehaviorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <FormGroup
                        label="Fulfillment days"
                        error={errors.deliveryWorkingDays}
                        fullWidth
                      >
                        <input
                          name="deliveryWorkingDays"
                          type="hidden"
                          value={formValues.deliveryWorkingDays}
                        />
                        <div className="counterpulse-weekday-list">
                          {deliveryWeekdayOptions.map((day) => (
                            <button
                              aria-pressed={selectedDeliveryWorkingDays.has(
                                day.value,
                              )}
                              className={
                                selectedDeliveryWorkingDays.has(day.value)
                                  ? "counterpulse-weekday-chip is-selected"
                                  : "counterpulse-weekday-chip"
                              }
                              key={day.value}
                              type="button"
                              onClick={() =>
                                toggleDeliveryWorkingDay(day.value)
                              }
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                      </FormGroup>
                    </div>
                  </section>
                )}

                {(formValues.type === "LOW_STOCK" ||
                  formValues.goal === "LOW_STOCK_URGENCY") && (
                  <section
                    className="counterpulse-targeting-card counterpulse-free-shipping-setup-card"
                    aria-labelledby={scopedId("low-stock-setup-heading")}
                  >
                    <div className="counterpulse-targeting-card__header">
                      <h3 id={scopedId("low-stock-setup-heading")}>
                        Low stock rules
                      </h3>
                      <p>
                        Show urgency only when inventory is at or below the
                        selected threshold.
                      </p>
                    </div>

                    <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                      <FormField
                        label="Inventory threshold"
                        error={errors.lowStockThreshold}
                      >
                        <input
                          inputMode="numeric"
                          max={9999}
                          min={1}
                          name="lowStockThreshold"
                          type="number"
                          value={formValues.lowStockThreshold}
                          onChange={updateField("lowStockThreshold")}
                        />
                      </FormField>

                      <div className="counterpulse-toggle">
                        <label className="counterpulse-toggle-label">
                          <input
                            checked={formValues.lowStockShowExactQuantity}
                            name="lowStockShowExactQuantity"
                            type="checkbox"
                            onChange={updateCheckboxField(
                              "lowStockShowExactQuantity",
                            )}
                          />
                          <span>
                            Show exact quantity when Shopify provides it
                          </span>
                        </label>
                      </div>

                      <FormField
                        label="Fallback message"
                        error={errors.lowStockFallbackMessage}
                        fullWidth
                      >
                        <input
                          name="lowStockFallbackMessage"
                          value={formValues.lowStockFallbackMessage}
                          onChange={updateField("lowStockFallbackMessage")}
                        />
                      </FormField>
                    </div>
                  </section>
                )}

                {(formValues.type === "PRODUCT_BADGE" ||
                  formValues.goal === "PRODUCT_BADGE") && (
                  <section
                    className="counterpulse-targeting-card counterpulse-free-shipping-setup-card"
                    aria-labelledby={scopedId("product-badge-setup-heading")}
                  >
                    <div className="counterpulse-targeting-card__header">
                      <h3 id={scopedId("product-badge-setup-heading")}>
                        Product badge
                      </h3>
                      <p>
                        Configure the badge text, shape, and product image
                        corner before deeper merchandising rules are added.
                      </p>
                    </div>

                    <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                      <FormField label="Badge text" error={errors.badgeText}>
                        <input
                          maxLength={48}
                          name="badgeText"
                          value={formValues.badgeText}
                          onChange={updateField("badgeText")}
                        />
                      </FormField>

                      <FormField label="Shape" error={errors.badgeShape}>
                        <select
                          name="badgeShape"
                          value={formValues.badgeShape}
                          onChange={updateField("badgeShape")}
                        >
                          {badgeShapeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <FormField label="Position" error={errors.badgePosition}>
                        <select
                          name="badgePosition"
                          value={formValues.badgePosition}
                          onChange={updateField("badgePosition")}
                        >
                          {badgePositionOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                  </section>
                )}
              </div>
            </BuilderPanel>

            <BuilderPanel
              activeTab={activeTab}
              panelId={builderPanelId("message")}
              shouldRender={visibleBuilderTabSet.has("message")}
              tabId={builderTabId("message")}
              tabKey="message"
            >
              {messageTranslations && messageResolvedTranslations ? (
                <>
                  <CampaignMessageHiddenInputs values={formValues} />
                  <CampaignTranslationsEditor
                    embedded
                    errors={messageTranslationErrors}
                    initialLocale={messageInitialLocale}
                    initialValues={messageTranslations}
                    resolvedValues={messageResolvedTranslations}
                    showActions={false}
                    onActiveLocaleChange={syncMessageFieldsFromTranslations}
                    onValuesChange={syncMessageFieldsFromTranslations}
                  />
                </>
              ) : (
                <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                  <FormField label="Headline" error={errors.headline} fullWidth>
                    <input
                      name="headline"
                      value={formValues.headline}
                      placeholder="Free shipping on orders over $75"
                      onChange={updateField("headline")}
                    />
                  </FormField>

                  <FormField
                    label="Subheadline"
                    error={errors.subheadline}
                    fullWidth
                  >
                    <textarea
                      name="subheadline"
                      value={formValues.subheadline}
                      rows={4}
                      placeholder="Limited time only. Do not miss out."
                      onChange={updateField("subheadline")}
                    />
                  </FormField>

                  <FormField label="CTA text" error={errors.ctaText}>
                    <input
                      name="ctaText"
                      value={formValues.ctaText}
                      placeholder="Shop now"
                      onChange={updateField("ctaText")}
                    />
                  </FormField>

                  <FormField label="CTA URL" error={errors.ctaUrl}>
                    <input
                      name="ctaUrl"
                      value={formValues.ctaUrl}
                      placeholder="/collections/sale"
                      onChange={updateField("ctaUrl")}
                    />
                  </FormField>
                </div>
              )}
              {messageAddon && (
                <div className="counterpulse-message-addon">{messageAddon}</div>
              )}
            </BuilderPanel>

            <BuilderPanel
              activeTab={activeTab}
              panelId={builderPanelId("placement")}
              shouldRender={visibleBuilderTabSet.has("placement")}
              tabId={builderTabId("placement")}
              tabKey="placement"
            >
              <section
                className="counterpulse-targeting-card"
                aria-labelledby={scopedId("placement-heading")}
              >
                <div className="counterpulse-targeting-card__header">
                  <h3 id={scopedId("placement-heading")}>
                    Campaign placements
                  </h3>
                  <p>
                    Select every storefront surface where this campaign should
                    be eligible to render. The first selected placement is used
                    as the default preview surface.
                  </p>
                </div>

                <div className="counterpulse-placement-grid">
                  {placementTypeOptions.map((option) => {
                    const isSelected = formValues.placementTypes.includes(
                      option.value,
                    );

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={
                          isSelected
                            ? "counterpulse-placement-tile is-selected"
                            : "counterpulse-placement-tile"
                        }
                        key={option.value}
                        type="button"
                        onClick={() => togglePlacement(option.value)}
                      >
                        <span
                          aria-hidden="true"
                          className="counterpulse-placement-tile__initial"
                        >
                          {placementInitial(option.label)}
                        </span>
                        <span className="counterpulse-placement-tile__body">
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {formValues.placementTypes.map((placementType) => (
                  <input
                    key={placementType}
                    name="placementTypes"
                    type="hidden"
                    value={placementType}
                  />
                ))}
                <input
                  name="placementType"
                  type="hidden"
                  value={formValues.placementType}
                />
                <FieldError message={errors.placementType} />
              </section>

              {formValues.placementTypes.includes("CUSTOM_SELECTOR") && (
                <section
                  className="counterpulse-targeting-card"
                  aria-labelledby={scopedId("custom-placement-heading")}
                >
                  <div className="counterpulse-targeting-card__header">
                    <h3 id={scopedId("custom-placement-heading")}>
                      Custom HTML slot
                    </h3>
                    <p>
                      Use this when the campaign should render in a specific
                      theme selector or inside the Campaign ID HTML snippet.
                    </p>
                  </div>
                  <div className="counterpulse-placement-custom">
                    <div className="counterpulse-targeting-field">
                      <label htmlFor={scopedId("custom-selector")}>
                        Theme selector
                      </label>
                      <input
                        id={scopedId("custom-selector")}
                        name="customSelector"
                        value={formValues.customSelector}
                        placeholder=".product-form__buttons"
                        onChange={updateField("customSelector")}
                      />
                      <small>
                        Promo Pulse will inject the campaign inside this
                        selector when the app embed is active.
                      </small>
                      <FieldError message={errors.customSelector} />
                    </div>
                  </div>
                </section>
              )}
              {!formValues.placementTypes.includes("CUSTOM_SELECTOR") && (
                <input
                  name="customSelector"
                  type="hidden"
                  value={formValues.customSelector}
                />
              )}

              {formValues.placementTypes.includes("CUSTOM_SELECTOR") && (
                <div className="counterpulse-timer-id-box">
                  <div>
                    <span>Campaign ID</span>
                    <code>{campaignId ?? "Available after save"}</code>
                  </div>
                  <button
                    aria-label="Copy campaign ID"
                    type="button"
                    disabled={!campaignId}
                    onClick={copyTimerId}
                  >
                    <CopyIcon />
                  </button>
                  {timerIdCopied && <small>Copied</small>}
                  <p>
                    Use this ID only for Custom HTML slot placements. Promo
                    Pulse will render this exact campaign where the snippet is
                    present.
                  </p>
                  {campaignEmbedHtml && (
                    <div className="counterpulse-snippet-box">
                      <span>HTML snippet</span>
                      <code>{campaignEmbedHtml}</code>
                      <button type="button" onClick={copyEmbedHtml}>
                        Copy HTML
                      </button>
                      {embedHtmlCopied && <small>HTML copied</small>}
                    </div>
                  )}
                </div>
              )}
            </BuilderPanel>

            <BuilderPanel
              activeTab={activeTab}
              panelId={builderPanelId("targeting")}
              shouldRender={visibleBuilderTabSet.has("targeting")}
              tabId={builderTabId("targeting")}
              tabKey="targeting"
            >
              <div className="counterpulse-targeting-grid">
                {pickerError && (
                  <div className="counterpulse-targeting-warning">
                    {pickerError}
                  </div>
                )}
                <section
                  className="counterpulse-targeting-card"
                  aria-labelledby={scopedId("products-heading")}
                >
                  <div className="counterpulse-targeting-card__header">
                    <h3 id={scopedId("products-heading")}>
                      Product eligibility
                    </h3>
                  </div>

                  <TargetingRadioOption
                    checked={formValues.productSelection === "ALL_PRODUCTS"}
                    disabled={false}
                    name="productSelection"
                    title="All products"
                    value="ALL_PRODUCTS"
                    onSelect={() => selectProductSelection("ALL_PRODUCTS")}
                  >
                    <button
                      className="counterpulse-link-button"
                      type="button"
                      disabled={Boolean(
                        advancedTargetingLocked &&
                        formValues.excludeProductIds.trim().length === 0,
                      )}
                      onClick={() => setShowProductExclusions(true)}
                    >
                      Exclude specific products
                    </button>
                    {advancedTargetingLocked &&
                      formValues.excludeProductIds.trim().length === 0 && (
                        <UpgradeText reason={advancedTargetingLocked} />
                      )}
                    {showProductExclusions ? (
                      <ResourcePickerField
                        chips={resourceChipsFor("excludeProductIds")}
                        disabled={Boolean(advancedTargetingLocked)}
                        error={errors.excludeProductIds}
                        label="Excluded products"
                        name="excludeProductIds"
                        pickerLabel="Select products to exclude"
                        value={formValues.excludeProductIds}
                        onManualChange={setManualListField("excludeProductIds")}
                        onOpenPicker={() =>
                          openResourcePicker("product", "excludeProductIds")
                        }
                        onRemove={(id) =>
                          removeResourceChip("excludeProductIds", id)
                        }
                      />
                    ) : (
                      <input
                        type="hidden"
                        name="excludeProductIds"
                        value={formValues.excludeProductIds}
                      />
                    )}
                  </TargetingRadioOption>

                  <TargetingRadioOption
                    checked={
                      formValues.productSelection === "SPECIFIC_PRODUCTS"
                    }
                    disabled={Boolean(
                      basicTargetingLocked &&
                      formValues.productSelection !== "SPECIFIC_PRODUCTS",
                    )}
                    lockReason={basicTargetingLocked}
                    name="productSelection"
                    title="Specific products"
                    value="SPECIFIC_PRODUCTS"
                    onSelect={() => selectProductSelection("SPECIFIC_PRODUCTS")}
                  >
                    <ResourcePickerField
                      chips={resourceChipsFor("productIds")}
                      error={errors.productIds}
                      label="Included products"
                      name="productIds"
                      pickerLabel="Select products"
                      value={formValues.productIds}
                      onManualChange={setManualListField("productIds")}
                      onOpenPicker={() =>
                        openResourcePicker("product", "productIds")
                      }
                      onRemove={(id) => removeResourceChip("productIds", id)}
                    />
                  </TargetingRadioOption>

                  <TargetingRadioOption
                    checked={formValues.productSelection === "COLLECTIONS"}
                    disabled={Boolean(
                      basicTargetingLocked &&
                      formValues.productSelection !== "COLLECTIONS",
                    )}
                    lockReason={basicTargetingLocked}
                    name="productSelection"
                    title="All products in specific collections"
                    value="COLLECTIONS"
                    onSelect={() => selectProductSelection("COLLECTIONS")}
                  >
                    <ResourcePickerField
                      chips={resourceChipsFor("collectionIds")}
                      error={errors.collectionIds}
                      label="Included collections"
                      name="collectionIds"
                      pickerLabel="Select collections"
                      value={formValues.collectionIds}
                      onManualChange={setManualListField("collectionIds")}
                      onOpenPicker={() =>
                        openResourcePicker("collection", "collectionIds")
                      }
                      onRemove={(id) => removeResourceChip("collectionIds", id)}
                    />
                  </TargetingRadioOption>

                  <TargetingRadioOption
                    checked={formValues.productSelection === "TAGS"}
                    disabled={Boolean(
                      basicTargetingLocked &&
                      formValues.productSelection !== "TAGS",
                    )}
                    lockReason={basicTargetingLocked}
                    name="productSelection"
                    title="All products with specific tags"
                    value="TAGS"
                    onSelect={() => selectProductSelection("TAGS")}
                  >
                    <TagSelectorField
                      error={errors.productTags}
                      searchId={scopedId("product-tag-search")}
                      matchingTags={matchingProductTags}
                      query={tagQuery}
                      selectedTags={selectedProductTags}
                      onAddTag={addProductTag}
                      onManualChange={setManualListField("productTags")}
                      onQueryChange={setTagQuery}
                      onRemoveTag={removeProductTag}
                      onSelectFirst={selectFirstMatchingTag}
                      value={formValues.productTags}
                    />
                  </TargetingRadioOption>
                </section>

                <section
                  className="counterpulse-targeting-card counterpulse-targeting-card--wide"
                  aria-labelledby={scopedId("url-targeting-heading")}
                >
                  <div className="counterpulse-targeting-card__header">
                    <h3 id={scopedId("url-targeting-heading")}>
                      URL eligibility
                    </h3>
                    <p>
                      Limit this campaign to storefront paths or exclude paths
                      where it should never render. Add one path or full URL per
                      line.
                    </p>
                  </div>
                  <div className="counterpulse-url-targeting-grid">
                    <FormField
                      label="Show only on URLs containing"
                      error={errors.urlContains}
                    >
                      <textarea
                        name="urlContains"
                        rows={4}
                        placeholder={"/products/summer-hat\n/collections/sale"}
                        value={formValues.urlContains ?? ""}
                        onChange={setManualListField("urlContains")}
                      />
                    </FormField>
                    <FormField
                      label="Exclude URLs containing"
                      error={errors.excludedUrlContains}
                    >
                      <textarea
                        name="excludedUrlContains"
                        rows={4}
                        placeholder={"/pages/wholesale\n?preview_theme_id="}
                        value={formValues.excludedUrlContains ?? ""}
                        onChange={setManualListField("excludedUrlContains")}
                      />
                    </FormField>
                  </div>
                </section>

                <section
                  className="counterpulse-targeting-card"
                  aria-labelledby={scopedId("geolocation-heading")}
                >
                  <div className="counterpulse-targeting-card__header">
                    <h3 id={scopedId("geolocation-heading")}>
                      Geolocation targeting
                    </h3>
                  </div>

                  <TargetingRadioOption
                    checked={formValues.countrySelection === "ALL_WORLD"}
                    description="Eligible worldwide unless another timer excludes the current context."
                    disabled={false}
                    name="countrySelection"
                    title="All world"
                    value="ALL_WORLD"
                    onSelect={() => selectCountrySelection("ALL_WORLD")}
                  />

                  <TargetingRadioOption
                    checked={
                      formValues.countrySelection === "SPECIFIC_COUNTRIES"
                    }
                    disabled={Boolean(
                      geoTargetingLocked &&
                      formValues.countrySelection !== "SPECIFIC_COUNTRIES",
                    )}
                    lockReason={geoTargetingLocked}
                    name="countrySelection"
                    title="Specific countries"
                    value="SPECIFIC_COUNTRIES"
                    onSelect={() =>
                      selectCountrySelection("SPECIFIC_COUNTRIES")
                    }
                  >
                    <CountrySelectorField
                      countries={matchingCountries}
                      countryLabelsByCode={countryLabelsByCode}
                      error={errors.countries}
                      query={countryQuery}
                      searchId={scopedId("country-search")}
                      selectedCountries={selectedCountries}
                      value={formValues.countries}
                      onAddCountry={addCountry}
                      onManualChange={setManualListField("countries")}
                      onQueryChange={setCountryQuery}
                      onRemoveCountry={removeCountry}
                      onSelectFirst={selectFirstMatchingCountry}
                    />
                  </TargetingRadioOption>
                </section>
              </div>
            </BuilderPanel>

            <BuilderPanel
              activeTab={activeTab}
              panelId={builderPanelId("schedule")}
              shouldRender={visibleBuilderTabSet.has("schedule")}
              tabId={builderTabId("schedule")}
              tabKey="schedule"
            >
              <div className="counterpulse-schedule-stack">
                <section className="counterpulse-targeting-card counterpulse-schedule-card">
                  <div className="counterpulse-targeting-card__header">
                    <h3>Timer Type</h3>
                  </div>

                  <div className="counterpulse-radio-stack counterpulse-schedule-card__group">
                    {timerModeOptions.map((option) => {
                      const lockReason =
                        option.disabledFeature === "recurringTimers"
                          ? recurringTimersLocked
                          : "";

                      return (
                        <label
                          className={[
                            "counterpulse-radio counterpulse-radio--stacked",
                            lockReason ? "is-disabled" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={option.value}
                        >
                          <input
                            checked={formValues.timerMode === option.value}
                            disabled={Boolean(lockReason)}
                            name="timerMode"
                            type="radio"
                            value={option.value}
                            onChange={() => selectTimerMode(option.value)}
                          />
                          <span>
                            <strong>{option.label}</strong>
                            <small>{option.description}</small>
                            {lockReason && <UpgradeText reason={lockReason} />}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <input
                    name="timerMode"
                    type="hidden"
                    value={formValues.timerMode}
                  />
                  <input
                    name="timerResetBehavior"
                    type="hidden"
                    value={formValues.timerResetBehavior}
                  />

                  {formValues.timerMode === "EVERGREEN_SESSION" ? (
                    <FormField
                      label="Minutes"
                      error={
                        isCartRescueCampaign
                          ? errors.cartTimerDurationMinutes
                          : errors.timerDurationMinutes
                      }
                      fullWidth
                    >
                      <input
                        inputMode="numeric"
                        min={1}
                        max={10080}
                        name={
                          isCartRescueCampaign
                            ? "cartTimerDurationMinutes"
                            : "timerDurationMinutes"
                        }
                        type="number"
                        value={
                          isCartRescueCampaign
                            ? formValues.cartTimerDurationMinutes
                            : formValues.timerDurationMinutes
                        }
                        onChange={
                          isCartRescueCampaign
                            ? updateField("cartTimerDurationMinutes")
                            : updateField("timerDurationMinutes")
                        }
                      />
                      {isCartRescueCampaign && (
                        <input
                          name="timerDurationMinutes"
                          type="hidden"
                          value={formValues.timerDurationMinutes}
                        />
                      )}
                    </FormField>
                  ) : (
                    <input
                      name="timerDurationMinutes"
                      type="hidden"
                      value={formValues.timerDurationMinutes}
                    />
                  )}

                  {formValues.timerMode === "RECURRING_DAILY" ? (
                    <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                      <FormField
                        label="Daily cutoff hour"
                        error={errors.timerRecurringHour}
                      >
                        <input
                          inputMode="numeric"
                          max={23}
                          min={0}
                          name="timerRecurringHour"
                          type="number"
                          value={formValues.timerRecurringHour}
                          onChange={updateField("timerRecurringHour")}
                        />
                      </FormField>
                      <FormField label="Minute">
                        <input
                          inputMode="numeric"
                          max={59}
                          min={0}
                          name="timerRecurringMinute"
                          type="number"
                          value={formValues.timerRecurringMinute}
                          onChange={updateField("timerRecurringMinute")}
                        />
                      </FormField>
                    </div>
                  ) : (
                    <>
                      <input
                        name="timerRecurringHour"
                        type="hidden"
                        value={formValues.timerRecurringHour}
                      />
                      <input
                        name="timerRecurringMinute"
                        type="hidden"
                        value={formValues.timerRecurringMinute}
                      />
                    </>
                  )}

                  {formValues.timerMode === "FIXED_DATE" ? (
                    <>
                      <div className="counterpulse-schedule-card__group counterpulse-schedule-start-options">
                        <label className="counterpulse-radio counterpulse-radio--stacked">
                          <input
                            aria-label="Right now"
                            checked={!formValues.startsAt}
                            name="timerStartsMode"
                            type="radio"
                            value="NOW"
                            onChange={() => selectTimerStart("NOW")}
                          />
                          <span>
                            <strong>Right now</strong>
                          </span>
                        </label>
                        <label
                          className={[
                            "counterpulse-radio counterpulse-radio--stacked",
                            schedulingLocked ? "is-disabled" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <input
                            aria-label="Schedule to start later"
                            checked={Boolean(formValues.startsAt)}
                            disabled={Boolean(schedulingLocked)}
                            name="timerStartsMode"
                            type="radio"
                            value="SCHEDULED"
                            onChange={() => selectTimerStart("SCHEDULED")}
                          />
                          <span>
                            <strong>Schedule to start later</strong>
                            {schedulingLocked && (
                              <UpgradeText reason={schedulingLocked} />
                            )}
                          </span>
                        </label>
                      </div>

                      {formValues.startsAt ? (
                        <FormField
                          label="Start date/time"
                          error={errors.startsAt}
                          fullWidth
                        >
                          <input
                            type="datetime-local"
                            name="startsAt"
                            value={formValues.startsAt}
                            onChange={updateField("startsAt")}
                          />
                        </FormField>
                      ) : (
                        <input name="startsAt" type="hidden" value="" />
                      )}

                      <FormField
                        label="End date"
                        error={errors.endsAt}
                        fullWidth
                      >
                        <input
                          type="datetime-local"
                          name="endsAt"
                          value={formValues.endsAt}
                          onChange={updateField("endsAt")}
                        />
                      </FormField>
                    </>
                  ) : (
                    <>
                      <input
                        name="startsAt"
                        type="hidden"
                        value={formValues.startsAt}
                      />
                      <input
                        name="endsAt"
                        type="hidden"
                        value={formValues.endsAt}
                      />
                    </>
                  )}

                  <FormField
                    label="Once it ends"
                    error={errors.timerExpiredBehavior}
                    fullWidth
                  >
                    <select
                      name="timerExpiredBehavior"
                      value={formValues.timerExpiredBehavior}
                      onChange={(event) =>
                        setFormValues((currentValues) => ({
                          ...currentValues,
                          timerExpiredBehavior: event.currentTarget
                            .value as CampaignTimerExpiredBehaviorValue,
                        }))
                      }
                    >
                      {timerExpiredBehaviorOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  {formValues.timerExpiredBehavior === "SHOW_CUSTOM_TITLE" ? (
                    <FormField
                      label="Custom title"
                      error={errors.expiredText}
                      fullWidth
                    >
                      <input
                        name="expiredText"
                        value={formValues.expiredText}
                        placeholder="This offer has ended."
                        onChange={updateField("expiredText")}
                      />
                    </FormField>
                  ) : (
                    <input
                      name="expiredText"
                      type="hidden"
                      value={formValues.expiredText}
                    />
                  )}
                </section>

                <TimezoneCombobox
                  error={errors.timezone}
                  info={
                    <FieldInfoButton
                      label="Timezone"
                      title="Timezone used by campaign timers"
                    >
                      <CampaignInfoContent
                        intro="Timezone controls scheduled starts, fixed end dates, daily recurring cutoffs, and delivery promises."
                        items={[
                          [
                            "UTC offset first",
                            "The selector is ordered by UTC offset and shows one representative region per offset.",
                          ],
                          [
                            "Why it matters",
                            "A timer promising a real deadline should use the same timezone as the offer or fulfillment operation.",
                          ],
                          [
                            "Existing saved zones",
                            "If a campaign already uses a more specific IANA zone, it is preserved until you choose another option.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                  label="Timezone"
                  name="timezone"
                  className="counterpulse-schedule-card__field"
                  value={formValues.timezone}
                  onChange={(timezone) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      timezone,
                    }))
                  }
                />
              </div>
            </BuilderPanel>

            <BuilderPanel
              activeTab={activeTab}
              panelId={builderPanelId("review")}
              shouldRender={visibleBuilderTabSet.has("review")}
              tabId={builderTabId("review")}
              tabKey="review"
            >
              <TabSummaryGrid rows={summaryRows} />
              <div className="counterpulse-validation-strip">
                {[
                  ["No fake scarcity", "Copy must match real offer data."],
                  ["Discount synced", "Use real discount rules after save."],
                  ["Timer matches offer", "Countdown should mirror schedule."],
                  ["Consent-safe tracking", "No PII in visitor tracking."],
                ].map(([title, description]) => (
                  <div className="counterpulse-validation-item" key={title}>
                    <span>OK</span>
                    <div>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </div>
                  </div>
                ))}
              </div>
            </BuilderPanel>
          </section>

          {showPreview && (
            <aside
              className="counterpulse-create-side-panel"
              aria-label="Live campaign preview"
            >
              <CampaignPreviewPanel
                actualPlacements={previewPlacements}
                className="counterpulse-campaign-preview-panel"
                design={effectiveDesign}
                device={previewDevice}
                mobileDesign={effectiveMobileDesign}
                placement={campaignPreviewPlacement}
                viewModel={previewViewModel}
                onDeviceChange={setPreviewDevice}
                onPlacementChange={selectCampaignPreviewPlacement}
                meta={
                  <dl className="counterpulse-preview-meta">
                    <div>
                      <dt>Campaign type</dt>
                      <dd>{activeCampaignTypeLabel}</dd>
                    </div>
                    <div>
                      <dt>Placement</dt>
                      <dd>{activePlacementLabel}</dd>
                    </div>
                  </dl>
                }
              />
            </aside>
          )}
        </div>
      </Form>
      {confirmOnSubmit ? confirmSubmit.modal : null}
    </>
  );
}

function applySetupPreset(
  values: CampaignFormValues,
  preset: CampaignSetupPreset,
): CampaignFormValues {
  const productSelection = preset.productSelection ?? values.productSelection;

  return {
    ...values,
    ...preset.form,
    ...(preset.goal ? { goal: preset.goal } : {}),
    ...(preset.type ? { type: preset.type } : {}),
    startsAt:
      preset.form?.timerMode && preset.form.timerMode !== "FIXED_DATE"
        ? ""
        : (preset.form?.startsAt ?? values.startsAt),
    endsAt:
      preset.form?.timerMode && preset.form.timerMode !== "FIXED_DATE"
        ? ""
        : (preset.form?.endsAt ?? values.endsAt),
    placementType: preset.placementType,
    placementTypes: [preset.placementType],
    productSelection,
  };
}

function applyDesignSetupPreset(
  values: CampaignDesignValues,
  preset: CampaignSetupPreset["design"],
): CampaignDesignValues {
  if (!preset) return values;

  const nextValues = {
    ...values,
    ...preset,
  };

  if (preset.icon && preset.icon !== "CUSTOM") {
    nextValues.customIconUrl = "";
  }

  return nextValues;
}

function getCampaignTypeChoiceKey(values: CampaignFormValues) {
  if (values.type === "PRODUCT_TIMER") return "PRODUCT_TIMER";
  if (values.goal === "ANNOUNCEMENT") return "ANNOUNCEMENT";

  return values.goal;
}

function BuilderPanel({
  activeTab,
  children,
  panelId,
  shouldRender,
  tabId,
  tabKey,
}: {
  activeTab: BuilderTabKey;
  children: ReactNode;
  panelId: string;
  shouldRender: boolean;
  tabId: string;
  tabKey: BuilderTabKey;
}) {
  return (
    <div
      aria-labelledby={tabId}
      className="counterpulse-builder-panel"
      hidden={activeTab !== tabKey || !shouldRender}
      id={panelId}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

function TabSummaryGrid({ rows }: { rows: string[][] }) {
  return (
    <dl className="counterpulse-tab-summary">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TargetingRadioOption({
  checked,
  children,
  description,
  disabled,
  lockReason,
  name,
  onSelect,
  title,
  value,
}: {
  checked: boolean;
  children?: ReactNode;
  description?: string;
  disabled: boolean;
  lockReason?: string;
  name: "productSelection" | "countrySelection";
  onSelect: () => void;
  title: string;
  value: string;
}) {
  const lockedMessage = disabled ? (lockReason ?? "") : "";

  return (
    <div
      className={[
        "counterpulse-targeting-option",
        checked ? "is-selected" : "",
        disabled ? "is-disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label>
        <input
          checked={checked}
          disabled={disabled}
          name={name}
          type="radio"
          value={value}
          onChange={onSelect}
        />
        <span>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
          {lockedMessage && <UpgradeText reason={lockedMessage} />}
        </span>
      </label>
      {checked && children && (
        <div className="counterpulse-targeting-option__content">{children}</div>
      )}
    </div>
  );
}

function ResourcePickerField({
  chips,
  disabled = false,
  error,
  label,
  name,
  onManualChange,
  onOpenPicker,
  onRemove,
  pickerLabel,
  value,
}: {
  chips: ResourceChip[];
  disabled?: boolean;
  error?: string;
  label: string;
  name: ResourceFieldName;
  onManualChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onOpenPicker: () => void;
  onRemove: (id: string) => void;
  pickerLabel: string;
  value: string;
}) {
  return (
    <div className="counterpulse-targeting-field">
      <input name={name} type="hidden" value={value} />
      <span>{label}</span>
      <button
        className="counterpulse-picker-button"
        type="button"
        disabled={disabled}
        onClick={onOpenPicker}
      >
        {pickerLabel}
      </button>
      <ChipList
        chips={chips}
        emptyLabel="No items selected"
        onRemove={onRemove}
      />
      <details className="counterpulse-manual-entry">
        <summary>Paste IDs manually</summary>
        <textarea
          rows={3}
          value={value}
          placeholder="gid://shopify/Product/123456789"
          onChange={onManualChange}
        />
      </details>
      <FieldError message={error} />
    </div>
  );
}

function TagSelectorField({
  error,
  matchingTags,
  onAddTag,
  onManualChange,
  onQueryChange,
  onRemoveTag,
  onSelectFirst,
  query,
  searchId,
  selectedTags,
  value,
}: {
  error?: string;
  matchingTags: string[];
  onAddTag: (tag: string) => void;
  onManualChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onQueryChange: (value: string) => void;
  onRemoveTag: (tag: string) => void;
  onSelectFirst: (event: KeyboardEvent<HTMLInputElement>) => void;
  query: string;
  searchId: string;
  selectedTags: string[];
  value: string;
}) {
  return (
    <div className="counterpulse-targeting-field">
      <input name="productTags" type="hidden" value={value} />
      <label htmlFor={searchId}>Product tags</label>
      <div className="counterpulse-combo-field">
        <input
          id={searchId}
          value={query}
          placeholder="Search product tags"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={onSelectFirst}
        />
        {query.trim() && (
          <div className="counterpulse-combo-results">
            {matchingTags.length > 0 ? (
              matchingTags.map((tag) => (
                <button key={tag} type="button" onClick={() => onAddTag(tag)}>
                  {tag}
                </button>
              ))
            ) : (
              <span>No matching tags from Shopify</span>
            )}
          </div>
        )}
      </div>
      <ChipList
        chips={selectedTags.map((tag) => ({ id: tag, label: tag }))}
        emptyLabel="No tags selected"
        onRemove={onRemoveTag}
      />
      <details className="counterpulse-manual-entry">
        <summary>Paste tags manually</summary>
        <textarea
          rows={3}
          value={value}
          placeholder="sale, limited, preorder"
          onChange={onManualChange}
        />
      </details>
      <FieldError message={error} />
    </div>
  );
}

function CountrySelectorField({
  countries,
  countryLabelsByCode,
  error,
  onAddCountry,
  onManualChange,
  onQueryChange,
  onRemoveCountry,
  onSelectFirst,
  query,
  searchId,
  selectedCountries,
  value,
}: {
  countries: CampaignTargetingOptions["countries"];
  countryLabelsByCode: Map<string, string>;
  error?: string;
  onAddCountry: (code: string) => void;
  onManualChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onQueryChange: (value: string) => void;
  onRemoveCountry: (code: string) => void;
  onSelectFirst: (event: KeyboardEvent<HTMLInputElement>) => void;
  query: string;
  searchId: string;
  selectedCountries: string[];
  value: string;
}) {
  return (
    <div className="counterpulse-targeting-field">
      <input name="countries" type="hidden" value={value} />
      <label htmlFor={searchId}>Countries</label>
      <div className="counterpulse-combo-field">
        <input
          id={searchId}
          value={query}
          placeholder="Search Shopify countries"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={onSelectFirst}
        />
        {query.trim() && (
          <div className="counterpulse-combo-results">
            {countries.length > 0 ? (
              countries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => onAddCountry(country.code)}
                >
                  {country.name} <span>{country.code}</span>
                </button>
              ))
            ) : (
              <span>No matching countries from Shopify</span>
            )}
          </div>
        )}
      </div>
      <ChipList
        chips={selectedCountries.map((code) => ({
          id: code,
          label: countryLabelsByCode.get(code)
            ? `${countryLabelsByCode.get(code)} (${code})`
            : code,
        }))}
        emptyLabel="No countries selected"
        onRemove={onRemoveCountry}
      />
      <details className="counterpulse-manual-entry">
        <summary>Paste country codes manually</summary>
        <textarea
          rows={3}
          value={value}
          placeholder="US, CA, GB"
          onChange={onManualChange}
        />
      </details>
      <FieldError message={error} />
    </div>
  );
}

function ChipList({
  chips,
  emptyLabel,
  onRemove,
}: {
  chips: ResourceChip[];
  emptyLabel: string;
  onRemove: (id: string) => void;
}) {
  if (chips.length === 0) {
    return <small>{emptyLabel}</small>;
  }

  return (
    <div className="counterpulse-chip-list">
      {chips.map((chip) => (
        <span className="counterpulse-chip" key={chip.id}>
          {chip.label}
          <button
            aria-label={`Remove ${chip.label}`}
            type="button"
            onClick={() => onRemove(chip.id)}
          >
            x
          </button>
        </span>
      ))}
    </div>
  );
}

function UpgradeText({ reason }: { reason: string }) {
  return (
    <small className="counterpulse-upgrade-inline">
      {reason} <a href="/app/billing">Upgrade</a>
    </small>
  );
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <rect
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        width="13"
        x="8"
        y="8"
      />
      <path
        d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CampaignInfoContent({
  intro,
  items,
}: {
  intro: string;
  items: Array<[string, string]>;
}) {
  return (
    <div className="counterpulse-info-copy">
      <p>{intro}</p>
      <ul className="counterpulse-info-list">
        {items.map(([title, description]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GoalIcon({ goal }: { goal: CampaignFormValues["goal"] }) {
  const title = goalIconLabels[goal];

  return (
    <svg
      aria-label={title}
      fill="none"
      height="22"
      role="img"
      viewBox="0 0 24 24"
      width="22"
    >
      {goal === "FLASH_SALE" && (
        <path
          d="M13 2 5 13h6l-1 9 9-13h-6l1-7Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "FREE_SHIPPING" && (
        <>
          <path
            d="M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
      {goal === "CART_RESCUE" && (
        <path
          d="M5 5h2l2 10h8l2-7H8m3 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm6 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4 12l-2 2 2 2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "DELIVERY_CUTOFF" && (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 7v5l3 2"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {goal === "LOW_STOCK_URGENCY" && (
        <path
          d="M12 3 3 20h18L12 3Zm0 6v5m0 3h.01"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "PRODUCT_BADGE" && (
        <path
          d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M8 8h8v8H8V8Zm2.5 4h3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "ANNOUNCEMENT" && (
        <path
          d="M4 10v4h4l8 4V6l-8 4H4Zm12 0 4-2v8l-4-2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

function CampaignTypeIcon({ type }: { type: CampaignTypeValue }) {
  const title =
    campaignTypeOptions.find((option) => option.value === type)?.label ?? type;

  return (
    <svg
      aria-label={title}
      fill="none"
      height="22"
      role="img"
      viewBox="0 0 24 24"
      width="22"
    >
      {type === "COUNTDOWN_BAR" && (
        <>
          <path
            d="M4 7h16v10H4z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M9 12h6M17 12h.01"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {type === "PRODUCT_TIMER" && (
        <>
          <path
            d="M5 6h6l8 8-6 6-8-8V6Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <circle cx="9" cy="10" r="1.3" fill="currentColor" />
          <path
            d="M14 11v3l2 1"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {type === "CART_TIMER" && (
        <>
          <path
            d="M5 5h2l2 10h8l2-7H8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M12 9v3l2 1M11 19h.01M17 19h.01"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {type === "FREE_SHIPPING_GOAL" && (
        <>
          <path
            d="M3 8h10v8H3V8Zm10 3h4l3 3v2h-7v-5Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M6 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
      {type === "DELIVERY_CUTOFF" && (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 7v5l4 2"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {type === "LOW_STOCK" && (
        <>
          <path
            d="M5 8h14v11H5zM8 5h8l1 3H7l1-3Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M9 13h6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {type === "PRODUCT_BADGE" && (
        <path
          d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M8 8h8v8H8V8Zm2.5 4h3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

function placementInitial(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatPlacementSelectionLabel(placements: PlacementTypeValue[]) {
  const labels = placements.map(
    (placement) =>
      placementTypeOptions.find((option) => option.value === placement)
        ?.label ?? placement,
  );

  return labels.length > 0 ? labels.join(" + ") : "No placement";
}

function toPreviewPlacement(
  placementType: CampaignFormValues["placementType"],
): PreviewPlacement {
  if (placementType === "BOTTOM_BAR") return "BOTTOM_BAR";
  if (placementType === "PRODUCT_PAGE") return "PRODUCT_PAGE";
  if (placementType === "CART_PAGE") return "CART_PAGE";
  if (placementType === "CART_DRAWER") return "CART_DRAWER";
  if (placementType === "PRODUCT_PAGE_BADGE") return "PRODUCT_BADGE";
  if (placementType === "COLLECTION_CARD") return "PRODUCT_BADGE";
  if (placementType === "CUSTOM_SELECTOR") return "PRODUCT_PAGE";

  return "TOP_BAR";
}

function formatDateTimeLabel(value: string, fallback: string) {
  return value ? value.replace("T", " ") : fallback;
}

function toDateTimeLocalInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function buildResourceChips(value: string): ResourceChip[] {
  return splitCampaignList(value).map((id) => ({
    id,
    label: shortResourceId(id),
  }));
}

function shortResourceId(value: string | undefined) {
  if (!value) return "";
  const parts = value.split("/").filter(Boolean);

  return parts[parts.length - 1] ?? value;
}

function isSelectableResourceId(type: ShopifyResourcePickerType, id: string) {
  const resourceType = type === "product" ? "Product" : "Collection";

  return id.includes(`/shopify/${resourceType}/`);
}

function normalizeSelectableResourceId(
  type: ShopifyResourcePickerType,
  id: string | undefined,
) {
  if (!id || !isSelectableResourceId(type, id)) return "";

  return id;
}

function getShopifyBridge() {
  return (
    window as Window & {
      shopify?: {
        resourcePicker?: (options: {
          action?: "add" | "select";
          filter?: {
            variants?: boolean;
          };
          multiple?: boolean | number;
          selectionIds?: Array<{ id: string }>;
          type: ShopifyResourcePickerType;
        }) => Promise<ShopifyResourcePickerResult | undefined>;
      };
    }
  ).shopify;
}

function CampaignMessageHiddenInputs({
  values,
}: {
  values: CampaignFormValues;
}) {
  return (
    <>
      <input name="headline" type="hidden" value={values.headline} />
      <input name="subheadline" type="hidden" value={values.subheadline} />
      <input name="ctaText" type="hidden" value={values.ctaText} />
      <input name="ctaUrl" type="hidden" value={values.ctaUrl} />
      <input name="expiredText" type="hidden" value={values.expiredText} />
    </>
  );
}

function FormField({
  label,
  error,
  children,
  info,
  fullWidth = false,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  info?: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={
        fullWidth
          ? "counterpulse-form-field counterpulse-form-field--full"
          : "counterpulse-form-field"
      }
    >
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      <label className="counterpulse-field-control">
        <span className="counterpulse-sr-only">{label}</span>
        {children}
      </label>
      <FieldError message={error} />
    </div>
  );
}

function FormGroup({
  label,
  error,
  children,
  info,
  fullWidth = false,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  info?: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={
        fullWidth
          ? "counterpulse-form-field counterpulse-form-field--full"
          : "counterpulse-form-field"
      }
    >
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <span className="counterpulse-form-error">{message}</span>;
}
