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
  buildCampaignCartRescueSettingsValues,
  buildCampaignDeliveryCutoffSettingsValues,
  buildCampaignFreeShippingSettingsValues,
  buildCampaignLowStockSettingsValues,
  buildCampaignTimerSettingsValues,
  defaultCampaignFormValues,
  emptyCampaignTargetingOptions,
  parseDeliveryWorkingDays,
  splitCampaignList,
} from "../types/campaign-form";
import { badgePositionOptions, badgeShapeOptions } from "../types/badge";
import { afterCutoffBehaviorOptions } from "../types/delivery-cutoff";
import { freeShippingProgressStyleOptions } from "../types/free-shipping";
import {
  cartRescueReasonCopyDefaults,
  cartRescueReasonOptions,
  cartRescueTimerStartOptions,
  type CartRescueReasonValue,
  type CartRescueTimerStartValue,
} from "../types/cart-rescue";
import {
  campaignTranslationFields,
  getStorefrontLocaleLabel,
  getStorefrontLocaleOptions,
  translationInputName,
  type CampaignTranslationFormErrors,
  type CampaignTranslationsByLocale,
  type StorefrontLocale,
  type StorefrontLocaleOption,
} from "../types/localization";
import { getDefaultCampaignTranslationValues } from "../utils/campaign-localization";
import { buildCampaignViewModel } from "../utils/campaign-view-model";
import type { StructureNode } from "../utils/campaign-structure";
import { applyCampaignTypeDefaultTextValues } from "../utils/campaign-type-text-defaults";
import { deriveMobileDesignFromDesktop } from "../utils/responsive-design";

type CampaignFormProps = {
  campaignId?: string;
  confirmOnSubmit?: boolean;
  design?: CampaignDesignValues;
  designHiddenInputs?: ReactNode;
  mobileDesign?: CampaignDesignValues;
  // Saved structural HTML/CSS override so this preview renders the exact same
  // generated HTML the storefront uses (matches the Design tab preview).
  structureTree?: StructureNode | null;
  structureCss?: string;
  values: CampaignFormValues;
  errors?: CampaignFormErrors;
  formId?: string;
  hiddenBuilderTabs?: BuilderTabKey[];
  hasSaveBarChanges?: boolean;
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
  messageLocales?: readonly string[];
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
type UrlTargetingFieldName = "urlContains" | "excludedUrlContains";
type UrlEligibilityMode = "include" | "exclude";
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

const urlPageTargetingOptions = [
  {
    token: "page:home",
    label: "Home page",
    description: "Only the storefront root URL.",
    example: "/",
  },
  {
    token: "page:product",
    label: "Product pages",
    description: "Product detail pages, including collection product URLs.",
    example: "/products/...",
  },
  {
    token: "page:collection",
    label: "Collection pages",
    description: "Individual collection listing pages.",
    example: "/collections/summer",
  },
  {
    token: "page:collections",
    label: "All collections page",
    description: "The storefront collections index.",
    example: "/collections",
  },
  {
    token: "page:page",
    label: "Store pages",
    description: "About, contact, FAQ, and other Shopify pages.",
    example: "/pages/about",
  },
  {
    token: "page:cart",
    label: "Cart page",
    description: "The standard cart page.",
    example: "/cart",
  },
  {
    token: "page:search",
    label: "Search page",
    description: "Search results pages.",
    example: "/search",
  },
  {
    token: "page:blog",
    label: "Blogs and articles",
    description: "Blog index and article pages.",
    example: "/blogs/news",
  },
] as const;

type UrlPageTargetingToken = (typeof urlPageTargetingOptions)[number]["token"];

const urlPageTargetingTokenSet = new Set<string>(
  urlPageTargetingOptions.map((option) => option.token),
);

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
  form?: Partial<CampaignFormValues>;
  goal?: CampaignGoalValue;
  placementType: PlacementTypeValue;
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

const campaignTypeSetupPresets: Record<CampaignTypeValue, CampaignSetupPreset> =
  {
    COUNTDOWN_BAR: {
      form: {
        timerExpiredBehavior: "UNPUBLISH_TIMER",
        timerMode: "FIXED_DATE",
      },
      placementType: "TOP_BAR",
    },
    PRODUCT_TIMER: {
      form: {
        timerExpiredBehavior: "UNPUBLISH_TIMER",
        timerMode: "FIXED_DATE",
      },
      placementType: "PRODUCT_PAGE",
    },
    CART_TIMER: {
      form: {
        cartRescueReason: "CART_RESERVED",
        cartRescueShowButton: true,
        cartRescueShowTimer: true,
        cartRescueTimerStart: "CART_VIEWED",
        cartRescueArmBeforeStart: false,
        cartTimerDurationMinutes: "120",
        cartTimerResetBehavior: "ON_SESSION_END",
        ctaText: cartRescueReasonCopyDefaults.CART_RESERVED.ctaText,
        ctaUrl: cartRescueReasonCopyDefaults.CART_RESERVED.ctaUrl,
        headline: cartRescueReasonCopyDefaults.CART_RESERVED.headline,
        subheadline: cartRescueReasonCopyDefaults.CART_RESERVED.subheadline,
        timerDurationMinutes: "120",
        timerExpiredBehavior: "HIDE_TIMER",
        timerMode: "EVERGREEN_SESSION",
        timerResetBehavior: "ON_SESSION_END",
      },
      goal: "CART_RESCUE",
      placementType: "CART_DRAWER",
    },
    FREE_SHIPPING_GOAL: {
      form: {
        freeShippingAutoDiscount: true,
        freeShippingDiscountCode: "",
        freeShippingExistingDiscount: "",
        freeShippingDiscountTitle: "Promo Pulse free shipping",
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      goal: "FREE_SHIPPING",
      placementType: "CART_DRAWER",
    },
    DELIVERY_CUTOFF: {
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
      form: {
        badgePosition: "TOP_RIGHT",
        badgeShape: "PILL",
        badgeText: "Limited offer",
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      goal: "PRODUCT_BADGE",
      placementType: "COLLECTION_CARD",
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
      form: {
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      placementType: "TOP_BAR",
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
  structureTree = null,
  structureCss = "",
  values,
  errors = {},
  formId,
  hiddenBuilderTabs = [],
  hasSaveBarChanges = true,
  idPrefix = "campaign",
  initialTab = "setup",
  listenForSaveEvents = true,
  lockedTargetingFeatures,
  messageAddon,
  messageInitialLocale = "en",
  messageLocales,
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
  const messageLocaleOptions = useMemo(
    () => getStorefrontLocaleOptions(messageLocales),
    [messageLocales],
  );
  const messageLocaleCodes = useMemo(
    () => messageLocaleOptions.map((localeOption) => localeOption.locale),
    [messageLocaleOptions],
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
  const [localMessageTranslations, setLocalMessageTranslations] = useState(
    () => messageTranslations,
  );
  const messageTranslationsRef = useRef(messageTranslations);
  const messageTranslationsSignature = messageTranslations
    ? getTranslationValuesSignature(messageTranslations, messageLocaleOptions)
    : "";
  const [localDesignValues, setLocalDesignValues] = useState(() => design);
  const [localMobileDesignValues, setLocalMobileDesignValues] = useState(
    () => mobileDesign,
  );
  const [submitAction, setSubmitAction] = useState("saveDraft");
  const submitActionInputRef = useRef<HTMLInputElement | null>(null);
  const [aiSuggestionJson, setAiSuggestionJson] = useState("");
  const [showProductExclusions, setShowProductExclusions] = useState(
    () => values.excludeProductIds.trim().length > 0,
  );
  const [urlEligibilityMode, setUrlEligibilityMode] =
    useState<UrlEligibilityMode>(() => getInitialUrlEligibilityMode(values));
  const [isCampaignTypePickerOpen, setCampaignTypePickerOpen] = useState(false);
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
      <>
        <p>Confirming will save these campaign settings.</p>
        <p>
          Because the storefront is cached, changes can take up to about 5
          minutes to appear for shoppers who already loaded the page. New
          visitors see the update right away.
        </p>
      </>
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
  const usesFreeShippingSettings = isFreeShippingCampaign;
  const isLowStockCampaign =
    formValues.type === "LOW_STOCK" || formValues.goal === "LOW_STOCK_URGENCY";
  const isBadgeCampaign =
    formValues.type === "PRODUCT_BADGE" || formValues.goal === "PRODUCT_BADGE";
  const isSimpleCountdownCampaign =
    formValues.type === "COUNTDOWN_BAR" || formValues.type === "PRODUCT_TIMER";
  const quickCountdownTitle =
    formValues.goal === "ANNOUNCEMENT"
      ? "Announcement timing"
      : formValues.type === "PRODUCT_TIMER"
        ? "Product timer basics"
        : "Countdown basics";
  const quickCountdownDescription =
    formValues.goal === "ANNOUNCEMENT"
      ? "Set whether this announcement uses a deadline, a visitor-specific timer, or a daily recurring window."
      : formValues.type === "PRODUCT_TIMER"
        ? "Set the product-page countdown deadline or visitor-specific timer before refining schedule rules."
        : "Set the campaign countdown deadline or timer length before refining schedule rules.";
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
  const effectiveMessageTranslations =
    localMessageTranslations ?? messageTranslations;
  const effectiveMessageResolvedTranslations = useMemo(
    () =>
      effectiveMessageTranslations
        ? resolveCampaignTranslationValues(
            effectiveMessageTranslations,
            messageResolvedTranslations,
            messageLocaleOptions,
          )
        : messageResolvedTranslations,
    [
      effectiveMessageTranslations,
      messageLocaleOptions,
      messageResolvedTranslations,
    ],
  );
  const syncMessageFieldsFromTranslations = useCallback(
    (
      nextTranslations: CampaignTranslationsByLocale,
      locale: StorefrontLocale,
    ) => {
      const fallbackLocale = messageLocaleOptions[0]?.locale ?? "en";
      const nextMessage =
        nextTranslations[locale] ??
        nextTranslations[fallbackLocale] ??
        nextTranslations.en;

      setLocalMessageTranslations(nextTranslations);
      setFormValues((currentValues) => ({
        ...currentValues,
        headline: nextMessage.headline,
        subheadline: nextMessage.subheadline,
        ctaText: nextMessage.ctaText,
        ctaUrl: nextMessage.ctaUrl,
        expiredText: nextMessage.expiredText,
        badgeText: nextMessage.badgeText,
      }));
    },
    [messageLocaleOptions],
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
      Array.from(
        new Set(
          formValues.placementTypes.map((placementType) =>
            toPreviewPlacement(placementType, formValues.type),
          ),
        ),
      ),
    [formValues.placementTypes, formValues.type],
  );
  const campaignPreviewPlacementKey = formValues.placementTypes.join("|");
  const defaultCampaignPreviewPlacement = toPreviewPlacement(
    formValues.placementType,
    formValues.type,
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
            // Start from the resolved message-editor values so every message
            // field (badge text, free shipping, delivery, low stock) is
            // reflected in the live preview...
            ...(effectiveMessageResolvedTranslations?.[messageInitialLocale] ??
              effectiveMessageResolvedTranslations?.en ??
              {}),
            locale: "en",
            // ...then override the primary fields with the live form values.
            headline: formValues.headline || activeGoalLabel,
            subheadline: formValues.subheadline,
            ctaText: formValues.ctaText || "Shop now",
            ctaUrl: formValues.ctaUrl || "#",
            expiredText: formValues.expiredText || "This offer has ended.",
            badgeText: formValues.badgeText,
          },
        ],
        design: effectiveDesign,
        timerSettings: buildCampaignTimerSettingsValues(formValues),
        cartRescueSettings: isCartRescueCampaign
          ? buildCampaignCartRescueSettingsValues(formValues)
          : null,
        freeShippingSettings: usesFreeShippingSettings
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
              discountCode: getVisibleFreeShippingDiscountCode(formValues),
              showCodeOnStorefront: formValues.freeShippingShowDiscountCode,
            }
          : null,
      }),
    [
      activeGoalLabel,
      effectiveDesign,
      effectiveMessageResolvedTranslations,
      formValues,
      isBadgeCampaign,
      isCartRescueCampaign,
      isDeliveryCutoffCampaign,
      isLowStockCampaign,
      messageInitialLocale,
      usesFreeShippingSettings,
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
  const errorSummaryMessages = useMemo(
    () => buildCampaignErrorSummary(errors, messageTranslationErrors),
    [errors, messageTranslationErrors],
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
        "Promo Pulse will create or update a Shopify automatic free shipping discount with this threshold the next time you save.",
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

  const selectCartRescueReason = (reason: CartRescueReasonValue) => {
    const option = cartRescueReasonOptions.find(
      (item) => item.value === reason,
    );

    if (!option?.supported) return;

    const copy = cartRescueReasonCopyDefaults[reason];
    const cartPlacements = Array.from(
      new Set([
        ...formValues.placementTypes.filter(
          (placement) =>
            placement !== "TOP_BAR" &&
            placement !== "BOTTOM_BAR" &&
            placement !== "PRODUCT_PAGE",
        ),
        "CART_DRAWER" as PlacementTypeValue,
        "CART_PAGE" as PlacementTypeValue,
      ]),
    );

    setFormValues((currentValues) => ({
      ...currentValues,
      cartRescueReason: reason,
      cartRescueShowButton: copy.showButton,
      cartRescueShowTimer: copy.showTimer,
      ctaText: copy.ctaText,
      ctaUrl: copy.ctaUrl,
      headline: copy.headline,
      placementType: cartPlacements[0] ?? "CART_DRAWER",
      placementTypes: cartPlacements,
      subheadline: copy.subheadline,
      timerExpiredBehavior:
        reason === "CART_RESERVED" ? "HIDE_TIMER" : "DO_NOTHING",
      timerMode: "EVERGREEN_SESSION",
    }));
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

  const selectedIncludedUrlPageTokens = useMemo(
    () => selectedUrlPageTargetingTokens(formValues.urlContains),
    [formValues.urlContains],
  );
  const selectedExcludedUrlPageTokens = useMemo(
    () => selectedUrlPageTargetingTokens(formValues.excludedUrlContains),
    [formValues.excludedUrlContains],
  );
  const manualIncludedUrlText = useMemo(
    () => manualUrlTargetingText(formValues.urlContains),
    [formValues.urlContains],
  );
  const manualExcludedUrlText = useMemo(
    () => manualUrlTargetingText(formValues.excludedUrlContains),
    [formValues.excludedUrlContains],
  );
  const activeUrlTargetingField: UrlTargetingFieldName =
    urlEligibilityMode === "include" ? "urlContains" : "excludedUrlContains";
  const activeUrlPageTokens =
    urlEligibilityMode === "include"
      ? selectedIncludedUrlPageTokens
      : selectedExcludedUrlPageTokens;
  const activeManualUrlText =
    urlEligibilityMode === "include"
      ? manualIncludedUrlText
      : manualExcludedUrlText;
  const activeUrlFieldError =
    urlEligibilityMode === "include"
      ? errors.urlContains
      : errors.excludedUrlContains;
  const activeUrlModeCopy =
    urlEligibilityMode === "include"
      ? {
          title: "Include only these pages",
          description:
            "The campaign will render only on the selected page types or custom URL fragments. Leave everything empty to allow any URL that matches the rest of targeting.",
          pickerTitle: "Included page types",
          pickerDescription:
            "Select the Shopify page groups where this campaign is allowed to render.",
          textareaLabel: "Custom URLs to include",
          textareaPlaceholder: "/products/summer-hat\n/collections/sale",
        }
      : {
          title: "Exclude these pages",
          description:
            "The campaign can render broadly, except on the selected page types or custom URL fragments.",
          pickerTitle: "Excluded page types",
          pickerDescription:
            "Select the Shopify page groups where this campaign should never render.",
          textareaLabel: "Custom URLs to exclude",
          textareaPlaceholder: "/pages/wholesale\n?preview_theme_id=",
        };

  const selectUrlEligibilityMode = (nextMode: UrlEligibilityMode) => {
    setUrlEligibilityMode(nextMode);
    setFormValues((currentValues) => ({
      ...currentValues,
      [nextMode === "include" ? "excludedUrlContains" : "urlContains"]: "",
    }));
  };

  const setUrlPageTargetingToken = (
    field: UrlTargetingFieldName,
    token: UrlPageTargetingToken,
    checked: boolean,
  ) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: mergeUrlTargetingValue(
        toggleUrlPageTargetingToken(
          selectedUrlPageTargetingTokens(currentValues[field]),
          token,
          checked,
        ),
        manualUrlTargetingItems(currentValues[field]),
      ),
    }));
  };

  const setManualUrlTargetingField =
    (field: UrlTargetingFieldName) =>
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const manualItems = splitCampaignList(event.currentTarget.value);

      setFormValues((currentValues) => ({
        ...currentValues,
        [field]: mergeUrlTargetingValue(
          selectedUrlPageTargetingTokens(currentValues[field]),
          manualItems,
        ),
      }));
    };

  const setManualListField =
    (field: TextListFieldName) => (event: ChangeEvent<HTMLTextAreaElement>) => {
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
    if (choice.value === activeCampaignTypeChoiceKey) {
      setCampaignTypePickerOpen(false);
      return;
    }

    const preset =
      choice.value === "PRODUCT_TIMER"
        ? campaignTypeSetupPresets.PRODUCT_TIMER
        : campaignGoalSetupPresets[choice.goal];

    const nextValues = applyCampaignTypeDefaultTextValues(
      applySetupPreset(
        {
          ...formValues,
          goal: choice.goal,
          type: choice.type,
        },
        preset,
      ),
      { overwrite: true },
    );
    const nextTranslations = buildCampaignTypeDefaultTranslations(
      nextValues,
      messageLocaleOptions,
    );

    setFormValues(nextValues);
    setLocalMessageTranslations(nextTranslations);
    setCampaignPreviewPlacementOverride(null);
    setCampaignTypePickerOpen(false);
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
      const nextMobileDesign = nextDesign.separateMobileDesign
        ? effectiveMobileDesign
        : deriveMobileDesignFromDesktop(nextDesign);

      if (onDesignChange) {
        onDesignChange(nextDesign);
        onMobileDesignChange?.(nextMobileDesign);
        return;
      }

      setLocalDesignValues(nextDesign);
      setLocalMobileDesignValues(nextMobileDesign);
    },
    [effectiveMobileDesign, onDesignChange, onMobileDesignChange],
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
    messageTranslationsRef.current = messageTranslations;
  }, [messageTranslations]);

  useEffect(() => {
    const syncTranslations = window.setTimeout(() => {
      setLocalMessageTranslations(messageTranslationsRef.current);
    }, 0);

    return () => window.clearTimeout(syncTranslations);
  }, [messageTranslationsSignature]);

  useEffect(() => {
    onValuesChange?.(formValues);
  }, [formValues, onValuesChange]);

  useEffect(() => {
    if (!syncExternalValues) return undefined;

    const syncFormValues = window.setTimeout(() => {
      setFormValues(values);
      const nextUrlEligibilityMode = getUrlEligibilityModeFromValues(values);

      if (nextUrlEligibilityMode) {
        setUrlEligibilityMode(nextUrlEligibilityMode);
      }
    }, 0);

    return () => window.clearTimeout(syncFormValues);
  }, [syncExternalValues, values]);

  useEffect(() => {
    if (!listenForSaveEvents) return undefined;

    const submitWithAction = (action: "saveDraft" | "publishCampaign") => {
      setSubmitAction(action);
      window.setTimeout(() => {
        if (submitActionInputRef.current) {
          submitActionInputRef.current.value = action;
        }
        formRef.current?.requestSubmit();
      }, 0);
    };
    const handleSaveRequest = () => {
      if (!hasSaveBarChanges) return;

      submitWithAction("saveDraft");
    };
    const handlePublishRequest = () => submitWithAction("publishCampaign");
    const handleDiscardRequest = () => {
      setFormValues(values);
      setUrlEligibilityMode(getInitialUrlEligibilityMode(values));
      setLocalMessageTranslations(messageTranslations);
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
  }, [hasSaveBarChanges, listenForSaveEvents, messageTranslations, values]);

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
        <input
          ref={submitActionInputRef}
          name="_action"
          type="hidden"
          value={submitAction}
          onChange={() => undefined}
        />
        <input
          data-ai-suggestion-json
          name="aiSuggestionJson"
          readOnly
          type="hidden"
          value={aiSuggestionJson}
        />
        {designHiddenInputs}

        {errorSummaryMessages.length > 0 && (
          <AppAlert tone="critical" title="Campaign could not be saved">
            <ul className="counterpulse-error-summary">
              {errorSummaryMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
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
                  <div className="counterpulse-campaign-type-picker">
                    <button
                      aria-expanded={isCampaignTypePickerOpen}
                      className="counterpulse-campaign-type-current"
                      type="button"
                      onClick={() =>
                        setCampaignTypePickerOpen((current) => !current)
                      }
                    >
                      <span
                        className="counterpulse-goal-card__icon"
                        aria-hidden="true"
                      >
                        {activeCampaignTypeChoice.icon === "type" ? (
                          <CampaignTypeIcon
                            type={activeCampaignTypeChoice.type}
                          />
                        ) : (
                          <GoalIcon goal={activeCampaignTypeChoice.goal} />
                        )}
                      </span>
                      <span>
                        <strong>{activeCampaignTypeChoice.label}</strong>
                        <small>{activeCampaignTypeChoice.description}</small>
                      </span>
                      <span className="counterpulse-campaign-type-current__action">
                        {isCampaignTypePickerOpen
                          ? "Hide options"
                          : "Change type"}
                      </span>
                    </button>

                    {isCampaignTypePickerOpen && (
                      <div className="counterpulse-campaign-type-options">
                        <p className="counterpulse-muted">
                          Changing type updates setup defaults.
                        </p>
                        <div
                          className="counterpulse-goal-list"
                          role="radiogroup"
                        >
                          {campaignTypeChoiceOptions
                            .filter(
                              (option) =>
                                option.value !== activeCampaignTypeChoiceKey,
                            )
                            .map((option) => (
                              <button
                                aria-checked={false}
                                className="counterpulse-goal-card"
                                key={option.value}
                                role="radio"
                                type="button"
                                onClick={() => selectCampaignTypeChoice(option)}
                              >
                                <input
                                  checked={false}
                                  type="radio"
                                  name="campaignTypeChoice"
                                  value={option.value}
                                  onChange={() =>
                                    selectCampaignTypeChoice(option)
                                  }
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
                      </div>
                    )}
                  </div>
                </FormGroup>

                {isSimpleCountdownCampaign && (
                  <section
                    className="counterpulse-targeting-card counterpulse-free-shipping-setup-card counterpulse-campaign-quick-setup-card"
                    aria-labelledby={scopedId("countdown-setup-heading")}
                  >
                    <div className="counterpulse-targeting-card__header">
                      <h3 id={scopedId("countdown-setup-heading")}>
                        {quickCountdownTitle}
                      </h3>
                      <p>{quickCountdownDescription}</p>
                    </div>

                    <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                      <FormField label="Timer type" error={errors.timerMode}>
                        <select
                          value={formValues.timerMode}
                          onChange={(event) =>
                            selectTimerMode(
                              event.currentTarget
                                .value as CampaignTimerModeValue,
                            )
                          }
                        >
                          {timerModeOptions.map((option) => (
                            <option
                              disabled={Boolean(
                                option.disabledFeature === "recurringTimers" &&
                                recurringTimersLocked,
                              )}
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      {formValues.timerMode === "FIXED_DATE" ? (
                        <FormField label="End date" error={errors.endsAt}>
                          <input
                            type="datetime-local"
                            value={formValues.endsAt}
                            onChange={updateField("endsAt")}
                          />
                        </FormField>
                      ) : formValues.timerMode === "EVERGREEN_SESSION" ? (
                        <FormField
                          label="Timer minutes"
                          error={errors.timerDurationMinutes}
                        >
                          <input
                            inputMode="numeric"
                            max={10080}
                            min={1}
                            type="number"
                            value={formValues.timerDurationMinutes}
                            onChange={updateField("timerDurationMinutes")}
                          />
                        </FormField>
                      ) : (
                        <>
                          <FormField
                            label="Daily cutoff hour"
                            error={errors.timerRecurringHour}
                          >
                            <input
                              inputMode="numeric"
                              max={23}
                              min={0}
                              type="number"
                              value={formValues.timerRecurringHour}
                              onChange={updateField("timerRecurringHour")}
                            />
                          </FormField>
                          <FormField
                            label="Daily cutoff minute"
                            error={errors.timerRecurringMinute}
                          >
                            <input
                              inputMode="numeric"
                              max={59}
                              min={0}
                              type="number"
                              value={formValues.timerRecurringMinute}
                              onChange={updateField("timerRecurringMinute")}
                            />
                          </FormField>
                        </>
                      )}

                      <FormField
                        label="Once it ends"
                        error={errors.timerExpiredBehavior}
                      >
                        <select
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

                      {formValues.timerExpiredBehavior ===
                        "SHOW_CUSTOM_TITLE" && (
                        <FormField
                          label="Custom title"
                          error={errors.expiredText}
                        >
                          <input
                            value={formValues.expiredText}
                            placeholder="This offer has ended."
                            onChange={updateField("expiredText")}
                          />
                        </FormField>
                      )}
                    </div>
                  </section>
                )}

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
                        <span>Create Shopify automatic free shipping</span>
                      </label>
                      <p>
                        When enabled, saving creates or updates a Shopify
                        automatic free shipping discount with this subtotal
                        threshold. Checkout applies it without requiring a code.
                      </p>

                      {errors.freeShippingAutoDiscount && (
                        <AppAlert
                          tone="critical"
                          title="Automatic free shipping could not be configured"
                        >
                          {errors.freeShippingAutoDiscount}
                        </AppAlert>
                      )}

                      {formValues.freeShippingAutoDiscount && (
                        <div className="counterpulse-form-grid counterpulse-form-grid--wide">
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

                          <FormField
                            label="Existing Shopify discount ID or code"
                            error={errors.freeShippingExistingDiscount}
                          >
                            <input
                              name="freeShippingExistingDiscount"
                              value={formValues.freeShippingExistingDiscount}
                              onChange={updateField(
                                "freeShippingExistingDiscount",
                              )}
                              placeholder="Optional"
                            />
                            <p className="counterpulse-field-hint">
                              Leave empty to let Promo Pulse manage the
                              automatic discount. Use this only to link an
                              existing Shopify free shipping discount.
                            </p>
                          </FormField>

                          {isFreeShippingCodeReference(
                            formValues.freeShippingExistingDiscount,
                          ) ? (
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
                                Only use this when the linked Shopify discount
                                is code based and you want to promote that code.
                              </p>
                            </div>
                          ) : null}
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
                        Cart rescue logic
                      </h3>
                      <p>
                        Choose the safe reason behind this cart message. Promo
                        Pulse only enables reasons backed by current storefront
                        data, so it will not claim real inventory, price, or
                        discount expiry unless that connection exists.
                      </p>
                    </div>

                    <input
                      name="cartRescueReason"
                      type="hidden"
                      value={formValues.cartRescueReason}
                    />

                    <div
                      className="counterpulse-goal-list counterpulse-goal-list--compact"
                      role="radiogroup"
                      aria-label="Cart rescue reason"
                    >
                      {cartRescueReasonOptions.map((option) => {
                        const isSelected =
                          formValues.cartRescueReason === option.value;

                        return (
                          <button
                            aria-checked={isSelected}
                            aria-disabled={!option.supported}
                            className={[
                              "counterpulse-goal-card",
                              isSelected ? "is-selected" : "",
                              !option.supported ? "is-disabled" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={option.value}
                            role="radio"
                            type="button"
                            onClick={() => selectCartRescueReason(option.value)}
                          >
                            <input
                              checked={isSelected}
                              disabled={!option.supported}
                              name="cartRescueReasonOption"
                              type="radio"
                              value={option.value}
                              onChange={() =>
                                selectCartRescueReason(option.value)
                              }
                            />
                            <span
                              className="counterpulse-goal-card__icon"
                              aria-hidden="true"
                            >
                              <CartRescueReasonIcon reason={option.value} />
                            </span>
                            <span>
                              <strong>{option.label}</strong>
                              <small>{option.description}</small>
                              {!option.supported && (
                                <em>Requires deeper Shopify data</em>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                      <FormField label="Headline" error={errors.headline}>
                        <input
                          name="headline"
                          value={formValues.headline}
                          onChange={updateField("headline")}
                        />
                      </FormField>

                      <FormField label="Subheadline" error={errors.subheadline}>
                        <input
                          name="subheadline"
                          value={formValues.subheadline}
                          onChange={updateField("subheadline")}
                        />
                      </FormField>

                      <FormField label="CTA text" error={errors.ctaText}>
                        <input
                          name="ctaText"
                          value={formValues.ctaText}
                          onChange={updateField("ctaText")}
                        />
                      </FormField>

                      <FormField label="CTA URL" error={errors.ctaUrl}>
                        <input
                          name="ctaUrl"
                          value={formValues.ctaUrl}
                          onChange={updateField("ctaUrl")}
                        />
                      </FormField>

                      <div className="counterpulse-toggle">
                        <label className="counterpulse-toggle-label">
                          <input
                            checked={formValues.cartRescueShowButton}
                            name="cartRescueShowButton"
                            type="checkbox"
                            onChange={updateCheckboxField(
                              "cartRescueShowButton",
                            )}
                          />
                          <input
                            name="cartRescueShowButton"
                            type="hidden"
                            value="false"
                          />
                          <span>Show checkout button</span>
                        </label>
                      </div>

                      <div className="counterpulse-toggle">
                        <label className="counterpulse-toggle-label">
                          <input
                            checked={formValues.cartRescueShowTimer}
                            name="cartRescueShowTimer"
                            type="checkbox"
                            onChange={updateCheckboxField(
                              "cartRescueShowTimer",
                            )}
                          />
                          <input
                            name="cartRescueShowTimer"
                            type="hidden"
                            value="false"
                          />
                          <span>Show session timer</span>
                        </label>
                      </div>

                      {formValues.cartRescueShowTimer && (
                        <>
                          <FormField
                            label="Timer minutes"
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

                          <FormField
                            label="Once it ends"
                            error={errors.timerExpiredBehavior}
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

                          <input
                            name="cartRescueTimerStart"
                            type="hidden"
                            value={formValues.cartRescueTimerStart}
                          />

                          <FormField
                            label="Countdown starts"
                            error={errors.cartRescueTimerStart}
                          >
                            <select
                              aria-label="Cart rescue countdown start trigger"
                              value={formValues.cartRescueTimerStart}
                              onChange={(event) =>
                                setFormValues((currentValues) => ({
                                  ...currentValues,
                                  cartRescueTimerStart: event.currentTarget
                                    .value as CartRescueTimerStartValue,
                                }))
                              }
                            >
                              {cartRescueTimerStartOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <small className="counterpulse-field-hint">
                              {
                                cartRescueTimerStartOptions.find(
                                  (option) =>
                                    option.value ===
                                    formValues.cartRescueTimerStart,
                                )?.description
                              }
                            </small>
                          </FormField>

                          {formValues.cartRescueTimerStart ===
                            "DISCOUNT_APPLIED" && (
                            <div className="counterpulse-toggle">
                              <label className="counterpulse-toggle-label">
                                <input
                                  checked={formValues.cartRescueArmBeforeStart}
                                  name="cartRescueArmBeforeStart"
                                  type="checkbox"
                                  onChange={updateCheckboxField(
                                    "cartRescueArmBeforeStart",
                                  )}
                                />
                                <input
                                  name="cartRescueArmBeforeStart"
                                  type="hidden"
                                  value="false"
                                />
                                <span>
                                  Show the offer before the discount is applied
                                  (timer stays hidden until then)
                                </span>
                              </label>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="counterpulse-placement-grid counterpulse-placement-grid--compact">
                      {(["CART_DRAWER", "CART_PAGE"] as const).map(
                        (placementType) => {
                          const option = placementTypeOptions.find(
                            (item) => item.value === placementType,
                          );
                          const isSelected =
                            formValues.placementTypes.includes(placementType);

                          return (
                            <button
                              aria-pressed={isSelected}
                              className={
                                isSelected
                                  ? "counterpulse-placement-tile is-selected"
                                  : "counterpulse-placement-tile"
                              }
                              key={placementType}
                              type="button"
                              onClick={() => togglePlacement(placementType)}
                            >
                              <span
                                aria-hidden="true"
                                className="counterpulse-placement-tile__initial"
                              >
                                {placementInitial(
                                  option?.label ?? placementType,
                                )}
                              </span>
                              <span className="counterpulse-placement-tile__body">
                                <strong>
                                  {option?.label ?? placementType}
                                </strong>
                                <small>
                                  {option?.description ??
                                    "Cart rescue storefront surface."}
                                </small>
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>

                    <p className="counterpulse-field-hint">
                      Cart rescue can render on the cart drawer, cart page, or
                      both. The Placement tab remains the full source of truth
                      for every selected storefront surface.
                    </p>
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

                    <TimezoneCombobox
                      error={errors.timezone}
                      info={
                        <FieldInfoButton
                          label="Delivery timezone"
                          title="Timezone used for the delivery promise"
                        >
                          <CampaignInfoContent
                            intro="The order-by cutoff and delivery window are calculated in this timezone. Use the same zone as the fulfillment operation so the promise stays accurate."
                            items={[
                              [
                                "Cutoff accuracy",
                                "The countdown to the daily cutoff and the ship/delivery dates are all evaluated against this zone.",
                              ],
                              [
                                "Shared with timing",
                                "This is the same timezone shown in the Timing and timezone tab; changing it here updates it everywhere.",
                              ],
                            ]}
                          />
                        </FieldInfoButton>
                      }
                      label="Delivery timezone"
                      name="timezone"
                      className="counterpulse-form-field--full"
                      value={formValues.timezone}
                      onChange={(timezone) =>
                        setFormValues((currentValues) => ({
                          ...currentValues,
                          timezone,
                        }))
                      }
                    />
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
              <div className="counterpulse-message-variables-row">
                <span>
                  Use dynamic variables inside any message and they are replaced
                  live on the storefront.
                </span>
                <FieldInfoButton
                  label="Message variables"
                  title="Dynamic message variables"
                  modalClassName="counterpulse-modal--wide"
                >
                  <MessageVariablesInfo type={formValues.type} />
                </FieldInfoButton>
              </div>
              {effectiveMessageTranslations &&
              effectiveMessageResolvedTranslations ? (
                <>
                  <CampaignMessageHiddenInputs
                    localeOptions={messageLocaleOptions}
                    values={formValues}
                    translations={effectiveMessageTranslations}
                  />
                  <CampaignTranslationsEditor
                    embedded
                    errors={messageTranslationErrors}
                    initialLocale={messageInitialLocale}
                    initialValues={effectiveMessageTranslations}
                    locales={messageLocaleCodes}
                    resolvedValues={effectiveMessageResolvedTranslations}
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
                {(() => {
                  const incompatible = getIncompatiblePlacementWarning(
                    formValues.placementTypes,
                  );

                  if (!incompatible) return null;

                  return (
                    <AppAlert
                      tone="warning"
                      title="These placements work better as separate campaigns"
                    >
                      <p>
                        Badge placements (
                        {incompatible.badgeLabels.join(", ")}) render a small
                        badge over product media, while{" "}
                        {incompatible.nonBadgeLabels.join(", ")} render a
                        banner or card. A single design can't be tuned well for
                        both shapes.
                      </p>
                      <p>
                        Create one campaign for the badge placements and another
                        for the rest so each design fits its surface correctly.
                      </p>
                    </AppAlert>
                  );
                })()}
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
                        placeholder=".product-form__buttons, .product__info-container"
                        onChange={updateField("customSelector")}
                      />
                      <small>
                        Separate multiple theme selectors with commas. Promo
                        Pulse uses the first matching selector as the injection
                        target when the app embed is active.
                      </small>
                      <FieldError message={errors.customSelector} />
                    </div>
                    <div className="counterpulse-targeting-field">
                      <label htmlFor={scopedId("custom-style")}>
                        Container style
                      </label>
                      <textarea
                        id={scopedId("custom-style")}
                        name="customStyle"
                        value={formValues.customStyle}
                        placeholder="position: absolute; top: 12px; right: 12px; z-index: 20;"
                        rows={3}
                        onChange={updateField("customStyle")}
                      />
                      <small>
                        Applied as inline CSS to the injected Promo Pulse
                        container. Use it only for placement rules such as
                        position, inset, margin, or z-index.
                      </small>
                      <FieldError message={errors.customStyle} />
                    </div>
                  </div>
                </section>
              )}
              {!formValues.placementTypes.includes("CUSTOM_SELECTOR") && (
                <>
                  <input
                    name="customSelector"
                    type="hidden"
                    value={formValues.customSelector}
                  />
                  <input
                    name="customStyle"
                    type="hidden"
                    value={formValues.customStyle}
                  />
                </>
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
                  className="counterpulse-targeting-card counterpulse-targeting-card--wide counterpulse-product-eligibility-card"
                  aria-labelledby={scopedId("products-heading")}
                >
                  <div className="counterpulse-targeting-card__header">
                    <h3 id={scopedId("products-heading")}>
                      Product eligibility
                    </h3>
                    <p>
                      Choose which products can show this campaign. Use Shopify
                      pickers for product and collection targeting, or target
                      tags by search.
                    </p>
                  </div>

                  <div className="counterpulse-product-eligibility-options">
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
                          onManualChange={setManualListField(
                            "excludeProductIds",
                          )}
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
                      onSelect={() =>
                        selectProductSelection("SPECIFIC_PRODUCTS")
                      }
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
                      title="Specific collections"
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
                        onRemove={(id) =>
                          removeResourceChip("collectionIds", id)
                        }
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
                      title="Specific product tags"
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
                  </div>
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
                      Select common Shopify page types or add custom storefront
                      paths. Include rules limit where the campaign can render;
                      exclude rules always prevent rendering.
                    </p>
                  </div>
                  <input
                    name="urlContains"
                    type="hidden"
                    value={
                      activeUrlTargetingField === "urlContains"
                        ? (formValues.urlContains ?? "")
                        : ""
                    }
                  />
                  <input
                    name="excludedUrlContains"
                    type="hidden"
                    value={
                      activeUrlTargetingField === "excludedUrlContains"
                        ? (formValues.excludedUrlContains ?? "")
                        : ""
                    }
                  />
                  <div className="counterpulse-url-eligibility-mode">
                    <div
                      aria-label="URL eligibility mode"
                      className="counterpulse-url-eligibility-switch"
                      role="group"
                    >
                      <button
                        aria-pressed={urlEligibilityMode === "include"}
                        className={
                          urlEligibilityMode === "include" ? "is-selected" : ""
                        }
                        type="button"
                        onClick={() => selectUrlEligibilityMode("include")}
                      >
                        Include pages
                      </button>
                      <button
                        aria-pressed={urlEligibilityMode === "exclude"}
                        className={
                          urlEligibilityMode === "exclude" ? "is-selected" : ""
                        }
                        type="button"
                        onClick={() => selectUrlEligibilityMode("exclude")}
                      >
                        Exclude pages
                      </button>
                    </div>
                    <div className="counterpulse-url-eligibility-copy">
                      <strong>{activeUrlModeCopy.title}</strong>
                      <span>{activeUrlModeCopy.description}</span>
                    </div>
                  </div>
                  <div className="counterpulse-url-page-targeting-grid counterpulse-url-page-targeting-grid--single">
                    <UrlPageTargetingPicker
                      selectedTokens={activeUrlPageTokens}
                      title={activeUrlModeCopy.pickerTitle}
                      description={activeUrlModeCopy.pickerDescription}
                      onToggle={(token, checked) =>
                        setUrlPageTargetingToken(
                          activeUrlTargetingField,
                          token,
                          checked,
                        )
                      }
                    />
                  </div>
                  <div className="counterpulse-url-targeting-grid counterpulse-url-targeting-grid--single">
                    <FormField
                      label={activeUrlModeCopy.textareaLabel}
                      error={activeUrlFieldError}
                    >
                      <textarea
                        rows={4}
                        placeholder={activeUrlModeCopy.textareaPlaceholder}
                        value={activeManualUrlText}
                        onChange={setManualUrlTargetingField(
                          activeUrlTargetingField,
                        )}
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
                structureTree={structureTree}
                structureCss={structureCss}
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
  const timerMode =
    preset.form?.timerMode ?? defaultCampaignFormValues.timerMode;

  return {
    ...defaultCampaignFormValues,
    goal: values.goal,
    type: values.type,
    name: values.name,
    status: values.status,
    timezone: values.timezone,
    productSelection: values.productSelection,
    productIds: values.productIds,
    excludeProductIds: values.excludeProductIds,
    collectionIds: values.collectionIds,
    productTags: values.productTags,
    countrySelection: values.countrySelection,
    countries: values.countries,
    urlContains: values.urlContains,
    excludedUrlContains: values.excludedUrlContains,
    ...preset.form,
    ...(preset.goal ? { goal: preset.goal } : {}),
    ...(preset.type ? { type: preset.type } : {}),
    startsAt:
      timerMode !== "FIXED_DATE"
        ? ""
        : (preset.form?.startsAt ?? values.startsAt),
    endsAt:
      timerMode !== "FIXED_DATE" ? "" : (preset.form?.endsAt ?? values.endsAt),
    placementType: preset.placementType,
    placementTypes: [preset.placementType],
  };
}

function getVisibleFreeShippingDiscountCode(values: CampaignFormValues) {
  if (!values.freeShippingShowDiscountCode) return null;

  const existingReference = values.freeShippingExistingDiscount.trim();
  if (isFreeShippingCodeReference(existingReference)) {
    return existingReference.toUpperCase();
  }

  const legacyCode = values.freeShippingDiscountCode.trim();
  return legacyCode ? legacyCode.toUpperCase() : null;
}

function isFreeShippingCodeReference(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return false;
  if (/^gid:\/\/shopify\/Discount/i.test(trimmed)) return false;

  return /^[A-Z0-9_-]{3,80}$/i.test(trimmed);
}

function buildCampaignTypeDefaultTranslations(
  values: CampaignFormValues,
  localeOptions: readonly StorefrontLocaleOption[],
) {
  return localeOptions.reduce((translations, localeOption) => {
    translations[localeOption.locale] = {
      ...getDefaultCampaignTranslationValues(
        values.goal,
        values.type,
        localeOption.locale,
      ),
    };
    return translations;
  }, {} as CampaignTranslationsByLocale);
}

function resolveCampaignTranslationValues(
  values: CampaignTranslationsByLocale,
  fallbackValues?: CampaignTranslationsByLocale,
  localeOptions: readonly StorefrontLocaleOption[] = getStorefrontLocaleOptions(),
) {
  const fallbackLocale = localeOptions[0]?.locale ?? "en";

  return localeOptions.reduce((resolvedValues, localeOption) => {
    const locale = localeOption.locale;

    campaignTranslationFields.forEach((field) => {
      resolvedValues[locale][field.key] =
        values[locale]?.[field.key] ||
        values[fallbackLocale]?.[field.key] ||
        values.en?.[field.key] ||
        fallbackValues?.[locale]?.[field.key] ||
        fallbackValues?.[fallbackLocale]?.[field.key] ||
        fallbackValues?.en?.[field.key] ||
        "";
    });

    return resolvedValues;
  }, buildEmptyResolvedTranslations(localeOptions));
}

function buildEmptyResolvedTranslations(
  localeOptions: readonly StorefrontLocaleOption[],
) {
  return localeOptions.reduce((translations, localeOption) => {
    translations[localeOption.locale] =
      {} as CampaignTranslationsByLocale[string];
    return translations;
  }, {} as CampaignTranslationsByLocale);
}

function getTranslationValuesSignature(
  values: CampaignTranslationsByLocale,
  localeOptions: readonly StorefrontLocaleOption[],
) {
  return localeOptions
    .flatMap((localeOption) =>
      campaignTranslationFields.map(
        (field) => values[localeOption.locale]?.[field.key] ?? "",
      ),
    )
    .join("\u001f");
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

function UrlPageTargetingPicker({
  description,
  selectedTokens,
  title,
  onToggle,
}: {
  description: string;
  selectedTokens: UrlPageTargetingToken[];
  title: string;
  onToggle: (token: UrlPageTargetingToken, checked: boolean) => void;
}) {
  return (
    <div className="counterpulse-url-page-targeting">
      <div
        className="counterpulse-url-page-targeting__header"
        aria-label={title}
        role="group"
      >
        <strong>{title}</strong>
        <span>{description}</span>
        <div className="counterpulse-url-page-options">
          {urlPageTargetingOptions.map((option) => {
            const checked = selectedTokens.includes(option.token);

            return (
              <label
                className={
                  checked
                    ? "counterpulse-url-page-option is-selected"
                    : "counterpulse-url-page-option"
                }
                key={option.token}
              >
                <input
                  aria-label={option.label}
                  checked={checked}
                  type="checkbox"
                  onChange={(event) =>
                    onToggle(option.token, event.currentTarget.checked)
                  }
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                  <code>{option.example}</code>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function selectedUrlPageTargetingTokens(
  value: string | undefined,
): UrlPageTargetingToken[] {
  const selected = new Set(
    splitCampaignList(value ?? "")
      .map((item) => item.toLowerCase())
      .filter((item) => urlPageTargetingTokenSet.has(item)),
  );

  return urlPageTargetingOptions
    .map((option) => option.token)
    .filter((token) => selected.has(token));
}

function manualUrlTargetingItems(value: string | undefined) {
  return splitCampaignList(value ?? "").filter(
    (item) => !urlPageTargetingTokenSet.has(item.toLowerCase()),
  );
}

function manualUrlTargetingText(value: string | undefined) {
  return manualUrlTargetingItems(value).join("\n");
}

function getInitialUrlEligibilityMode(
  values: Pick<CampaignFormValues, "urlContains" | "excludedUrlContains">,
): UrlEligibilityMode {
  return getUrlEligibilityModeFromValues(values) ?? "include";
}

function getUrlEligibilityModeFromValues(
  values: Pick<CampaignFormValues, "urlContains" | "excludedUrlContains">,
): UrlEligibilityMode | null {
  const includeCount = splitCampaignList(values.urlContains ?? "").length;
  const excludeCount = splitCampaignList(
    values.excludedUrlContains ?? "",
  ).length;

  if (excludeCount > 0 && includeCount === 0) return "exclude";
  if (includeCount > 0 && excludeCount === 0) return "include";

  return null;
}

function toggleUrlPageTargetingToken(
  currentTokens: UrlPageTargetingToken[],
  token: UrlPageTargetingToken,
  checked: boolean,
) {
  const nextTokens = new Set(currentTokens);

  if (checked) {
    nextTokens.add(token);
  } else {
    nextTokens.delete(token);
  }

  return urlPageTargetingOptions
    .map((option) => option.token)
    .filter((optionToken) => nextTokens.has(optionToken));
}

function mergeUrlTargetingValue(
  pageTokens: UrlPageTargetingToken[],
  manualItems: string[],
) {
  return [...pageTokens, ...manualItems].join("\n");
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

type MessageVariableGroup = {
  title: string;
  description: string;
  variables: Array<{ token: string; description: string; example: string }>;
};

const globalMessageVariables: MessageVariableGroup = {
  title: "Global (any campaign type)",
  description:
    "These work in every campaign type. Drop them into any message field.",
  variables: [
    {
      token: "{{time_left}}",
      description:
        "Live countdown remaining, shown whenever the campaign has an active timer or cutoff.",
      example: "02h 15m",
    },
    {
      token: "{{time_remaining}}",
      description: "Alias of {{time_left}}.",
      example: "02h 15m",
    },
    {
      token: "{{year}}",
      description: "The current calendar year.",
      example: "2026",
    },
  ],
};

const timerMessageVariables: MessageVariableGroup = {
  title: "Timer",
  description:
    "The campaign's scheduled end, formatted in the campaign timezone and the storefront locale.",
  variables: [
    {
      token: "{{end_date}}",
      description: "Date the timer ends.",
      example: "Apr 15",
    },
    {
      token: "{{end_time}}",
      description: "Time the timer ends.",
      example: "11:59 PM",
    },
  ],
};

const badgeMessageVariables: MessageVariableGroup = {
  title: "Product badge",
  description:
    "Use the timer end so a badge can read like \"Ends {{end_date}}\". Keep badge copy short.",
  variables: [
    {
      token: "{{end_date}}",
      description: "Date the badge's offer ends.",
      example: "Apr 15",
    },
    {
      token: "{{end_time}}",
      description: "Time the badge's offer ends.",
      example: "11:59 PM",
    },
  ],
};

const freeShippingMessageVariables: MessageVariableGroup = {
  title: "Free shipping",
  description:
    "Replaced with the amount still needed to unlock free shipping, formatted in the cart currency.",
  variables: [
    {
      token: "{{amount}}",
      description: "Amount remaining to reach the free shipping threshold.",
      example: "$24.00",
    },
    {
      token: "{{remaining}}",
      description: "Alias of {{amount}}.",
      example: "$24.00",
    },
    {
      token: "{{remaining_amount}}",
      description: "Alias of {{amount}}.",
      example: "$24.00",
    },
  ],
};

const lowStockMessageVariables: MessageVariableGroup = {
  title: "Low stock",
  description:
    "Replaced with the remaining inventory when Shopify exposes a quantity at or below your threshold.",
  variables: [
    {
      token: "{{quantity}}",
      description: "Remaining units in stock.",
      example: "7",
    },
    {
      token: "{{count}}",
      description: "Alias of {{quantity}}.",
      example: "7",
    },
  ],
};

const deliveryCutoffMessageVariables: MessageVariableGroup = {
  title: "Delivery cutoff",
  description:
    "Computed from the cutoff, processing, and delivery settings in the campaign's timezone. Dates and weekdays follow the storefront locale.",
  variables: [
    {
      token: "{{cutoff_time}}",
      description: "Time of the daily cutoff.",
      example: "2:00 PM",
    },
    {
      token: "{{delivery_range}}",
      description: "Estimated delivery window (min to max date).",
      example: "Apr 12 – Apr 15",
    },
    {
      token: "{{ships_date}}",
      description: "Date the order is expected to ship.",
      example: "Apr 10",
    },
    {
      token: "{{ships_weekday}}",
      description: "Weekday the order is expected to ship.",
      example: "Wednesday",
    },
    {
      token: "{{min_delivery_date}}",
      description: "Earliest estimated delivery date.",
      example: "Apr 12",
    },
    {
      token: "{{min_delivery_weekday}}",
      description: "Earliest estimated delivery weekday.",
      example: "Friday",
    },
    {
      token: "{{max_delivery_date}}",
      description: "Latest estimated delivery date.",
      example: "Apr 15",
    },
    {
      token: "{{max_delivery_weekday}}",
      description: "Latest estimated delivery weekday.",
      example: "Monday",
    },
  ],
};

function messageVariableGroupsForType(
  type: CampaignFormValues["type"],
): MessageVariableGroup[] {
  // Every type gets the global variables, plus the ones specific to its data.
  const specific: MessageVariableGroup[] = [];

  if (type === "FREE_SHIPPING_GOAL") {
    specific.push(freeShippingMessageVariables);
  } else if (type === "LOW_STOCK") {
    specific.push(lowStockMessageVariables);
  } else if (type === "DELIVERY_CUTOFF") {
    specific.push(deliveryCutoffMessageVariables);
  } else if (type === "PRODUCT_BADGE") {
    specific.push(badgeMessageVariables);
  } else {
    // COUNTDOWN_BAR, PRODUCT_TIMER, CART_TIMER — countdown-driven types.
    specific.push(timerMessageVariables);
  }

  return [globalMessageVariables, ...specific];
}

function MessageVariablesInfo({ type }: { type: CampaignFormValues["type"] }) {
  const groups = messageVariableGroupsForType(type);

  return (
    <div className="counterpulse-info-copy">
      <p>
        Wrap a variable in double curly braces to insert live data into your
        headline, subheadline, CTA, or any other message. Unknown variables are
        left untouched.
      </p>

      {groups.length === 0 ? (
        <p className="counterpulse-message-variables__empty">
          This campaign type renders its copy exactly as written and does not
          support dynamic variables.
        </p>
      ) : (
        groups.map((group) => (
          <div className="counterpulse-message-variables" key={group.title}>
            <strong className="counterpulse-message-variables__title">
              {group.title}
            </strong>
            <p className="counterpulse-message-variables__desc">
              {group.description}
            </p>
            <ul className="counterpulse-message-variables__list">
              {group.variables.map((variable) => (
                <li key={variable.token}>
                  <code>{variable.token}</code>
                  <span>{variable.description}</span>
                  <em>
                    renders as <b>{variable.example}</b>
                  </em>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
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

function CartRescueReasonIcon({ reason }: { reason: CartRescueReasonValue }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="22"
      viewBox="0 0 24 24"
      width="22"
    >
      {reason === "CART_RESERVED" && (
        <>
          <path
            d="M5 5h2l2 10h8l2-7H8"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M9 19h8m-4-6v-3m0 0-1.5 1.5M13 10l1.5 1.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {reason === "CHECKOUT_REMINDER" && (
        <>
          <path
            d="M5 5h14v14H5V5Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="m8 12 2.5 2.5L16 9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </>
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

// Badge placements render a small badge over product media, while every other
// surface renders a banner/card. A single design can't be tuned well for both,
// so we warn the merchant to split them into separate campaigns.
const badgePlacementTypes: PlacementTypeValue[] = [
  "PRODUCT_PAGE_BADGE",
  "COLLECTION_CARD",
];

function getIncompatiblePlacementWarning(placements: PlacementTypeValue[]) {
  const badge = placements.filter((placement) =>
    badgePlacementTypes.includes(placement),
  );
  const nonBadge = placements.filter(
    (placement) => !badgePlacementTypes.includes(placement),
  );

  if (badge.length === 0 || nonBadge.length === 0) return null;

  const labelFor = (placement: PlacementTypeValue) =>
    placementTypeOptions.find((option) => option.value === placement)?.label ??
    placement;

  return {
    badgeLabels: badge.map(labelFor),
    nonBadgeLabels: nonBadge.map(labelFor),
  };
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
  campaignType?: CampaignFormValues["type"],
): PreviewPlacement {
  if (campaignType === "PRODUCT_BADGE") return "PRODUCT_BADGE";
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

const campaignErrorFieldLabels: Partial<
  Record<keyof CampaignFormValues, string>
> = {
  badgePosition: "Badge position",
  badgeShape: "Badge shape",
  badgeText: "Badge text",
  cartRescueReason: "Cart rescue reason",
  cartRescueShowButton: "Cart rescue button",
  cartRescueShowTimer: "Cart rescue timer",
  cartRescueTimerStart: "Cart rescue countdown start",
  cartRescueArmBeforeStart: "Cart rescue arm before start",
  cartTimerDurationMinutes: "Cart timer minutes",
  collectionIds: "Collections",
  countries: "Countries",
  ctaText: "CTA text",
  ctaUrl: "CTA URL",
  customSelector: "Custom selector",
  customStyle: "Custom placement style",
  deliveryAfterCutoffBehavior: "After cutoff behavior",
  deliveryCutoffHour: "Cutoff hour",
  deliveryCutoffMinute: "Cutoff minute",
  deliveryMaxDays: "Maximum delivery days",
  deliveryMinDays: "Minimum delivery days",
  deliveryProcessingDays: "Processing days",
  deliveryWorkingDays: "Fulfillment days",
  endsAt: "End date",
  excludeProductIds: "Excluded products",
  excludedUrlContains: "Excluded URLs",
  expiredText: "Expired text",
  freeShippingAutoDiscount: "Automatic free shipping",
  freeShippingCurrencyCode: "Free shipping currency",
  freeShippingDiscountCode: "Free shipping discount code",
  freeShippingExistingDiscount: "Existing free shipping discount",
  freeShippingDiscountTitle: "Free shipping discount title",
  freeShippingEmptyCartMessage: "Empty cart message",
  freeShippingSuccessMessage: "Success message",
  freeShippingThresholdAmount: "Free shipping threshold",
  headline: "Headline",
  lowStockFallbackMessage: "Low stock fallback message",
  lowStockThreshold: "Low stock threshold",
  name: "Campaign name",
  placementType: "Campaign placement",
  placementTypes: "Campaign placements",
  productIds: "Products",
  productTags: "Product tags",
  startsAt: "Start date",
  status: "Campaign status",
  subheadline: "Subheadline",
  timerDurationMinutes: "Timer minutes",
  timerExpiredBehavior: "After expiration",
  timerRecurringHour: "Recurring time",
  timezone: "Timezone",
  urlContains: "Included URLs",
};

function buildCampaignErrorSummary(
  errors: CampaignFormErrors,
  translationErrors?: CampaignTranslationFormErrors,
) {
  const messages: string[] = [];
  const seenMessages = new Set<string>();
  const pushMessage = (message: unknown, label?: string) => {
    if (typeof message !== "string") return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const summaryMessage = label
      ? `${label}: ${trimmedMessage}`
      : trimmedMessage;

    if (seenMessages.has(summaryMessage)) return;

    seenMessages.add(summaryMessage);
    messages.push(summaryMessage);
  };

  pushMessage(errors.form);
  Object.entries(errors).forEach(([field, message]) => {
    if (field === "form") return;

    pushMessage(message, getCampaignErrorFieldLabel(field));
  });

  pushMessage(translationErrors?.form, "Messages");
  Object.entries(translationErrors?.locales ?? {}).forEach(
    ([locale, localeErrors]) => {
      const localeLabel = getStorefrontLocaleLabel(locale);

      Object.entries(localeErrors ?? {}).forEach(([field, message]) => {
        pushMessage(
          message,
          `${localeLabel} ${getCampaignTranslationErrorFieldLabel(field)}`,
        );
      });
    },
  );

  return messages;
}

function getCampaignErrorFieldLabel(field: string) {
  return (
    campaignErrorFieldLabels[field as keyof CampaignFormValues] ??
    humanizeFieldName(field)
  );
}

function getCampaignTranslationErrorFieldLabel(field: string) {
  return (
    campaignTranslationFields.find((option) => option.key === field)?.label ??
    humanizeFieldName(field)
  );
}

function humanizeFieldName(field: string) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (firstCharacter) => firstCharacter.toUpperCase());
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
  localeOptions,
  values,
  translations,
}: {
  localeOptions: readonly StorefrontLocaleOption[];
  values: CampaignFormValues;
  translations?: CampaignTranslationsByLocale;
}) {
  return (
    <>
      <input name="headline" type="hidden" value={values.headline} />
      <input name="subheadline" type="hidden" value={values.subheadline} />
      <input name="ctaText" type="hidden" value={values.ctaText} />
      <input name="ctaUrl" type="hidden" value={values.ctaUrl} />
      <input name="expiredText" type="hidden" value={values.expiredText} />
      {translations
        ? localeOptions.flatMap((localeOption) => [
            <input
              key={`${localeOption.locale}-locale`}
              name="translationLocale"
              type="hidden"
              value={localeOption.locale}
            />,
            ...campaignTranslationFields.map((field) => (
              <input
                key={`${localeOption.locale}-${field.key}`}
                name={translationInputName(localeOption.locale, field.key)}
                type="hidden"
                value={translations[localeOption.locale]?.[field.key] ?? ""}
              />
            )),
          ])
        : null}
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
