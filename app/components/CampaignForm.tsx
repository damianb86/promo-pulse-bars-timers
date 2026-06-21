import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
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
  buildCampaignTimerSettingsValues,
  emptyCampaignTargetingOptions,
  splitCampaignList,
} from "../types/campaign-form";
import { buildCampaignViewModel } from "../utils/campaign-view-model";

type CampaignFormProps = {
  campaignId?: string;
  confirmOnSubmit?: boolean;
  design?: CampaignDesignValues;
  designHiddenInputs?: ReactNode;
  values: CampaignFormValues;
  errors?: CampaignFormErrors;
  formId?: string;
  hiddenBuilderTabs?: BuilderTabKey[];
  idPrefix?: string;
  initialTab?: BuilderTabKey;
  topbarActions?: ReactNode;
  lockedTargetingFeatures?: {
    advanced: string;
    basic: string;
    geo: string;
    recurringTimers?: string;
    scheduling?: string;
  };
  listenForSaveEvents?: boolean;
  mode: "create" | "edit";
  showBuilderTabs?: boolean;
  showPreview?: boolean;
  showTopbar?: boolean;
  syncExternalValues?: boolean;
  targetingOptions?: CampaignTargetingOptions;
  onDesignChange?: (values: CampaignDesignValues) => void;
  onValuesChange?: (values: CampaignFormValues) => void;
};

type ResourceFieldName = "productIds" | "excludeProductIds" | "collectionIds";

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
      "Define the campaign goal, status, and promotion type before editing copy or placements.",
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
        contentMaxWidth: 420,
        fullWidth: false,
        icon: "TRUCK",
        layout: "STANDARD",
        paddingBlock: 12,
        paddingInline: 14,
        positionMode: "FLOW",
        positionSticky: false,
        showButton: false,
        showIcon: true,
        timerFormat: "UNITS",
        timerShowLabels: true,
        timerStyle: "PLAIN",
      },
      form: {
        timerDurationMinutes: "120",
        timerExpiredBehavior: "HIDE_TIMER",
        timerMode: "EVERGREEN_SESSION",
        timerResetBehavior: "ON_SESSION_END",
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

export function CampaignForm({
  campaignId,
  confirmOnSubmit = true,
  design = defaultCampaignDesignValues,
  designHiddenInputs,
  values,
  errors = {},
  formId,
  hiddenBuilderTabs = [],
  idPrefix = "campaign",
  initialTab = "setup",
  listenForSaveEvents = true,
  lockedTargetingFeatures,
  mode,
  showBuilderTabs = true,
  showPreview = true,
  showTopbar = true,
  syncExternalValues = false,
  targetingOptions = emptyCampaignTargetingOptions,
  topbarActions,
  onDesignChange,
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
  const activeTypeLabel =
    campaignTypeOptions.find((option) => option.value === formValues.type)
      ?.label ?? "Countdown bar";
  const activePlacementLabel = formatPlacementSelectionLabel(
    formValues.placementTypes,
  );
  const activeTabMeta =
    visibleBuilderTabs.find((tab) => tab.key === activeTab) ??
    visibleBuilderTabs[0];
  const selectedProductTags = splitCampaignList(formValues.productTags);
  const selectedCountries = splitCampaignList(formValues.countries).map(
    (country) => country.toUpperCase(),
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
    ? `<div class="pp-campaign-slot" data-counterpulse-campaign-id="${campaignId}"></div>`
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
      }),
    [activeGoalLabel, effectiveDesign, formValues],
  );
  const summaryRows = useMemo(
    () => [
      ["Goal", activeGoalLabel],
      ["Type", activeTypeLabel],
      ["Placement", activePlacementLabel],
      ["Status", statusLabel],
      ["Starts", formatDateTimeLabel(formValues.startsAt, "Immediately")],
      ["Ends", formatDateTimeLabel(formValues.endsAt, "No fixed end")],
      ["Timezone", formValues.timezone || "UTC"],
    ],
    [
      activeGoalLabel,
      activePlacementLabel,
      activeTypeLabel,
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

  const selectCampaignType = (type: CampaignTypeValue) => {
    const preset = campaignTypeSetupPresets[type];

    setFormValues((currentValues) =>
      applySetupPreset(
        {
          ...currentValues,
          type,
          goal: preset.goal ?? currentValues.goal,
        },
        preset,
      ),
    );
    updateDesignValues(applyDesignSetupPreset(effectiveDesign, preset.design));
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

  const setListField = (
    field: ResourceFieldName | "productTags" | "countries",
    items: string[],
  ) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: items.join("\n"),
    }));
  };

  const setManualListField =
    (field: ResourceFieldName | "productTags" | "countries") =>
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
      multiple: true,
      selectionIds: splitCampaignList(formValues[field]).map((id) => ({ id })),
      type,
    });

    if (!selected) return;

    const chips = selected
      .map((resource) => ({
        id: resource.id ?? "",
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

  const selectGoal = (goal: CampaignFormValues["goal"]) => {
    const preset = campaignGoalSetupPresets[goal];

    setFormValues((currentValues) =>
      applySetupPreset(
        {
          ...currentValues,
          goal,
          type: preset.type ?? currentValues.type,
        },
        preset,
      ),
    );
    updateDesignValues(applyDesignSetupPreset(effectiveDesign, preset.design));
  };

  const updateDesignValues = (nextDesign: CampaignDesignValues) => {
    if (onDesignChange) {
      onDesignChange(nextDesign);
      return;
    }

    setLocalDesignValues(nextDesign);
  };

  useEffect(() => {
    if (!onDesignChange) {
      const syncDesign = window.setTimeout(() => {
        setLocalDesignValues(design);
      }, 0);

      return () => window.clearTimeout(syncDesign);
    }

    return undefined;
  }, [design, onDesignChange]);

  useEffect(() => {
    onValuesChange?.(formValues);
  }, [formValues, onValuesChange]);

  useEffect(() => {
    if (!syncExternalValues) return;

    setFormValues(values);
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

    window.addEventListener("counterpulse:campaign-save", handleSaveRequest);
    window.addEventListener(
      "counterpulse:campaign-publish",
      handlePublishRequest,
    );
    window.addEventListener(
      "counterpulse:campaign-discard",
      handleDiscardRequest,
    );

    return () => {
      window.removeEventListener(
        "counterpulse:campaign-save",
        handleSaveRequest,
      );
      window.removeEventListener(
        "counterpulse:campaign-publish",
        handlePublishRequest,
      );
      window.removeEventListener(
        "counterpulse:campaign-discard",
        handleDiscardRequest,
      );
    };
  }, [listenForSaveEvents, values]);

  useEffect(() => {
    if (!visibleBuilderTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleBuilderTabs[0].key);
    }
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

    window.addEventListener(
      "counterpulse:campaign-review",
      handleReviewRequest,
    );
    window.addEventListener(
      "counterpulse:ai-suggestion-json",
      handleAiSuggestionJson,
    );

    return () => {
      window.removeEventListener(
        "counterpulse:campaign-review",
        handleReviewRequest,
      );
      window.removeEventListener(
        "counterpulse:ai-suggestion-json",
        handleAiSuggestionJson,
      );
    };
  }, [visibleBuilderTabs]);

  const canReview = visibleBuilderTabs.some((tab) => tab.key === "review");
  const shouldShowBuilderTabs =
    showBuilderTabs && visibleBuilderTabs.length > 1;

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
              <span>{statusLabel}</span>
              <span>{activeGoalLabel}</span>
              <span>{activePlacementLabel}</span>
            </div>
            <div className="counterpulse-create-actions">
              {topbarActions}
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
                aria-controls={`campaign-builder-panel-${tab.key}`}
                aria-selected={activeTab === tab.key}
                className={activeTab === tab.key ? "is-active" : undefined}
                id={`campaign-builder-tab-${tab.key}`}
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

            <BuilderPanel activeTab={activeTab} tabKey="setup">
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
                  error={errors.type}
                  fullWidth
                  info={
                    <FieldInfoButton
                      label="Campaign type"
                      title="Campaign types"
                    >
                      <CampaignInfoContent
                        intro="Campaign type changes what Promo Pulse renders and which extra configuration panels matter."
                        items={[
                          [
                            "Countdown bar",
                            "A top or bottom urgency bar with timer and CTA. Best for sitewide sales or announcements.",
                          ],
                          [
                            "Product timer",
                            "A timer intended for product pages. Use it when urgency belongs to a product offer.",
                          ],
                          [
                            "Cart timer",
                            "A cart or drawer timer. Use it for cart rescue, checkout urgency, or short-lived cart offers.",
                          ],
                          [
                            "Free shipping goal",
                            "Shows cart progress toward a real threshold. It enables the free-shipping settings panel.",
                          ],
                          [
                            "Delivery cutoff",
                            "Shows delivery timing based on a real cutoff hour and timezone. It enables delivery settings.",
                          ],
                          [
                            "Low stock message",
                            "Displays urgency based on real inventory data when available. It does not create fake stock.",
                          ],
                          [
                            "Product badge",
                            "Renders product or collection badges and enables merchandising badge settings.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
                  <div className="counterpulse-goal-list" role="radiogroup">
                    {campaignTypeOptions.map((option) => (
                      <button
                        aria-checked={formValues.type === option.value}
                        className="counterpulse-goal-card"
                        key={option.value}
                        role="radio"
                        type="button"
                        onClick={() => selectCampaignType(option.value)}
                      >
                        <input
                          checked={formValues.type === option.value}
                          type="radio"
                          name="type"
                          value={option.value}
                          onChange={() => selectCampaignType(option.value)}
                        />
                        <span
                          className="counterpulse-goal-card__icon"
                          aria-hidden="true"
                        >
                          <CampaignTypeIcon type={option.value} />
                        </span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </FormGroup>

                <FormGroup
                  label="Goal"
                  error={errors.goal}
                  fullWidth
                  info={
                    <FieldInfoButton label="Goal" title="Campaign goals">
                      <CampaignInfoContent
                        intro="Goal describes the merchant intent. It helps defaults, preview text, analytics grouping, and recommendations."
                        items={[
                          [
                            "Flash sale",
                            "Short-lived offer focused on urgency, usually with a timer and sale CTA.",
                          ],
                          [
                            "Free shipping",
                            "Motivates shoppers to reach a real shipping threshold. Pair it with cart placements.",
                          ],
                          [
                            "Cart rescue",
                            "Targets shoppers with cart intent using cart or drawer placements.",
                          ],
                          [
                            "Delivery cutoff",
                            "Communicates order-by timing using actual cutoff settings.",
                          ],
                          [
                            "Low stock urgency",
                            "Uses inventory context to message scarce items without inventing quantities.",
                          ],
                          [
                            "Product badge",
                            "Highlights product-level merchandising labels such as launch, sale, or limited offer.",
                          ],
                          [
                            "Announcement",
                            "General campaign message without a discount or scarcity assumption.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
                  <div className="counterpulse-goal-list" role="radiogroup">
                    {campaignGoalOptions.map((option) => (
                      <button
                        aria-checked={formValues.goal === option.value}
                        className="counterpulse-goal-card"
                        key={option.value}
                        role="radio"
                        type="button"
                        onClick={() => selectGoal(option.value)}
                      >
                        <input
                          checked={formValues.goal === option.value}
                          type="radio"
                          name="goal"
                          value={option.value}
                          onChange={() => selectGoal(option.value)}
                        />
                        <span
                          className="counterpulse-goal-card__icon"
                          aria-hidden="true"
                        >
                          <GoalIcon goal={option.value} />
                        </span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </FormGroup>
              </div>
            </BuilderPanel>

            <BuilderPanel activeTab={activeTab} tabKey="message">
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
            </BuilderPanel>

            <BuilderPanel activeTab={activeTab} tabKey="placement">
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
                        <span aria-hidden="true">
                          {placementInitial(option.label)}
                        </span>
                        <strong>{option.label}</strong>
                        {isSelected && <small>Selected</small>}
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
                      Custom selector
                    </h3>
                    <p>
                      Use this when the campaign should render in a theme
                      selector controlled by the app embed.
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
                        Promo Pulse will inject the timer inside this selector
                        when the app embed is active.
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

              <div className="counterpulse-timer-id-box">
                <div>
                  <span>Timer ID</span>
                  <code>{campaignId ?? "Available after save"}</code>
                </div>
                <button
                  aria-label="Copy timer ID"
                  type="button"
                  disabled={!campaignId}
                  onClick={copyTimerId}
                >
                  <CopyIcon />
                </button>
                {timerIdCopied && <small>Copied</small>}
                <p>
                  Countdown timer app blocks can use this ID to render this
                  exact campaign.
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
            </BuilderPanel>

            <BuilderPanel activeTab={activeTab} tabKey="targeting">
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

            <BuilderPanel activeTab={activeTab} tabKey="schedule">
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
                      error={errors.timerDurationMinutes}
                      fullWidth
                    >
                      <input
                        inputMode="numeric"
                        min={1}
                        max={10080}
                        name="timerDurationMinutes"
                        type="number"
                        value={formValues.timerDurationMinutes}
                        onChange={updateField("timerDurationMinutes")}
                      />
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

            <BuilderPanel activeTab={activeTab} tabKey="review">
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
                placement={campaignPreviewPlacement}
                viewModel={previewViewModel}
                onDeviceChange={setPreviewDevice}
                onPlacementChange={selectCampaignPreviewPlacement}
                meta={
                  <dl className="counterpulse-preview-meta">
                    <div>
                      <dt>Goal</dt>
                      <dd>{activeGoalLabel}</dd>
                    </div>
                    <div>
                      <dt>Type</dt>
                      <dd>{activeTypeLabel}</dd>
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

function BuilderPanel({
  activeTab,
  children,
  tabKey,
}: {
  activeTab: BuilderTabKey;
  children: ReactNode;
  tabKey: BuilderTabKey;
}) {
  return (
    <div
      aria-labelledby={`campaign-builder-tab-${tabKey}`}
      className="counterpulse-builder-panel"
      hidden={activeTab !== tabKey}
      id={`campaign-builder-panel-${tabKey}`}
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

function getShopifyBridge() {
  return (
    window as Window & {
      shopify?: {
        resourcePicker?: (options: {
          action?: "add" | "select";
          multiple?: boolean | number;
          selectionIds?: Array<{ id: string }>;
          type: ShopifyResourcePickerType;
        }) => Promise<ShopifyResourcePickerResult | undefined>;
      };
    }
  ).shopify;
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
