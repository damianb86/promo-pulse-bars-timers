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
  placementTypeOptions,
  type PlacementTypeValue,
} from "../types/campaign-options";
import { CampaignControlStatusBadge } from "./CampaignControlStatusBadge";
import {
  type CampaignDesignErrors,
  type CampaignDesignMediaOptions,
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
  getStorefrontLocaleOptions,
  type CampaignTranslationFormErrors,
  type CampaignTranslationsByLocale,
  type StorefrontLocale,
} from "../types/localization";
import {
  buildCampaignViewModel,
  type CampaignViewModel,
} from "../utils/campaign-view-model";
import {
  buildCampaignStructureTree,
  buildStructureCss,
  deriveCampaignStructureSpec,
  htmlToTree,
  type StructureNode,
} from "../utils/campaign-structure";
import { EditorTabIcon } from "./CampaignEditorLayout";
import {
  CampaignDesignEditor,
  type StructureFormPayload,
} from "./CampaignDesignEditor";
import { applyCampaignTypeDefaultTextValues } from "../utils/campaign-type-text-defaults";
import { deriveMobileDesignFromDesktop } from "../utils/responsive-design";
import type { CampaignSuggestion } from "../types/ai-campaign";
import { CustomMessagesEditor } from "./CustomMessagesEditor";
import {
  parseCustomMessages,
  serializeCustomMessages,
  type CustomMessage,
} from "../utils/custom-messages";
import {
  AiApplyValuesEventDetail,
  BuilderTabKey,
  CampaignTypeChoice,
  ResourceChip,
  ResourceFieldName,
  ShopifyResourcePickerType,
  TextListFieldName,
  UrlEligibilityMode,
  UrlPageTargetingToken,
  UrlTargetingFieldName,
  campaignGoalSetupPresets,
  campaignTypeChoiceOptions,
  campaignTypeSetupPresets,
  cartTimerResetBehaviorOptions,
  deliveryWeekdayOptions,
  timerExpiredBehaviorOptions,
  timerModeOptions,
  builderTabs,
} from "./campaign-form/constants";
import {
  BuilderPanel,
  CampaignInfoContent,
  CampaignMessageHiddenInputs,
  CampaignTypeIcon,
  CartRescueReasonIcon,
  CopyIcon,
  CountrySelectorField,
  FieldError,
  FormField,
  FormGroup,
  GoalIcon,
  MessageVariablesInfo,
  ResourcePickerField,
  ReviewSummary,
  buildReviewSections,
  TagSelectorField,
  TargetingRadioOption,
  UpgradeText,
  UrlPageTargetingPicker,
  applySetupPreset,
  buildCampaignErrorSummary,
  buildCampaignTypeDefaultTranslations,
  buildResourceChips,
  formatPlacementSelectionLabel,
  getCampaignTypeChoiceKey,
  getIncompatiblePlacementWarning,
  getInitialUrlEligibilityMode,
  getShopifyBridge,
  getUrlEligibilityModeFromValues,
  getVisibleFreeShippingDiscountCode,
  isFreeShippingCodeReference,
  isSelectableResourceId,
  manualUrlTargetingItems,
  manualUrlTargetingText,
  mergeUrlTargetingValue,
  normalizeSelectableResourceId,
  placementInitial,
  resolveCampaignTranslationValues,
  selectedUrlPageTargetingTokens,
  shortResourceId,
  toDateTimeLocalInputValue,
  toPreviewPlacement,
  toggleUrlPageTargetingToken,
  getTranslationValuesSignature,
} from "./campaign-form/fields";

type CampaignFormProps = {
  campaignId?: string;
  confirmOnSubmit?: boolean;
  // An AI suggestion that was applied before submitting. Passed back by the
  // create route on a save error so the form re-seeds its design + structure +
  // suggestion JSON instead of losing the whole AI-generated draft on remount.
  appliedAiSuggestion?: CampaignSuggestion | null;
  design?: CampaignDesignValues;
  designHiddenInputs?: ReactNode;
  // Full design editor rendered in a "Design" builder tab. When provided, the tab
  // appears; otherwise it's hidden (e.g. the edit page has its own Design tab).
  designSlot?: ReactNode;
  // Renders the built-in design editor in a "Design" tab bound to this form's
  // design state (used on the create page so design is editable before saving).
  showDesignEditor?: boolean;
  isProPlan?: boolean;
  designMediaOptions?: CampaignDesignMediaOptions;
  designErrors?: CampaignDesignErrors;
  lockedCustomCssReason?: string;
  mobileDesign?: CampaignDesignValues;
  // Saved structural HTML/CSS override so this preview renders the exact same
  // generated HTML the storefront uses (matches the Design tab preview).
  structureTree?: StructureNode | null;
  mobileStructureTree?: StructureNode | null;
  structureCss?: string;
  mobileStructureCss?: string;
  structureEdited?: boolean;
  structureHtml?: string;
  mobileStructureEdited?: boolean;
  mobileStructureHtml?: string;
  // Saved custom-message snippets (JSON array of {id, text}) placed in the custom
  // HTML via data-cp-slot="custom-<id>". Edited in the Message tab.
  structureMessages?: string;
  // Fires whenever the merchant edits the custom messages, so a separately
  // rendered design/structure preview (campaign editor route) can fill the
  // data-cp-slot="custom-<id>" slots with the live text instead of the last
  // saved value.
  onCustomMessagesChange?: (messages: CustomMessage[]) => void;
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
  previewDevice?: PreviewDevice;
  previewPlacement?: PreviewPlacement;
  previewViewModel?: CampaignViewModel;
  showBuilderTabs?: boolean;
  showPreview?: boolean;
  showTopbar?: boolean;
  syncExternalValues?: boolean;
  targetingOptions?: CampaignTargetingOptions;
  topbarActions?: ReactNode;
  onDesignChange?: (values: CampaignDesignValues) => void;
  onMobileDesignChange?: (values: CampaignDesignValues) => void;
  onPreviewDeviceChange?: (device: PreviewDevice) => void;
  onPreviewPlacementChange?: (placement: PreviewPlacement) => void;
  onValuesChange?: (values: CampaignFormValues) => void;
};

export function CampaignForm({
  campaignId,
  confirmOnSubmit = true,
  appliedAiSuggestion = null,
  design = defaultCampaignDesignValues,
  designHiddenInputs,
  designSlot,
  showDesignEditor = false,
  isProPlan = false,
  designMediaOptions,
  designErrors,
  lockedCustomCssReason,
  mobileDesign = design,
  structureTree = null,
  mobileStructureTree = null,
  structureCss = "",
  mobileStructureCss = "",
  structureEdited = false,
  structureHtml = "",
  mobileStructureEdited = false,
  mobileStructureHtml = "",
  structureMessages: initialStructureMessages = "",
  onCustomMessagesChange,
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
  previewDevice: controlledPreviewDevice,
  previewPlacement: controlledPreviewPlacement,
  previewViewModel: controlledPreviewViewModel,
  showBuilderTabs = true,
  showPreview = true,
  showTopbar = true,
  syncExternalValues = false,
  targetingOptions = emptyCampaignTargetingOptions,
  topbarActions,
  onDesignChange,
  onMobileDesignChange,
  onPreviewDeviceChange,
  onPreviewPlacementChange,
  onValuesChange,
}: CampaignFormProps) {
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement | null>(null);
  // Top-level section (only when the built-in design editor is enabled): the
  // campaign builder vs the Design editor, shown as separate top tabs like the
  // edit page.
  const [topSection, setTopSection] = useState<"campaign" | "design">(
    "campaign",
  );
  const campaignSectionActive = !showDesignEditor || topSection === "campaign";
  // Structure overrides lifted from the built-in design editor so they persist
  // with the form regardless of the active section.
  const [designStructureForm, setDesignStructureForm] =
    useState<StructureFormPayload | null>(null);
  const hiddenBuilderTabSet = useMemo(
    () => new Set(hiddenBuilderTabs),
    [hiddenBuilderTabs],
  );
  const visibleBuilderTabs = useMemo(() => {
    const tabs = builderTabs.filter(
      (tab) =>
        !hiddenBuilderTabSet.has(tab.key) &&
        // Design is shown as a top-level section (showDesignEditor), not a
        // builder tab. A raw designSlot still renders it as a builder tab.
        (tab.key !== "design" || Boolean(designSlot)),
    );

    return tabs.length > 0 ? tabs : builderTabs;
  }, [hiddenBuilderTabSet, designSlot]);
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
  const [localPreviewDevice, setLocalPreviewDevice] =
    useState<PreviewDevice>("desktop");
  const [
    campaignPreviewPlacementOverride,
    setCampaignPreviewPlacementOverride,
  ] = useState<{
    key: string;
    placement: PreviewPlacement;
  } | null>(null);
  const previewDevice = controlledPreviewDevice ?? localPreviewDevice;
  const updatePreviewDevice = (nextDevice: PreviewDevice) => {
    if (onPreviewDeviceChange) onPreviewDeviceChange(nextDevice);
    else setLocalPreviewDevice(nextDevice);
  };
  const [formValues, setFormValues] = useState(() => values);
  const [localMessageTranslations, setLocalMessageTranslations] = useState(
    () => messageTranslations,
  );
  const messageTranslationsRef = useRef(messageTranslations);
  const messageTranslationsSignature = messageTranslations
    ? getTranslationValuesSignature(messageTranslations, messageLocaleOptions)
    : "";
  // When a previously applied AI suggestion is passed back (after a save error),
  // seed the design + suggestion JSON from it so the draft survives the remount.
  const [localDesignValues, setLocalDesignValues] = useState(
    () => appliedAiSuggestion?.design ?? design,
  );
  const [localMobileDesignValues, setLocalMobileDesignValues] = useState(
    () => appliedAiSuggestion?.design ?? mobileDesign,
  );
  const [submitAction, setSubmitAction] = useState("saveDraft");
  const submitActionInputRef = useRef<HTMLInputElement | null>(null);
  const [aiSuggestionJson, setAiSuggestionJson] = useState(() =>
    appliedAiSuggestion ? JSON.stringify(appliedAiSuggestion) : "",
  );
  // Custom reusable message snippets (Message tab), placed in the custom HTML.
  const [customMessages, setCustomMessages] = useState<CustomMessage[]>(() =>
    parseCustomMessages(initialStructureMessages),
  );
  const handleCustomMessagesChange = useCallback(
    (next: CustomMessage[]) => {
      setCustomMessages(next);
      onCustomMessagesChange?.(next);
    },
    [onCustomMessagesChange],
  );
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
  // After an AI suggestion is applied (before the campaign is saved) the
  // structural HTML/CSS lives only in the suggestion JSON, so derive the preview
  // structure from it; otherwise fall back to the saved structure props.
  const aiStructure = useMemo(() => {
    if (!aiSuggestionJson) return null;
    try {
      const parsed = JSON.parse(aiSuggestionJson) as {
        structureHtml?: string;
        structureCss?: string;
      };
      if (typeof parsed.structureHtml !== "string" || !parsed.structureHtml) {
        return null;
      }
      return {
        html: parsed.structureHtml,
        tree: htmlToTree(parsed.structureHtml),
        css: typeof parsed.structureCss === "string" ? parsed.structureCss : "",
      };
    } catch {
      return null;
    }
  }, [aiSuggestionJson]);
  // Live structural edits made in the Design tab (lifted here via
  // onStructureChange). The Campaign-tab preview must reflect them too so BOTH
  // previews always render the exact same thing.
  const liveDesignStructure = useMemo(() => {
    if (
      designStructureForm?.structureEdited &&
      designStructureForm.structureHtml
    ) {
      return {
        html: designStructureForm.structureHtml,
        tree: htmlToTree(designStructureForm.structureHtml),
        css: designStructureForm.structureCss,
      };
    }
    return null;
  }, [designStructureForm]);
  const propStructure = useMemo(() => {
    if (!structureEdited || !structureHtml) return null;
    return {
      html: structureHtml,
      tree: htmlToTree(structureHtml),
      css: structureCss,
    };
  }, [structureCss, structureEdited, structureHtml]);
  const propMobileStructure = useMemo(() => {
    if (!mobileStructureEdited || !mobileStructureHtml) return null;
    return {
      html: mobileStructureHtml,
      tree: htmlToTree(mobileStructureHtml),
      css: mobileStructureCss,
    };
  }, [mobileStructureCss, mobileStructureEdited, mobileStructureHtml]);
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
    controlledPreviewPlacement ??
    (campaignPreviewPlacementOverride?.key === campaignPreviewPlacementKey
      ? campaignPreviewPlacementOverride.placement
      : defaultCampaignPreviewPlacement);
  const selectCampaignPreviewPlacement = (nextPlacement: PreviewPlacement) => {
    if (onPreviewPlacementChange) {
      onPreviewPlacementChange(nextPlacement);
    } else {
      setCampaignPreviewPlacementOverride({
        key: campaignPreviewPlacementKey,
        placement: nextPlacement,
      });
    }
  };
  const computedPreviewViewModel = useMemo(
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
  const previewViewModel =
    controlledPreviewViewModel ?? computedPreviewViewModel;
  const generatedStructureTree = useMemo(
    () =>
      buildCampaignStructureTree(
        deriveCampaignStructureSpec(
          previewViewModel,
          effectiveDesign,
          "block",
          campaignPreviewPlacement,
        ),
      ),
    [campaignPreviewPlacement, effectiveDesign, previewViewModel],
  );
  const generatedStructureCss = useMemo(
    () => buildStructureCss(effectiveDesign),
    [effectiveDesign],
  );
  const generatedMobileStructureTree = useMemo(
    () =>
      buildCampaignStructureTree(
        deriveCampaignStructureSpec(
          previewViewModel,
          effectiveMobileDesign,
          "block",
          campaignPreviewPlacement,
        ),
      ),
    [campaignPreviewPlacement, effectiveMobileDesign, previewViewModel],
  );
  const generatedMobileStructureCss = useMemo(
    () => buildStructureCss(effectiveMobileDesign),
    [effectiveMobileDesign],
  );
  const previewStructureTree =
    liveDesignStructure?.tree ??
    aiStructure?.tree ??
    propStructure?.tree ??
    structureTree ??
    generatedStructureTree;
  const hasStructureOverride = Boolean(
    liveDesignStructure || aiStructure || propStructure || structureTree,
  );
  const previewMobileStructureTree =
    propMobileStructure?.tree ??
    mobileStructureTree ??
    (hasStructureOverride ? null : generatedMobileStructureTree);
  const previewStructureCss = liveDesignStructure
    ? liveDesignStructure.css
    : aiStructure
      ? aiStructure.css
      : propStructure
        ? propStructure.css
        : structureTree
          ? structureCss
          : generatedStructureCss;
  const previewMobileStructureCss =
    propMobileStructure || mobileStructureTree || !hasStructureOverride
      ? propMobileStructure?.css ||
        mobileStructureCss ||
        generatedMobileStructureCss
      : "";
  const errorSummaryMessages = useMemo(
    () => buildCampaignErrorSummary(errors, messageTranslationErrors),
    [errors, messageTranslationErrors],
  );
  const reviewSections = useMemo(
    () =>
      buildReviewSections(formValues, {
        typeLabel: activeCampaignTypeLabel,
        placementLabel: activePlacementLabel,
        statusLabel,
      }),
    [formValues, activeCampaignTypeLabel, activePlacementLabel, statusLabel],
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
      // Start date controls when the campaign begins showing and is independent
      // of the timer mode, so it is preserved across mode changes. End date is
      // the fixed-date countdown target, so it only applies to FIXED_DATE.
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
        <input name="forceDesignSave" type="hidden" value="false" />
        {designHiddenInputs}
        {showDesignEditor && !designHiddenInputs && (
          <>
            <input
              name="mobileDesignJson"
              type="hidden"
              value={JSON.stringify(effectiveMobileDesign)}
            />
            {Object.entries(effectiveDesign).map(([key, value]) => (
              <input key={key} name={key} type="hidden" value={String(value)} />
            ))}
            {/* Structure overrides lifted from the design editor, at form level so
                they submit from any section. */}
            {designStructureForm && (
              <>
                <input
                  name="structureEdited"
                  type="hidden"
                  value={designStructureForm.structureEdited ? "true" : "false"}
                />
                <input
                  name="structureHtml"
                  type="hidden"
                  value={designStructureForm.structureHtml}
                />
                <input
                  name="structureCss"
                  type="hidden"
                  value={designStructureForm.structureCss}
                />
                <input
                  name="mobileStructureEdited"
                  type="hidden"
                  value={
                    designStructureForm.mobileStructureEdited ? "true" : "false"
                  }
                />
                <input
                  name="mobileStructureHtml"
                  type="hidden"
                  value={designStructureForm.mobileStructureHtml}
                />
                <input
                  name="mobileStructureCss"
                  type="hidden"
                  value={designStructureForm.mobileStructureCss}
                />
              </>
            )}
          </>
        )}

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

        {showDesignEditor && (
          <div
            className="counterpulse-editor-tabs"
            aria-label="Campaign sections"
            role="tablist"
          >
            <button
              aria-selected={topSection === "campaign"}
              aria-label="Campaign"
              className={topSection === "campaign" ? "is-active" : undefined}
              role="tab"
              type="button"
              onClick={() => setTopSection("campaign")}
            >
              <EditorTabIcon sectionKey="campaign" />
              <span>Campaign</span>
            </button>
            <button
              aria-selected={topSection === "design"}
              aria-label="Design"
              className={topSection === "design" ? "is-active" : undefined}
              role="tab"
              type="button"
              onClick={() => setTopSection("design")}
            >
              <EditorTabIcon sectionKey="design" />
              <span>Design</span>
            </button>
          </div>
        )}

        {/* Kept mounted (only visually hidden) when the Design sub-section is
            active so every campaign field — including the required name — still
            submits with the form instead of being dropped. */}
        <div hidden={!campaignSectionActive}>
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
                  <h2 id={scopedId("builder-heading")}>
                    {activeTabMeta.title}
                  </h2>
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
                  <FormField
                    label="Campaign name"
                    error={errors.name}
                    fullWidth
                  >
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
                                  onClick={() =>
                                    selectCampaignTypeChoice(option)
                                  }
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
                                  option.disabledFeature ===
                                    "recurringTimers" && recurringTimersLocked,
                                )}
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Start date" error={errors.startsAt}>
                          <input
                            type="datetime-local"
                            value={formValues.startsAt}
                            onChange={updateField("startsAt")}
                          />
                        </FormField>

                        {formValues.timerMode === "FIXED_DATE" ? (
                          <FormField
                            label="End date"
                            error={errors.countdownTo}
                          >
                            <input
                              type="datetime-local"
                              value={formValues.countdownTo}
                              onChange={updateField("countdownTo")}
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
                          Configure the cart subtotal goal used by the
                          storefront progress bar. Optional discount sync
                          creates or links a real Shopify free-shipping code
                          with the same threshold.
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
                            onChange={updateField(
                              "freeShippingThresholdAmount",
                            )}
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
                            onChange={updateField(
                              "freeShippingEmptyCartMessage",
                            )}
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
                          threshold. Checkout applies it without requiring a
                          code.
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
                                  is code based and you want to promote that
                                  code.
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
                          Pulse only enables reasons backed by current
                          storefront data, so it will not claim real inventory,
                          price, or discount expiry unless that connection
                          exists.
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
                              onClick={() =>
                                selectCartRescueReason(option.value)
                              }
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

                        <FormField
                          label="Subheadline"
                          error={errors.subheadline}
                        >
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
                                onChange={updateField(
                                  "cartTimerDurationMinutes",
                                )}
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
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
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
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
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
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
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
                                    checked={
                                      formValues.cartRescueArmBeforeStart
                                    }
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
                                    Show the offer before the discount is
                                    applied (timer stays hidden until then)
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
                      aria-labelledby={scopedId(
                        "delivery-cutoff-setup-heading",
                      )}
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
                            onChange={updateField(
                              "deliveryAfterCutoffBehavior",
                            )}
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

                        <FormField
                          label="Position"
                          error={errors.badgePosition}
                        >
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
                    Use dynamic variables inside any message and they are
                    replaced live on the storefront.
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
                    <FormField
                      label="Headline"
                      error={errors.headline}
                      fullWidth
                    >
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
                  <div className="counterpulse-message-addon">
                    {messageAddon}
                  </div>
                )}
                <CustomMessagesEditor
                  value={customMessages}
                  onChange={handleCustomMessagesChange}
                />
                <input
                  type="hidden"
                  name="structureMessages"
                  value={serializeCustomMessages(customMessages)}
                />
              </BuilderPanel>

              {designSlot && (
                <BuilderPanel
                  activeTab={activeTab}
                  panelId={builderPanelId("design")}
                  shouldRender={visibleBuilderTabSet.has("design")}
                  tabId={builderTabId("design")}
                  tabKey="design"
                >
                  {designSlot}
                </BuilderPanel>
              )}

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
                      be eligible to render. The first selected placement is
                      used as the default preview surface.
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
                          banner or card. A single design can&apos;t be tuned
                          well for both shapes.
                        </p>
                        <p>
                          Create one campaign for the badge placements and
                          another for the rest so each design fits its surface
                          correctly.
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
                          Pulse uses the first matching selector as the
                          injection target when the app embed is active.
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
                        Choose which products can show this campaign. Use
                        Shopify pickers for product and collection targeting, or
                        target tags by search.
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
                          onRemove={(id) =>
                            removeResourceChip("productIds", id)
                          }
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
                        Select common Shopify page types or add custom
                        storefront paths. Include rules limit where the campaign
                        can render; exclude rules always prevent rendering.
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
                            urlEligibilityMode === "include"
                              ? "is-selected"
                              : ""
                          }
                          type="button"
                          onClick={() => selectUrlEligibilityMode("include")}
                        >
                          Include pages
                        </button>
                        <button
                          aria-pressed={urlEligibilityMode === "exclude"}
                          className={
                            urlEligibilityMode === "exclude"
                              ? "is-selected"
                              : ""
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
                              {lockReason && (
                                <UpgradeText reason={lockReason} />
                              )}
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

                    {/* Start date — when the campaign begins showing. Applies to
                        every timer mode and is auto-filled from the discount
                        schedule (Offers → Schedule and limits) when date sync is
                        on. */}
                    <div className="counterpulse-schedule-card__group counterpulse-schedule-start-options">
                      <label className="counterpulse-radio counterpulse-radio--stacked">
                        <input
                          aria-label="Show right now"
                          checked={!formValues.startsAt}
                          name="timerStartsMode"
                          type="radio"
                          value="NOW"
                          onChange={() => selectTimerStart("NOW")}
                        />
                        <span>
                          <strong>Show right now</strong>
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
                          aria-label="Schedule a start date"
                          checked={Boolean(formValues.startsAt)}
                          disabled={Boolean(schedulingLocked)}
                          name="timerStartsMode"
                          type="radio"
                          value="SCHEDULED"
                          onChange={() => selectTimerStart("SCHEDULED")}
                        />
                        <span>
                          <strong>Schedule a start date</strong>
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

                    {formValues.timerMode === "FIXED_DATE" ? (
                      <>
                        {/* Dedicated countdown target — the date the timer
                            counts down to, independent of the campaign's
                            visibility start/end. Defaults to the End date when
                            left empty. */}
                        <FormField
                          label="Countdown to date/time"
                          error={errors.countdownTo}
                          fullWidth
                        >
                          <input
                            type="datetime-local"
                            name="countdownTo"
                            value={formValues.countdownTo}
                            onChange={updateField("countdownTo")}
                          />
                        </FormField>
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
                          name="countdownTo"
                          type="hidden"
                          value={formValues.countdownTo}
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
                <p className="counterpulse-review-subtitle">
                  Everything below is what Promo Pulse will save and render for
                  this campaign.
                </p>

                {errorSummaryMessages.length > 0 && (
                  <div className="counterpulse-review-issues" role="alert">
                    <strong>Resolve before publishing</strong>
                    <ul>
                      {errorSummaryMessages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <ReviewSummary sections={reviewSections} />

                <div className="counterpulse-validation-strip">
                  {[
                    ["No fake scarcity", "Copy must match real offer data."],
                    ["Discount synced", "Use real discount rules after save."],
                    [
                      "Timer matches offer",
                      "Countdown should mirror schedule.",
                    ],
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
                  structureTree={previewStructureTree}
                  mobileStructureTree={previewMobileStructureTree}
                  structureCss={previewStructureCss}
                  mobileStructureCss={previewMobileStructureCss}
                  customMessages={customMessages}
                  viewModel={previewViewModel}
                  onDeviceChange={updatePreviewDevice}
                  onPlacementChange={selectCampaignPreviewPlacement}
                />
              </aside>
            )}
          </div>
        </div>

        {showDesignEditor && topSection === "design" && (
          <div className="counterpulse-design-section">
            <CampaignDesignEditor
              design={effectiveDesign}
              designMediaOptions={designMediaOptions}
              errors={designErrors}
              isProPlan={isProPlan}
              lockedCustomCssReason={lockedCustomCssReason}
              mobileDesign={effectiveMobileDesign}
              previewDevice={previewDevice}
              previewPlacement={campaignPreviewPlacement}
              viewModel={previewViewModel}
              onChange={updateDesignValues}
              onMobileChange={(next) => {
                if (onMobileDesignChange) onMobileDesignChange(next);
                else setLocalMobileDesignValues(next);
              }}
              onPreviewDeviceChange={updatePreviewDevice}
              onPreviewPlacementChange={selectCampaignPreviewPlacement}
              // Seed the Design editor with the live structural edit (so they
              // survive switching tabs) falling back to the AI-applied structure,
              // so its preview always matches the Campaign-tab preview.
              structureEdited={
                liveDesignStructure
                  ? true
                  : structureEdited || Boolean(aiStructure)
              }
              structureHtml={
                liveDesignStructure?.html ||
                structureHtml ||
                aiStructure?.html ||
                ""
              }
              structureCss={
                liveDesignStructure?.css ||
                structureCss ||
                aiStructure?.css ||
                ""
              }
              mobileStructureEdited={mobileStructureEdited}
              mobileStructureHtml={mobileStructureHtml}
              mobileStructureCss={mobileStructureCss}
              customMessages={customMessages}
              onStructureChange={setDesignStructureForm}
            />
          </div>
        )}
      </Form>
      {confirmOnSubmit ? confirmSubmit.modal : null}
    </>
  );
}
