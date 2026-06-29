import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { AppAlert, AppToast } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  type CampaignAiAnswerMap,
  type CampaignAiFollowUpQuestion,
  campaignAiReferenceImageAccept,
  campaignAiReferenceImageMaxBytes,
  campaignAiToneOptions,
  type CampaignAiFormErrors,
  type CampaignAiInput,
  type CampaignSuggestion,
  isCampaignAiReferenceImageMimeType,
} from "../types/ai-campaign";
import type { CampaignFormValues } from "../types/campaign-form";
import { campaignGoalOptions } from "../types/campaign-options";
import { getStorefrontLocaleOptions } from "../types/localization";
import { buildCampaignViewModel } from "../utils/campaign-view-model";
import { htmlToTree } from "../utils/campaign-structure";
import { AiGenerateIcon } from "./AiGenerateIcon";
import { CampaignPromoSurface } from "./CampaignPreview";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

type AiCampaignBuilderProps = {
  errors?: CampaignAiFormErrors;
  followUpQuestions?: CampaignAiFollowUpQuestion[];
  lockedReason?: string;
  // Set (with the upgrade reason) when the plan does not allow AI visual asset
  // generation. Undefined means the feature is available (PRO).
  assetsLockedReason?: string;
  locales?: readonly string[];
  onApplied?: () => void;
  suggestion?: CampaignSuggestion | null;
  templateSourceName?: string;
  values: CampaignAiInput;
  // Version history navigation (back/forward through generated drafts).
  versionCount?: number;
  versionIndex?: number;
  onPrevVersion?: () => void;
  onNextVersion?: () => void;
};

type ReferenceImageState = {
  dataUrl: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

// Fields that can be ignored when generating from a reference image. The
// campaign type/goal is intentionally excluded — it must always be chosen.
const IGNORABLE_AI_FIELDS = [
  "campaignShape",
  "brandTone",
  "quickStarts",
  "campaignNameHint",
  "locale",
  "productContext",
  "knownOffer",
  "merchantNotes",
  "eventName",
  "countryCode",
  "ctaUrl",
] as const;

type IgnorableAiField = (typeof IGNORABLE_AI_FIELDS)[number];

type GoalFlowOption = {
  id: string;
  label: string;
  description: string;
  offerText?: string;
  notesText?: string;
};

type GoalFlowQuestion = {
  id: string;
  title: string;
  description: string;
  options: GoalFlowOption[];
};

type GoalFlowConfig = {
  summary: string;
  defaultShape: CampaignAiInput["campaignShape"];
  defaultAnswers: CampaignAiAnswerMap;
  quickStarts: string[];
  questions: GoalFlowQuestion[];
};

const aiCampaignShapeOptions = [
  {
    key: "sitewide",
    label: "Sitewide sale",
    description: "A visible bar for broad announcements.",
  },
  {
    key: "product",
    label: "Product urgency",
    description: "A focused timer or message near products.",
  },
  {
    key: "cart",
    label: "Cart rescue",
    description: "A cart timer or checkout-driving offer.",
  },
  {
    key: "merchandising",
    label: "Merchandising",
    description: "Badges, low stock, or delivery promise.",
  },
];

const aiOfferQuickStarts = [
  "Limited-time sale",
  "Free shipping threshold",
  "Low stock urgency",
  "New product launch",
  "Cart recovery incentive",
  "Delivery cutoff reminder",
];

const aiGoalFlows: Record<CampaignAiInput["objective"], GoalFlowConfig> = {
  FLASH_SALE: {
    summary:
      "Build a sale-focused countdown with a clear offer, short window, and visible placement.",
    defaultShape: "sitewide",
    defaultAnswers: {
      flash_sale_offer_type: ["flash_sale_percent"],
      flash_sale_window: ["flash_sale_24h"],
      flash_sale_surface: ["flash_sale_top_bar"],
    },
    quickStarts: ["Limited-time sale"],
    questions: [
      {
        id: "flash_sale_offer_type",
        title: "What kind of sale is this?",
        description: "Choose every offer type that applies.",
        options: [
          {
            id: "flash_sale_percent",
            label: "Percentage discount",
            description: "A classic percent-off sale.",
            offerText: "20% off",
          },
          {
            id: "flash_sale_fixed",
            label: "Fixed amount off",
            description: "Useful for higher-ticket products.",
            offerText: "$10 off",
          },
          {
            id: "flash_sale_no_discount",
            label: "No discount",
            description: "Use urgency without savings claims.",
          },
        ],
      },
      {
        id: "flash_sale_window",
        title: "How long should the timer feel?",
        description: "This guides timer defaults and urgency copy.",
        options: [
          {
            id: "flash_sale_24h",
            label: "24 hours",
            description: "High urgency.",
          },
          {
            id: "flash_sale_48h",
            label: "48 hours",
            description: "Balanced sale window.",
          },
          {
            id: "flash_sale_weekend",
            label: "Weekend sale",
            description: "Longer promotional window.",
          },
        ],
      },
      {
        id: "flash_sale_surface",
        title: "Where should shoppers notice it?",
        description: "The campaign can still be previewed elsewhere.",
        options: [
          {
            id: "flash_sale_top_bar",
            label: "Top bar",
            description: "Best for sitewide sales.",
          },
          {
            id: "flash_sale_product_page",
            label: "Product page",
            description: "Best for product-specific sales.",
          },
          {
            id: "flash_sale_cart",
            label: "Cart reminder",
            description: "Reinforce the sale near checkout.",
          },
        ],
      },
    ],
  },
  FREE_SHIPPING: {
    summary:
      "Configure a cart-focused free-shipping goal with threshold, progress style, and optional countdown.",
    defaultShape: "cart",
    defaultAnswers: {
      free_shipping_threshold: ["free_shipping_threshold_75"],
      free_shipping_scope: ["free_shipping_cart_progress"],
      free_shipping_timer: ["free_shipping_no_countdown"],
    },
    quickStarts: ["Free shipping threshold"],
    questions: [
      {
        id: "free_shipping_threshold",
        title: "What threshold should unlock free shipping?",
        description: "Pick the closest real threshold. You can edit it later.",
        options: [
          {
            id: "free_shipping_threshold_50",
            label: "$50",
            description: "Lower threshold for lower-priced catalogs.",
            offerText: "Free shipping over $50",
          },
          {
            id: "free_shipping_threshold_75",
            label: "$75",
            description: "Balanced default.",
            offerText: "Free shipping over $75",
          },
          {
            id: "free_shipping_threshold_100",
            label: "$100",
            description: "Higher AOV target.",
            offerText: "Free shipping over $100",
          },
        ],
      },
      {
        id: "free_shipping_scope",
        title: "How should it be shown?",
        description: "Free shipping usually works best in cart surfaces.",
        options: [
          {
            id: "free_shipping_cart_progress",
            label: "Cart progress",
            description: "Show progress toward the threshold.",
          },
          {
            id: "free_shipping_top_bar",
            label: "Top-bar reminder",
            description: "Sitewide reminder plus cart progress.",
          },
          {
            id: "free_shipping_compact",
            label: "Compact message",
            description: "Use less vertical space.",
          },
        ],
      },
      {
        id: "free_shipping_timer",
        title: "Should urgency be added?",
        description: "Use a countdown only when there is a real time limit.",
        options: [
          {
            id: "free_shipping_no_countdown",
            label: "No countdown",
            description: "Threshold only.",
          },
          {
            id: "free_shipping_countdown_24h",
            label: "24-hour countdown",
            description: "Use only if the offer really ends soon.",
          },
        ],
      },
    ],
  },
  CART_RESCUE: {
    summary:
      "Create a cart drawer/page timer that pushes checkout completion without overpromising.",
    defaultShape: "cart",
    defaultAnswers: {
      cart_rescue_timer: ["cart_timer_15"],
      cart_rescue_incentive: ["cart_incentive_none"],
      cart_rescue_surface: ["cart_surface_drawer"],
    },
    quickStarts: ["Cart recovery incentive"],
    questions: [
      {
        id: "cart_rescue_timer",
        title: "How long should the cart timer run?",
        description: "Short timers feel stronger in cart contexts.",
        options: [
          {
            id: "cart_timer_15",
            label: "15 minutes",
            description: "High urgency.",
          },
          {
            id: "cart_timer_30",
            label: "30 minutes",
            description: "Moderate urgency.",
          },
        ],
      },
      {
        id: "cart_rescue_incentive",
        title: "Is there an incentive?",
        description: "Only choose one if the store really offers it.",
        options: [
          {
            id: "cart_incentive_none",
            label: "No incentive",
            description: "Use timer and copy only.",
          },
          {
            id: "cart_incentive_discount",
            label: "Small discount",
            description: "Draft a code-based incentive.",
            offerText: "10% off",
          },
          {
            id: "cart_incentive_shipping",
            label: "Free shipping",
            description: "Draft a shipping incentive.",
            offerText: "Free shipping",
          },
        ],
      },
      {
        id: "cart_rescue_surface",
        title: "Where should it appear?",
        description: "Cart drawer is usually the primary surface.",
        options: [
          {
            id: "cart_surface_drawer",
            label: "Cart drawer",
            description: "Primary cart rescue placement.",
          },
          {
            id: "cart_surface_page",
            label: "Cart page",
            description: "Use for full cart pages too.",
          },
        ],
      },
    ],
  },
  DELIVERY_CUTOFF: {
    summary:
      "Draft an order-by timer using a daily cutoff and conservative delivery wording.",
    defaultShape: "product",
    defaultAnswers: {
      delivery_cutoff_time: ["delivery_cutoff_14"],
      delivery_cutoff_after: ["delivery_after_next_window"],
    },
    quickStarts: ["Delivery cutoff reminder"],
    questions: [
      {
        id: "delivery_cutoff_time",
        title: "What is the daily cutoff?",
        description: "This configures the recurring countdown.",
        options: [
          {
            id: "delivery_cutoff_14",
            label: "2:00 PM",
            description: "Conservative fulfillment cutoff.",
          },
          {
            id: "delivery_cutoff_16",
            label: "4:00 PM",
            description: "Later fulfillment cutoff.",
          },
        ],
      },
      {
        id: "delivery_cutoff_after",
        title: "What happens after cutoff?",
        description: "Choose how the campaign behaves after the daily window.",
        options: [
          {
            id: "delivery_after_next_window",
            label: "Show next window",
            description: "Keep explaining the next order window.",
          },
          {
            id: "delivery_after_hide",
            label: "Hide message",
            description: "Avoid after-cutoff messaging.",
          },
        ],
      },
    ],
  },
  LOW_STOCK_URGENCY: {
    summary:
      "Use real inventory conditions to show low-stock urgency without fake scarcity.",
    defaultShape: "product",
    defaultAnswers: {
      low_stock_threshold: ["low_stock_threshold_5"],
      low_stock_copy: ["low_stock_hide_quantity"],
    },
    quickStarts: ["Low stock urgency"],
    questions: [
      {
        id: "low_stock_threshold",
        title: "When should the message show?",
        description: "This maps to the low-stock threshold.",
        options: [
          {
            id: "low_stock_threshold_5",
            label: "Below 5 units",
            description: "Conservative scarcity.",
          },
          {
            id: "low_stock_threshold_10",
            label: "Below 10 units",
            description: "Earlier warning.",
          },
        ],
      },
      {
        id: "low_stock_copy",
        title: "How much detail should be shown?",
        description: "Avoid exact counts unless inventory data supports it.",
        options: [
          {
            id: "low_stock_hide_quantity",
            label: "Hide quantity",
            description: "Show low-stock wording only.",
          },
          {
            id: "low_stock_show_quantity",
            label: "Show exact quantity",
            description: "Only when inventory is reliable.",
          },
        ],
      },
    ],
  },
  PRODUCT_BADGE: {
    summary:
      "Create a compact product or collection badge for merchandising signals.",
    defaultShape: "merchandising",
    defaultAnswers: {
      product_badge_text: ["badge_limited_offer"],
      product_badge_surface: ["badge_collection_card"],
    },
    quickStarts: ["New product launch"],
    questions: [
      {
        id: "product_badge_text",
        title: "What should the badge say?",
        description: "Badges need very short copy.",
        options: [
          {
            id: "badge_new_drop",
            label: "New drop",
            description: "Product launch badge.",
            offerText: "New drop",
          },
          {
            id: "badge_limited_offer",
            label: "Limited offer",
            description: "General promo badge.",
            offerText: "Limited offer",
          },
          {
            id: "badge_free_shipping",
            label: "Free shipping",
            description: "Use only if true.",
            offerText: "Free shipping",
          },
        ],
      },
      {
        id: "product_badge_surface",
        title: "Where should badges appear?",
        description: "Collection cards are usually the most visible surface.",
        options: [
          {
            id: "badge_collection_card",
            label: "Collection cards",
            description: "Show badges while browsing collections.",
          },
          {
            id: "badge_product_page",
            label: "Product pages",
            description: "Show badges on product detail pages too.",
          },
        ],
      },
    ],
  },
  ANNOUNCEMENT: {
    summary:
      "Draft a general message for launches, store updates, or seasonal announcements.",
    defaultShape: "sitewide",
    defaultAnswers: {
      announcement_focus: ["announcement_launch"],
      announcement_surface: ["announcement_top_bar"],
    },
    quickStarts: ["New product launch"],
    questions: [
      {
        id: "announcement_focus",
        title: "What is the announcement about?",
        description: "This controls message framing.",
        options: [
          {
            id: "announcement_launch",
            label: "Launch",
            description: "New products or collection.",
          },
          {
            id: "announcement_policy",
            label: "Store update",
            description: "Operational or policy message.",
          },
          {
            id: "announcement_event",
            label: "Seasonal event",
            description: "Event-led announcement.",
          },
        ],
      },
      {
        id: "announcement_surface",
        title: "Where should it appear?",
        description: "Announcements are often sitewide.",
        options: [
          {
            id: "announcement_top_bar",
            label: "Top bar",
            description: "Most visible sitewide placement.",
          },
          {
            id: "announcement_bottom_bar",
            label: "Bottom bar",
            description: "Less intrusive persistent message.",
          },
        ],
      },
    ],
  },
};

const aiGoalDescriptions: Record<CampaignAiInput["objective"], string> = {
  FLASH_SALE: "Create urgency around a short sale window.",
  FREE_SHIPPING: "Move shoppers toward a shipping threshold.",
  CART_RESCUE: "Push cart visitors to complete checkout.",
  DELIVERY_CUTOFF: "Highlight order timing and delivery promise.",
  LOW_STOCK_URGENCY: "Use scarcity messaging for product demand.",
  PRODUCT_BADGE: "Mark products with merchandising labels.",
  ANNOUNCEMENT: "Promote a general message or launch.",
};

const aiGoalFlowQuickStarts = uniqueStrings(
  Object.values(aiGoalFlows).flatMap((flow) => flow.quickStarts),
);
const aiGoalFlowOfferLines = uniqueStrings(
  Object.values(aiGoalFlows).flatMap((flow) =>
    flow.questions.flatMap((question) =>
      question.options
        .map((option) => option.offerText)
        .filter((value): value is string => Boolean(value)),
    ),
  ),
);
const aiGoalFlowNoteLines = uniqueStrings(
  Object.values(aiGoalFlows).flatMap((flow) =>
    flow.questions.flatMap((question) =>
      question.options
        .map((option) => option.notesText)
        .filter((value): value is string => Boolean(value)),
    ),
  ),
);

export function AiCampaignBuilder({
  errors = {},
  followUpQuestions = [],
  lockedReason,
  assetsLockedReason,
  locales,
  onApplied,
  suggestion,
  templateSourceName,
  values,
  versionCount = 0,
  versionIndex = 0,
  onPrevVersion,
  onNextVersion,
}: AiCampaignBuilderProps) {
  const navigation = useNavigation();
  const localeOptions = useMemo(
    () => getStorefrontLocaleOptions(locales),
    [locales],
  );
  const activeLocales = useMemo(
    () => localeOptions.map((localeOption) => localeOption.locale),
    [localeOptions],
  );
  const activeLocalesKey = activeLocales.join("|");
  const suggestionPreviewRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [applied, setApplied] = useState(false);
  const [formValues, setFormValues] = useState(values);
  const [followUpAnswers, setFollowUpAnswers] = useState<CampaignAiAnswerMap>(
    {},
  );
  const [referenceImage, setReferenceImage] =
    useState<ReferenceImageState | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [refineModalOpen, setRefineModalOpen] = useState(false);
  const [refineCloseness, setRefineCloseness] = useState("");
  const [refineComment, setRefineComment] = useState("");

  // Each new suggestion clears the refine fields so the next plain Generate is a
  // fresh draft (only Regenerate re-enables refinement).
  useEffect(() => {
    setRefineCloseness("");
    setRefineComment("");
  }, [suggestion]);

  // Regenerate with a closeness rating + optional comment: set them, then submit
  // the generate form so the hidden refine fields travel with the request.
  const regenerateWith = (closeness: string, comment: string) => {
    setRefineCloseness(closeness);
    setRefineComment(comment);
    setRefineModalOpen(false);
    window.requestAnimationFrame(() => {
      const form = document.getElementById(
        "ai-campaign-generate-form",
      ) as HTMLFormElement | null;
      form?.requestSubmit();
    });
  };
  const referenceImageMaxMb = Math.round(
    campaignAiReferenceImageMaxBytes / (1024 * 1024),
  );
  const hasReferenceImage = Boolean(referenceImage);
  const assetsAllowed = !assetsLockedReason;
  const [generateVisualAssets, setGenerateVisualAssets] = useState(false);
  const [assetScopeError, setAssetScopeError] = useState<string | null>(null);
  // Only request assets when allowed AND a reference image is present.
  const effectiveGenerateAssets =
    generateVisualAssets && assetsAllowed && hasReferenceImage;

  const toggleVisualAssets = async (checked: boolean) => {
    setAssetScopeError(null);
    if (!checked) {
      setGenerateVisualAssets(false);
      return;
    }
    // Saving assets to Shopify needs the write_files scope — request it on demand.
    try {
      const scopes = window.shopify?.scopes as
        | {
            request?: (s: string[]) => Promise<{ granted?: string[] } | void>;
            query?: () => Promise<{ granted?: string[] }>;
          }
        | undefined;
      const detail = await scopes?.request?.(["write_files"]);
      let granted = Array.isArray(detail?.granted) ? detail!.granted : null;
      if (!granted) {
        const queried = await scopes?.query?.();
        granted = queried?.granted ?? [];
      }
      if (granted.includes("write_files")) {
        setGenerateVisualAssets(true);
      } else {
        setGenerateVisualAssets(false);
        setAssetScopeError(
          "The Files permission is required to generate visual assets. It was not granted.",
        );
      }
    } catch {
      setGenerateVisualAssets(false);
      setAssetScopeError(
        "Could not request the Files permission. Try again to enable visual assets.",
      );
    }
  };
  // When a reference image is attached, every input except the campaign type is
  // ignored by default so the AI reads it from the image. We track which fields
  // the merchant explicitly un-ignored; the default (empty set) means all
  // ignored. This derives ignore state without an effect.
  const [unignoredFields, setUnignoredFields] = useState<Set<IgnorableAiField>>(
    new Set(),
  );
  const isFieldIgnored = (field: IgnorableAiField) =>
    hasReferenceImage && !unignoredFields.has(field);
  const toggleIgnoredField = (field: IgnorableAiField) => {
    setUnignoredFields((current) => {
      const next = new Set(current);
      // Membership = "kept" (not ignored); flipping toggles the ignore state.
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };
  const ignoreControl = (field: IgnorableAiField) =>
    hasReferenceImage
      ? {
          active: isFieldIgnored(field),
          onToggle: () => toggleIgnoredField(field),
        }
      : undefined;
  const activeGoalFlow = aiGoalFlows[formValues.objective];
  const isAnsweringFollowUp = followUpQuestions.length > 0 && !suggestion;
  const isGenerating =
    navigation.state === "submitting" &&
    navigation.formData?.get("_action") === "generateAiCampaignSuggestion";
  const updateValue = <Key extends keyof CampaignAiInput>(
    key: Key,
    value: CampaignAiInput[Key],
  ) => {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
  };
  const applyOfferQuickStart = (offer: string) => {
    setFormValues((current) => ({
      ...current,
      quickStarts: current.quickStarts.includes(offer)
        ? current.quickStarts.filter((item) => item !== offer)
        : [...current.quickStarts, offer],
      knownOffer: current.quickStarts.includes(offer)
        ? removeKnownOfferLine(current.knownOffer, offer)
        : appendKnownOfferLine(current.knownOffer, offer),
    }));
  };
  const selectGoal = (objective: CampaignAiInput["objective"]) => {
    const flow = aiGoalFlows[objective];

    setFormValues((current) => ({
      ...current,
      objective,
      campaignShape: flow.defaultShape,
      goalAnswers: flow.defaultAnswers,
      quickStarts: flow.quickStarts,
      knownOffer: mergeKnownOfferLines(
        removeKnownOfferLines(current.knownOffer, [
          ...aiGoalFlowQuickStarts,
          ...aiGoalFlowOfferLines,
        ]),
        flow.quickStarts,
        collectOfferText(flow.defaultAnswers, flow),
      ),
      merchantNotes: mergeKnownOfferLines(
        removeKnownOfferLines(current.merchantNotes, aiGoalFlowNoteLines),
        [],
        collectNotesText(flow.defaultAnswers, flow),
      ),
    }));
    setFollowUpAnswers({});
  };
  const toggleGoalAnswer = (
    question: GoalFlowQuestion,
    option: GoalFlowOption,
  ) => {
    setFormValues((current) => {
      const currentAnswers = current.goalAnswers[question.id] ?? [];
      const isSelected = currentAnswers.includes(option.id);
      const nextAnswers = isSelected
        ? currentAnswers.filter((answer) => answer !== option.id)
        : [...currentAnswers, option.id];
      const nextGoalAnswers = {
        ...current.goalAnswers,
        [question.id]: nextAnswers,
      };

      return {
        ...current,
        goalAnswers: nextGoalAnswers,
        knownOffer: option.offerText
          ? isSelected
            ? removeKnownOfferLine(current.knownOffer, option.offerText)
            : appendKnownOfferLine(current.knownOffer, option.offerText)
          : current.knownOffer,
        merchantNotes: option.notesText
          ? isSelected
            ? removeKnownOfferLine(current.merchantNotes, option.notesText)
            : appendKnownOfferLine(current.merchantNotes, option.notesText)
          : current.merchantNotes,
      };
    });
  };
  const toggleFollowUpAnswer = (questionId: string, optionId: string) => {
    setFollowUpAnswers((current) => {
      const currentAnswers = current[questionId] ?? [];
      const isSelected = currentAnswers.includes(optionId);

      return {
        ...current,
        [questionId]: isSelected
          ? currentAnswers.filter((answer) => answer !== optionId)
          : [...currentAnswers, optionId],
      };
    });
  };

  const readReferenceImageFile = (file: File) => {
    setImageError(null);

    if (!isCampaignAiReferenceImageMimeType(file.type)) {
      setImageError(
        "Unsupported image type. Use a PNG, JPG, JPEG, or WEBP file.",
      );
      return;
    }

    if (file.size > campaignAiReferenceImageMaxBytes) {
      setImageError(
        `That image is too large. Use a file under ${referenceImageMaxMb} MB.`,
      );
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      setImageError("The image could not be read. Try uploading it again.");
    };

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      if (!result.startsWith("data:")) {
        setImageError("The image could not be read. Try uploading it again.");
        return;
      }

      setReferenceImage({
        dataUrl: result,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      // A fresh image starts with every field ignored again.
      setUnignoredFields(new Set());
    };

    reader.readAsDataURL(file);
  };

  const handleImageFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) readReferenceImageFile(file);
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setImageError(null);
    setUnignoredFields(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    const syncFormValues = window.setTimeout(() => {
      setFormValues(values);
    }, 0);

    return () => window.clearTimeout(syncFormValues);
  }, [values]);

  useEffect(() => {
    if (activeLocales.includes(formValues.locale)) return undefined;

    const syncLocale = window.setTimeout(() => {
      setFormValues((current) =>
        activeLocales.includes(current.locale)
          ? current
          : {
              ...current,
              locale: activeLocales[0] ?? "en",
            },
      );
    }, 0);

    return () => window.clearTimeout(syncLocale);
  }, [activeLocales, activeLocalesKey, formValues.locale]);

  useEffect(() => {
    if (!suggestion) return undefined;

    const scrollToSuggestion = window.setTimeout(() => {
      suggestionPreviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);

    return () => window.clearTimeout(scrollToSuggestion);
  }, [suggestion]);

  return (
    <div className="counterpulse-ai-builder">
      {lockedReason ? (
        <PlanUpgradeCallout
          message={lockedReason}
          title="AI Campaign Builder is locked"
        />
      ) : (
        <>
          {errors.form && (
            <AppAlert tone="critical" title="Suggestion could not be created">
              <s-paragraph>{errors.form}</s-paragraph>
            </AppAlert>
          )}

          {templateSourceName && (
            <AppAlert tone="info" title="Template context loaded">
              <s-paragraph>
                Generate a campaign draft from {templateSourceName}, then review
                before applying or saving.
              </s-paragraph>
            </AppAlert>
          )}

          <div className="counterpulse-ai-builder__intro">
            <span className="counterpulse-ai-builder__icon" aria-hidden="true">
              <AiGenerateIcon />
            </span>
            <div>
              <strong>Start with intent, not copywriting</strong>
              <p>
                Pick the campaign direction and add only the details the AI
                cannot infer. Names and customer-facing text can be generated
                automatically.
              </p>
            </div>
          </div>

          <Form
            id="ai-campaign-generate-form"
            method="post"
            className="counterpulse-form"
          >
            <input
              name="_action"
              type="hidden"
              value="generateAiCampaignSuggestion"
            />
            {/* Regenerate refinement: only populated when the merchant picks a
                closeness rating, so a normal Generate stays a fresh draft. */}
            <input
              name="refineCloseness"
              type="hidden"
              value={refineCloseness}
            />
            <input
              name="refineComment"
              type="hidden"
              value={refineCloseness ? refineComment : ""}
            />
            <input
              name="refineFromSuggestion"
              type="hidden"
              value={
                refineCloseness && suggestion ? JSON.stringify(suggestion) : ""
              }
            />
            <input
              name="objective"
              type="hidden"
              value={formValues.objective}
            />
            {!isFieldIgnored("brandTone") && (
              <input
                name="brandTone"
                type="hidden"
                value={formValues.brandTone}
              />
            )}
            {!isFieldIgnored("campaignShape") && (
              <>
                <input
                  name="campaignShape"
                  type="hidden"
                  value={formValues.campaignShape}
                />
                <input
                  name="goalAnswersJson"
                  type="hidden"
                  value={JSON.stringify(formValues.goalAnswers)}
                />
              </>
            )}
            {!isFieldIgnored("quickStarts") && (
              <input
                name="quickStartsJson"
                type="hidden"
                value={JSON.stringify(formValues.quickStarts)}
              />
            )}
            <input
              name="followUpAnswersJson"
              type="hidden"
              value={JSON.stringify(followUpAnswers)}
            />
            <input
              name="aiFollowUpStatus"
              type="hidden"
              value={isAnsweringFollowUp ? "answered" : "initial"}
            />
            {activeLocales.map((locale) => (
              <input key={locale} name="locales" type="hidden" value={locale} />
            ))}
            {referenceImage && (
              <>
                <input
                  name="referenceImageDataUrl"
                  type="hidden"
                  value={referenceImage.dataUrl}
                />
                <input
                  name="referenceImageMimeType"
                  type="hidden"
                  value={referenceImage.mimeType}
                />
              </>
            )}

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Reference image</p>
                <h3>Match an existing banner or timer (optional)</h3>
                <p>
                  Upload a screenshot of a promo bar, countdown, or banner and
                  the AI reproduces its layout, colors, spacing, and text using
                  your real campaign settings. Skip it to generate from your
                  description only.
                </p>
              </div>

              {imageError && (
                <AppAlert tone="critical" title="Image could not be used">
                  <s-paragraph>{imageError}</s-paragraph>
                </AppAlert>
              )}

              {referenceImage ? (
                <div className="counterpulse-ai-image-preview">
                  <img
                    alt="Reference campaign preview"
                    className="counterpulse-ai-image-preview__image"
                    src={referenceImage.dataUrl}
                  />
                  <div className="counterpulse-ai-image-preview__meta">
                    <strong>{referenceImage.name || "Reference image"}</strong>
                    <small>{formatBytes(referenceImage.sizeBytes)}</small>
                    <div className="counterpulse-ai-image-preview__actions">
                      <button
                        className="counterpulse-button-secondary"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Replace
                      </button>
                      <button
                        className="counterpulse-button-secondary"
                        type="button"
                        onClick={removeReferenceImage}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  className={
                    isDraggingImage
                      ? "counterpulse-ai-dropzone counterpulse-ai-dropzone--active"
                      : "counterpulse-ai-dropzone"
                  }
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingImage(true);
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingImage(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDraggingImage(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingImage(false);
                    handleImageFiles(event.dataTransfer.files);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="counterpulse-ai-dropzone__icon"
                  >
                    <ReferenceImageIcon />
                  </span>
                  <strong>Drag &amp; drop an image here</strong>
                  <span>
                    or click to browse — PNG, JPG, JPEG, or WEBP up to{" "}
                    {referenceImageMaxMb} MB
                  </span>
                </button>
              )}

              <input
                accept={campaignAiReferenceImageAccept}
                className="counterpulse-ai-file-input"
                ref={fileInputRef}
                type="file"
                onChange={(event) => {
                  handleImageFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />

              {/* Hidden field: the server re-validates plan + scope, so the
                  checkbox alone never enables generation. */}
              <input
                name="generateVisualAssets"
                type="hidden"
                value={effectiveGenerateAssets ? "true" : "false"}
              />

              {assetsAllowed ? (
                <div className="counterpulse-ai-asset-toggle">
                  <label className="counterpulse-checkbox">
                    <input
                      checked={effectiveGenerateAssets}
                      disabled={!hasReferenceImage}
                      type="checkbox"
                      onChange={(event) =>
                        toggleVisualAssets(event.target.checked)
                      }
                    />
                    <span>
                      <strong>Generate visual assets from image</strong>
                      <small>
                        Detect and generate backgrounds, icons, badges and other
                        assets, upload them to your Shopify Files, and use them in
                        the campaign. Requires the Files permission.
                      </small>
                    </span>
                  </label>
                  {!hasReferenceImage && (
                    <p className="counterpulse-design-note">
                      Upload a reference image to enable visual asset generation.
                    </p>
                  )}
                  {assetScopeError && (
                    <AppAlert tone="critical" title="Permission required">
                      <s-paragraph>{assetScopeError}</s-paragraph>
                    </AppAlert>
                  )}
                </div>
              ) : (
                <PlanUpgradeCallout
                  message={assetsLockedReason}
                  title="AI visual assets is a Pro feature"
                />
              )}
            </div>

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Goal</p>
                <h3>What should this campaign accomplish?</h3>
              </div>
              <div className="counterpulse-ai-option-grid">
                {campaignGoalOptions.map((option) => (
                  <button
                    aria-pressed={formValues.objective === option.value}
                    className="counterpulse-ai-option-card"
                    key={option.value}
                    type="button"
                    onClick={() => selectGoal(option.value)}
                  >
                    <span className="counterpulse-ai-option-card__icon">
                      <AiGoalIcon />
                    </span>
                    <strong>{option.label}</strong>
                    <small>{aiGoalDescriptions[option.value]}</small>
                  </button>
                ))}
              </div>
              {errors.objective && (
                <span className="counterpulse-form-error">
                  {errors.objective}
                </span>
              )}
            </div>

            <div
              className={
                isFieldIgnored("campaignShape")
                  ? "counterpulse-ai-step counterpulse-ai-step--ignored"
                  : "counterpulse-ai-step"
              }
            >
              <div className="counterpulse-ai-step__head">
                <div>
                  <p className="counterpulse-kicker">Goal setup</p>
                  <h3>{activeGoalFlow.summary}</h3>
                </div>
                {hasReferenceImage && (
                  <IgnoreToggle
                    active={isFieldIgnored("campaignShape")}
                    onToggle={() => toggleIgnoredField("campaignShape")}
                  />
                )}
              </div>
              <div className="counterpulse-ai-shape-grid">
                {aiCampaignShapeOptions.map((option) => (
                  <button
                    aria-pressed={formValues.campaignShape === option.key}
                    className="counterpulse-ai-shape-card"
                    key={option.key}
                    type="button"
                    onClick={() =>
                      updateValue(
                        "campaignShape",
                        option.key as CampaignAiInput["campaignShape"],
                      )
                    }
                  >
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>

              <div className="counterpulse-ai-flow-stack">
                {activeGoalFlow.questions.map((question) => (
                  <section
                    className="counterpulse-ai-question"
                    key={question.id}
                  >
                    <div>
                      <strong>{question.title}</strong>
                      <p>{question.description}</p>
                    </div>
                    <div className="counterpulse-ai-chip-grid">
                      {question.options.map((option) => (
                        <button
                          aria-pressed={Boolean(
                            formValues.goalAnswers[question.id]?.includes(
                              option.id,
                            ),
                          )}
                          className="counterpulse-ai-chip"
                          key={option.id}
                          type="button"
                          onClick={() => toggleGoalAnswer(question, option)}
                        >
                          <span>{option.label}</span>
                          <small>{option.description}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <div
              className={
                isFieldIgnored("brandTone")
                  ? "counterpulse-ai-step counterpulse-ai-step--ignored"
                  : "counterpulse-ai-step"
              }
            >
              <div className="counterpulse-ai-step__head">
                <div>
                  <p className="counterpulse-kicker">Tone</p>
                  <h3>How should the campaign sound?</h3>
                </div>
                {hasReferenceImage && (
                  <IgnoreToggle
                    active={isFieldIgnored("brandTone")}
                    onToggle={() => toggleIgnoredField("brandTone")}
                  />
                )}
              </div>
              <div className="counterpulse-ai-chip-grid">
                {campaignAiToneOptions.map((option) => (
                  <button
                    aria-pressed={formValues.brandTone === option.value}
                    className="counterpulse-ai-chip"
                    key={option.value}
                    type="button"
                    onClick={() => updateValue("brandTone", option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {errors.brandTone && (
                <span className="counterpulse-form-error">
                  {errors.brandTone}
                </span>
              )}
            </div>

            <div
              className={
                isFieldIgnored("quickStarts")
                  ? "counterpulse-ai-step counterpulse-ai-step--ignored"
                  : "counterpulse-ai-step"
              }
            >
              <div className="counterpulse-ai-step__head">
                <div>
                  <p className="counterpulse-kicker">Offer</p>
                  <h3>Pick any relevant starting points</h3>
                </div>
                {hasReferenceImage && (
                  <IgnoreToggle
                    active={isFieldIgnored("quickStarts")}
                    onToggle={() => toggleIgnoredField("quickStarts")}
                  />
                )}
              </div>
              <div className="counterpulse-ai-chip-grid">
                {uniqueStrings([
                  ...activeGoalFlow.quickStarts,
                  ...aiOfferQuickStarts,
                ]).map((offer) => (
                  <button
                    aria-pressed={formValues.quickStarts.includes(offer)}
                    className="counterpulse-ai-chip"
                    key={offer}
                    type="button"
                    onClick={() => applyOfferQuickStart(offer)}
                  >
                    {offer}
                  </button>
                ))}
              </div>
            </div>

            {isAnsweringFollowUp && (
              <div className="counterpulse-ai-step counterpulse-ai-follow-up">
                <div>
                  <p className="counterpulse-kicker">AI questions</p>
                  <h3>Optional refinements before generating</h3>
                  <p>
                    Select any answers that apply. You can ignore every question
                    and generate with safe defaults.
                  </p>
                </div>
                <div className="counterpulse-ai-flow-stack">
                  {followUpQuestions.map((question) => (
                    <section
                      className="counterpulse-ai-question"
                      key={question.id}
                    >
                      <div>
                        <strong>{question.question}</strong>
                        <p>{question.reason}</p>
                      </div>
                      <div className="counterpulse-ai-chip-grid">
                        {question.options.map((option) => (
                          <button
                            aria-pressed={Boolean(
                              followUpAnswers[question.id]?.includes(option.id),
                            )}
                            className="counterpulse-ai-chip"
                            key={option.id}
                            type="button"
                            onClick={() =>
                              toggleFollowUpAnswer(question.id, option.id)
                            }
                          >
                            <span>{option.label}</span>
                            <small>{option.description}</small>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Details</p>
                <h3>Only write what the AI cannot know</h3>
              </div>
              <div className="counterpulse-form-grid">
                <FormField
                  label="Campaign name hint"
                  ignore={ignoreControl("campaignNameHint")}
                >
                  <input
                    name="campaignNameHint"
                    value={formValues.campaignNameHint}
                    disabled={isFieldIgnored("campaignNameHint")}
                    placeholder="Optional. Leave blank to generate a name."
                    onChange={(event) =>
                      updateValue("campaignNameHint", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Language"
                  error={errors.locale}
                  ignore={ignoreControl("locale")}
                >
                  <select
                    name="locale"
                    value={formValues.locale}
                    disabled={isFieldIgnored("locale")}
                    onChange={(event) =>
                      updateValue(
                        "locale",
                        event.currentTarget.value as CampaignAiInput["locale"],
                      )
                    }
                  >
                    {localeOptions.map((locale) => (
                      <option key={locale.locale} value={locale.locale}>
                        {locale.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  label="Product, collection, or audience"
                  error={errors.productContext}
                  fullWidth
                  ignore={ignoreControl("productContext")}
                >
                  <textarea
                    name="productContext"
                    value={formValues.productContext}
                    rows={3}
                    disabled={isFieldIgnored("productContext")}
                    placeholder={
                      referenceImage
                        ? "Optional when an image is attached. Add anything the image cannot show."
                        : "Example: premium skincare bundles, summer dresses, returning customers, first-time buyers."
                    }
                    required={!referenceImage}
                    onChange={(event) =>
                      updateValue("productContext", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Offer details"
                  error={errors.knownOffer}
                  fullWidth
                  ignore={ignoreControl("knownOffer")}
                >
                  <textarea
                    name="knownOffer"
                    value={formValues.knownOffer}
                    rows={3}
                    disabled={isFieldIgnored("knownOffer")}
                    placeholder="Optional. Example: 20% off, free shipping over $75, sale ends Sunday, only 12 units left."
                    onChange={(event) =>
                      updateValue("knownOffer", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Extra campaign notes"
                  fullWidth
                  ignore={ignoreControl("merchantNotes")}
                >
                  <textarea
                    name="merchantNotes"
                    value={formValues.merchantNotes}
                    rows={3}
                    disabled={isFieldIgnored("merchantNotes")}
                    placeholder="Optional. Add brand constraints, audience notes, exclusions, merchandising rules, or anything the AI should respect."
                    onChange={(event) =>
                      updateValue("merchantNotes", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Event or season"
                  error={errors.eventName}
                  ignore={ignoreControl("eventName")}
                >
                  <input
                    name="eventName"
                    value={formValues.eventName}
                    disabled={isFieldIgnored("eventName")}
                    placeholder="Optional. Black Friday, launch week..."
                    onChange={(event) =>
                      updateValue("eventName", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Country"
                  error={errors.countryCode}
                  ignore={ignoreControl("countryCode")}
                >
                  <input
                    name="countryCode"
                    value={formValues.countryCode}
                    maxLength={2}
                    disabled={isFieldIgnored("countryCode")}
                    placeholder="US"
                    onChange={(event) =>
                      updateValue(
                        "countryCode",
                        event.currentTarget.value.toUpperCase(),
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Target URL"
                  error={errors.ctaUrl}
                  fullWidth
                  ignore={ignoreControl("ctaUrl")}
                >
                  <input
                    name="ctaUrl"
                    value={formValues.ctaUrl}
                    disabled={isFieldIgnored("ctaUrl")}
                    placeholder="/collections/sale"
                    onChange={(event) =>
                      updateValue("ctaUrl", event.currentTarget.value)
                    }
                  />
                </FormField>
              </div>
            </div>

            <details className="counterpulse-ai-advanced">
              <summary>Use the original compact fields</summary>
              <div className="counterpulse-form-grid">
                <FormField label="AI objective" error={errors.objective}>
                  <select
                    value={formValues.objective}
                    onChange={(event) =>
                      selectGoal(
                        event.currentTarget
                          .value as CampaignAiInput["objective"],
                      )
                    }
                  >
                    {campaignGoalOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  label="Product or category"
                  error={errors.productContext}
                >
                  <input
                    value={formValues.productContext}
                    required={!referenceImage}
                    onChange={(event) =>
                      updateValue("productContext", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Extra notes" fullWidth>
                  <textarea
                    value={formValues.merchantNotes}
                    rows={2}
                    onChange={(event) =>
                      updateValue("merchantNotes", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Event or season" error={errors.eventName}>
                  <input
                    value={formValues.eventName}
                    onChange={(event) =>
                      updateValue("eventName", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Country" error={errors.countryCode}>
                  <input
                    value={formValues.countryCode}
                    maxLength={2}
                    onChange={(event) =>
                      updateValue(
                        "countryCode",
                        event.currentTarget.value.toUpperCase(),
                      )
                    }
                  />
                </FormField>

                <FormField label="Language" error={errors.locale}>
                  <select
                    value={formValues.locale}
                    onChange={(event) =>
                      updateValue(
                        "locale",
                        event.currentTarget.value as CampaignAiInput["locale"],
                      )
                    }
                  >
                    {localeOptions.map((locale) => (
                      <option key={locale.locale} value={locale.locale}>
                        {locale.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Brand tone" error={errors.brandTone}>
                  <select
                    value={formValues.brandTone}
                    onChange={(event) =>
                      updateValue(
                        "brandTone",
                        event.currentTarget
                          .value as CampaignAiInput["brandTone"],
                      )
                    }
                  >
                    {campaignAiToneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  label="Real offer or discount"
                  error={errors.knownOffer}
                  fullWidth
                >
                  <textarea
                    value={formValues.knownOffer}
                    rows={2}
                    onChange={(event) =>
                      updateValue("knownOffer", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Target URL" error={errors.ctaUrl}>
                  <input
                    value={formValues.ctaUrl}
                    onChange={(event) =>
                      updateValue("ctaUrl", event.currentTarget.value)
                    }
                  />
                </FormField>
              </div>
            </details>

            <div className="counterpulse-actions">
              <button
                className="counterpulse-ai-action-button counterpulse-ai-submit"
                type="submit"
              >
                <AiGenerateIcon />
                <span>
                  {isGenerating
                    ? "Generating..."
                    : isAnsweringFollowUp
                      ? "Generate campaign with these answers"
                      : templateSourceName
                        ? "Generate campaign from template"
                        : "Generate with AI"}
                </span>
              </button>
            </div>
          </Form>

          {suggestion && (
            <s-box paddingBlockStart="base">
              <div
                className="counterpulse-card counterpulse-ai-suggestion-preview"
                ref={suggestionPreviewRef}
                tabIndex={-1}
              >
                <h3 className="counterpulse-section-heading">
                  AI suggestion preview
                </h3>

                {suggestion.safety.warnings.length > 0 && (
                  <AppAlert tone="warning" title="Review generated copy">
                    {suggestion.safety.warnings.map((warning) => (
                      <s-paragraph key={warning}>{warning}</s-paragraph>
                    ))}
                  </AppAlert>
                )}

                <div className="counterpulse-form-grid">
                  <PreviewItem label="Name" value={suggestion.campaign.name} />
                  <PreviewItem
                    label="Headline"
                    value={suggestion.campaign.headline}
                  />
                  <PreviewItem
                    label="Subheadline"
                    value={suggestion.campaign.subheadline}
                  />
                  <PreviewItem
                    label="CTA"
                    value={suggestion.campaign.ctaText}
                  />
                  <PreviewItem
                    label="Type"
                    value={formatEnum(suggestion.campaign.type)}
                  />
                  <PreviewItem
                    label="Placement"
                    value={suggestion.campaign.placementTypes
                      .map(formatEnum)
                      .join(", ")}
                  />
                  <PreviewItem
                    label="Timer"
                    value={`${formatEnum(suggestion.timer.mode)} · ${formatEnum(
                      suggestion.timer.expiredBehavior,
                    )}`}
                  />
                  <PreviewItem
                    label="Targeting"
                    value={`${formatEnum(
                      suggestion.targeting.productSelection,
                    )} · ${formatEnum(suggestion.targeting.countrySelection)}`}
                  />
                  <PreviewItem
                    label="Discount"
                    value={
                      suggestion.discount.mode === "NONE"
                        ? "No discount"
                        : `${formatEnum(
                            suggestion.discount.mode,
                          )} · ${formatEnum(suggestion.discount.valueType)}`
                    }
                  />
                </div>

                {suggestion.generatedAssets.length > 0 && (
                  <s-box paddingBlockStart="base">
                    <p className="counterpulse-kicker">
                      Generated assets ({suggestion.generatedAssets.length})
                    </p>
                    <div className="counterpulse-ai-asset-gallery">
                      {suggestion.generatedAssets.map((asset) => (
                        <figure
                          key={asset.shopifyFileId}
                          className="counterpulse-ai-asset-card"
                        >
                          <img alt={asset.assetType} src={asset.shopifyUrl} />
                          <figcaption>{formatEnum(asset.assetType)}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </s-box>
                )}

                {suggestion.variants.length > 0 && (
                  <s-box paddingBlockStart="base">
                    <table className="counterpulse-table">
                      <thead>
                        <tr>
                          <th>Variant</th>
                          <th>Headline</th>
                          <th>Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suggestion.variants.map((variant) => (
                          <tr key={variant.name}>
                            <td>{variant.name}</td>
                            <td>{variant.headline}</td>
                            <td>{variant.weight}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </s-box>
                )}

                <div className="counterpulse-actions">
                  <button
                    className="counterpulse-button"
                    onClick={() => {
                      applySuggestionToCampaignForm(suggestion);
                      setApplied(true);
                      onApplied?.();
                    }}
                    type="button"
                  >
                    Apply suggestion
                  </button>
                  <button
                    className="counterpulse-button-secondary"
                    disabled={isGenerating}
                    type="button"
                    onClick={() => setRefineModalOpen(true)}
                  >
                    {isGenerating ? "Regenerating..." : "Regenerate"}
                  </button>
                  {versionCount > 1 && (
                    <div className="counterpulse-version-nav">
                      <button
                        aria-label="Previous version"
                        className="counterpulse-button-secondary"
                        disabled={isGenerating || versionIndex <= 0}
                        type="button"
                        onClick={onPrevVersion}
                      >
                        ← Previous version
                      </button>
                      <span className="counterpulse-version-nav__label">
                        Version {versionIndex + 1} of {versionCount}
                      </span>
                      <button
                        aria-label="Next version"
                        className="counterpulse-button-secondary"
                        disabled={
                          isGenerating || versionIndex >= versionCount - 1
                        }
                        type="button"
                        onClick={onNextVersion}
                      >
                        Next version →
                      </button>
                    </div>
                  )}
                </div>

                {refineModalOpen && (
                  <RegenerateCloseModal
                    onClose={() => setRefineModalOpen(false)}
                    onSubmit={regenerateWith}
                  />
                )}

                {applied && (
                  <AppToast tone="success" title="Suggestion applied">
                    <s-paragraph>
                      Review the campaign fields before saving.
                    </s-paragraph>
                  </AppToast>
                )}
              </div>
            </s-box>
          )}
        </>
      )}
    </div>
  );
}

function AiGoalIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 3.2a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm0 3.2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z" />
    </svg>
  );
}

// Maps an arbitrary placement to the closest preview surface the compact promo
// renderer understands (mirrors the experiment variant preview behavior).
function resolveSuggestionPreviewSurface(placement: string | undefined): {
  placement:
    | "TOP_BAR"
    | "BOTTOM_BAR"
    | "PRODUCT_PAGE"
    | "CART_PAGE"
    | "CART_DRAWER"
    | "PRODUCT_BADGE";
  variant: "bar" | "block" | "badge";
} {
  if (placement === "PRODUCT_PAGE_BADGE" || placement === "COLLECTION_CARD") {
    return { placement: "PRODUCT_BADGE", variant: "badge" };
  }
  if (placement === "TOP_BAR" || placement === "BOTTOM_BAR") {
    return { placement, variant: "bar" };
  }
  if (placement === "CART_PAGE" || placement === "CART_DRAWER") {
    return { placement, variant: "block" };
  }
  return { placement: "PRODUCT_PAGE", variant: "block" };
}

// Renders a live promo preview of an AI suggestion using the same surface as the
// campaign editor and experiment variant previews, so the merchant sees what the
// campaign will look like before applying it.
export function SuggestionMiniPreview({
  suggestion,
}: {
  suggestion: CampaignSuggestion;
}) {
  const viewModel = useMemo(() => {
    const placementTypes =
      suggestion.campaign.placementTypes.length > 0
        ? suggestion.campaign.placementTypes
        : [suggestion.campaign.placementType];
    const type = suggestion.campaign.type;

    return buildCampaignViewModel({
      name: suggestion.campaign.name || "Campaign preview",
      type,
      endsAt: suggestion.timer.endsAt || null,
      timezone: "UTC",
      placements: placementTypes.map((placementType) => ({
        placementType,
        enabled: true,
      })),
      translations: [
        {
          locale: "en",
          headline: suggestion.campaign.headline,
          subheadline: suggestion.campaign.subheadline,
          ctaText: suggestion.campaign.ctaText || "Shop now",
          ctaUrl: suggestion.campaign.ctaUrl || "#",
          expiredText: suggestion.campaign.expiredText,
          badgeText: suggestion.badge.badgeText,
        },
      ],
      design: suggestion.design,
      timerSettings: {
        mode: suggestion.timer.mode,
        durationMinutes: Number(suggestion.timer.durationMinutes) || null,
        expiredBehavior: suggestion.timer.expiredBehavior,
        resetBehavior: suggestion.timer.resetBehavior,
      },
      freeShippingSettings:
        type === "FREE_SHIPPING_GOAL"
          ? {
              thresholdAmount: suggestion.freeShipping.thresholdAmount || "0",
              currencyCode: suggestion.freeShipping.currencyCode || "USD",
              includeDiscountedSubtotal:
                suggestion.freeShipping.includeDiscountedSubtotal,
              emptyCartMessage: suggestion.freeShipping.emptyCartMessage,
              successMessage: suggestion.freeShipping.successMessage,
              progressStyle: suggestion.freeShipping.progressStyle,
            }
          : null,
      lowStockSettings:
        type === "LOW_STOCK"
          ? {
              threshold: Number(suggestion.lowStock.threshold) || 0,
              showExactQuantity: suggestion.lowStock.showExactQuantity,
              fallbackMessage: suggestion.lowStock.fallbackMessage,
            }
          : null,
      badgeSettings:
        type === "PRODUCT_BADGE"
          ? {
              badgeText: suggestion.badge.badgeText,
              badgeShape: suggestion.badge.badgeShape,
              badgePosition: suggestion.badge.badgePosition,
            }
          : null,
      deliveryCutoffSettings:
        type === "DELIVERY_CUTOFF"
          ? {
              cutoffHour: Number(suggestion.deliveryCutoff.cutoffHour) || 0,
              cutoffMinute: Number(suggestion.deliveryCutoff.cutoffMinute) || 0,
              processingDays:
                Number(suggestion.deliveryCutoff.processingDays) || 0,
              minDeliveryDays:
                Number(suggestion.deliveryCutoff.minDeliveryDays) || 0,
              maxDeliveryDays:
                Number(suggestion.deliveryCutoff.maxDeliveryDays) || 0,
              afterCutoffBehavior:
                suggestion.deliveryCutoff.afterCutoffBehavior,
            }
          : null,
    });
  }, [suggestion]);

  const { placement, variant } = resolveSuggestionPreviewSurface(
    viewModel.placements[0],
  );

  // Render from the generated structural HTML/CSS (with the uploaded asset URLs
  // already baked in) so the drawer preview matches the Design/Campaign previews
  // and the storefront.
  const structureTree = useMemo(
    () => (suggestion.structureHtml ? htmlToTree(suggestion.structureHtml) : null),
    [suggestion.structureHtml],
  );

  return (
    <div className="counterpulse-ai-suggestion-preview__surface-wrap">
      <span className="counterpulse-kicker">Preview</span>
      <div className="counterpulse-variant-preview">
        <CampaignPromoSurface
          className="counterpulse-variant-preview__surface"
          dataTestId="ai-suggestion-preview-surface"
          design={suggestion.design}
          placement={placement}
          structureTree={structureTree}
          structureCss={suggestion.structureCss}
          variant={variant}
          viewModel={viewModel}
        />
      </div>
    </div>
  );
}

// Closeness ratings shown before regenerating. The label is the phrase sent to
// the AI so it knows how much to change the design.
const REGENERATE_CLOSENESS_OPTIONS = [
  {
    label: "Not close at all — rethink the design",
    hint: "Explore a noticeably different direction.",
  },
  {
    label: "Somewhat close — needs significant changes",
    hint: "Keep the intent but change the layout substantially.",
  },
  {
    label: "Fairly close — moderate adjustments",
    hint: "Refine the structure and styling.",
  },
  {
    label: "Very close — minor refinements",
    hint: "Polish details; keep the overall design.",
  },
];

function RegenerateCloseModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (closeness: string, comment: string) => void;
  onClose: () => void;
}) {
  const [closeness, setCloseness] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="counterpulse-modal-backdrop">
      <button
        aria-label="Close"
        className="counterpulse-modal-backdrop__dismiss"
        tabIndex={-1}
        type="button"
        onClick={onClose}
      />
      <div
        aria-label="Regenerate campaign"
        aria-modal="true"
        className="counterpulse-modal counterpulse-modal--choice"
        role="dialog"
      >
        <div className="counterpulse-modal__header">
          <div>
            <h2>How close is this design to what you want?</h2>
            <p className="counterpulse-design-note">
              Your answer tells the AI how much to change. It improves the current
              draft instead of starting over.
            </p>
          </div>
        </div>
        <div className="counterpulse-modal__body">
          <div className="counterpulse-regenerate-options">
            {REGENERATE_CLOSENESS_OPTIONS.map((option) => (
              <button
                key={option.label}
                aria-pressed={closeness === option.label}
                className={
                  closeness === option.label
                    ? "counterpulse-regenerate-option is-selected"
                    : "counterpulse-regenerate-option"
                }
                type="button"
                onClick={() => setCloseness(option.label)}
              >
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
          <label className="counterpulse-form-field">
            <span>What should change? (optional)</span>
            <textarea
              placeholder="e.g. the timer overlaps the text on mobile; use a lighter background; make the button bigger…"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
        </div>
        <div className="counterpulse-modal__actions">
          <button
            className="counterpulse-button-secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="counterpulse-button"
            disabled={!closeness}
            type="button"
            onClick={() => onSubmit(closeness, comment.trim())}
          >
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

function ReferenceImageIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path
        d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v8.6l3.3-3.3a1 1 0 0 1 1.4 0l2.3 2.3 3.3-3.3a1 1 0 0 1 1.4 0L19 14V6H5Zm4 2.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function applySuggestionToCampaignForm(suggestion: CampaignSuggestion) {
  const payload = JSON.stringify(suggestion);
  const campaignValues: Partial<CampaignFormValues> = {
    goal: suggestion.campaign.goal,
    type: suggestion.campaign.type,
    placementType: suggestion.campaign.placementType,
    placementTypes: suggestion.campaign.placementTypes,
    name: suggestion.campaign.name,
    status: "DRAFT",
    headline: suggestion.campaign.headline,
    subheadline: suggestion.campaign.subheadline,
    ctaText: suggestion.campaign.ctaText,
    ctaUrl: suggestion.campaign.ctaUrl,
    expiredText: suggestion.campaign.expiredText,
    timerMode: suggestion.timer.mode,
    timerDurationMinutes: suggestion.timer.durationMinutes,
    timerResetBehavior: suggestion.timer.resetBehavior,
    timerExpiredBehavior: suggestion.timer.expiredBehavior,
    timerRecurringHour: suggestion.timer.recurringHour,
    timerRecurringMinute: suggestion.timer.recurringMinute,
    startsAt: suggestion.timer.startsAt,
    endsAt: suggestion.timer.endsAt,
    productSelection: suggestion.targeting.productSelection,
    productIds: suggestion.targeting.productIds.join("\n"),
    excludeProductIds: suggestion.targeting.excludeProductIds.join("\n"),
    collectionIds: suggestion.targeting.collectionIds.join("\n"),
    productTags: suggestion.targeting.productTags.join("\n"),
    customSelector: suggestion.targeting.customSelector,
    customStyle: suggestion.targeting.customStyle,
    urlContains: (suggestion.targeting.urlContains ?? []).join("\n"),
    excludedUrlContains: (suggestion.targeting.excludedUrlContains ?? []).join(
      "\n",
    ),
    countrySelection: suggestion.targeting.countrySelection,
    countries: suggestion.targeting.countries.join("\n"),
  };

  setRadioValue("goal", suggestion.campaign.goal);
  setFieldValue("type", suggestion.campaign.type);
  setFieldValue("placementType", suggestion.campaign.placementType);
  setFieldValue("name", suggestion.campaign.name);
  setFieldValue("status", "DRAFT");
  setFieldValue("headline", suggestion.campaign.headline);
  setFieldValue("subheadline", suggestion.campaign.subheadline);
  setFieldValue("ctaText", suggestion.campaign.ctaText);
  setFieldValue("ctaUrl", suggestion.campaign.ctaUrl);
  setFieldValue("aiSuggestionJson", payload);
  window.dispatchEvent(
    new CustomEvent("promo-pulse:ai-apply-values", {
      detail: {
        design: suggestion.design,
        values: campaignValues,
      },
    }),
  );
  window.dispatchEvent(
    new CustomEvent("promo-pulse:ai-suggestion-json", { detail: payload }),
  );
  window.requestAnimationFrame(() => {
    setFieldValue("aiSuggestionJson", payload);
    window.dispatchEvent(
      new CustomEvent("promo-pulse:ai-apply-values", {
        detail: {
          design: suggestion.design,
          values: campaignValues,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("promo-pulse:ai-suggestion-json", { detail: payload }),
    );
  });
}

function setFieldValue(name: string, value: string) {
  const campaignForm = document.querySelector("[data-campaign-form]");
  const element = campaignForm?.querySelector<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >(`[name="${name}"]`);

  if (!element) return;

  setNativeValue(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setRadioValue(name: string, value: string) {
  const campaignForm = document.querySelector("[data-campaign-form]");
  const radios = campaignForm?.querySelectorAll<HTMLInputElement>(
    `input[type="radio"][name="${name}"]`,
  );
  const selectedRadio = Array.from(radios ?? []).find(
    (radio) => radio.value === value,
  );

  if (!selectedRadio) return;

  if (selectedRadio.checked) {
    selectedRadio.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  selectedRadio.click();
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  const prototype = Object.getPrototypeOf(element) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (valueSetter) {
    valueSetter.call(element, value);
    return;
  }

  element.value = value;
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="counterpulse-empty-state__title">{label}</div>
      <div>{value || "-"}</div>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
  fullWidth = false,
  ignore,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  fullWidth?: boolean;
  ignore?: { active: boolean; onToggle: () => void };
}) {
  const ignored = Boolean(ignore?.active);
  const controlId = useId();
  const className = [
    "counterpulse-form-field",
    fullWidth ? "counterpulse-form-field--full" : "",
    ignored ? "counterpulse-form-field--ignored" : "",
  ]
    .filter(Boolean)
    .join(" ");
  // Associate the label with its control explicitly so the in-label "Ignore"
  // toggle never steals the implicit label association from the input.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id: controlId })
    : children;

  return (
    <label className={className} htmlFor={controlId}>
      <span className="counterpulse-form-field__head">
        <span>{label}</span>
        {ignore && (
          <IgnoreToggle active={ignore.active} onToggle={ignore.onToggle} />
        )}
      </span>
      {control}
      {error && <span className="counterpulse-form-error">{error}</span>}
    </label>
  );
}

function IgnoreToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-checked={active}
      className={
        active
          ? "counterpulse-ai-ignore counterpulse-ai-ignore--active"
          : "counterpulse-ai-ignore"
      }
      role="switch"
      type="button"
      onClick={(event) => {
        // Keep the wrapping label from also focusing/toggling its control.
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <span aria-hidden="true" className="counterpulse-ai-ignore__box" />
      Ignore
    </button>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function collectOfferText(answers: CampaignAiAnswerMap, flow: GoalFlowConfig) {
  return collectOptionText(answers, flow, "offerText");
}

function collectNotesText(answers: CampaignAiAnswerMap, flow: GoalFlowConfig) {
  return collectOptionText(answers, flow, "notesText");
}

function collectOptionText(
  answers: CampaignAiAnswerMap,
  flow: GoalFlowConfig,
  key: "offerText" | "notesText",
) {
  const optionsById = new Map(
    flow.questions.flatMap((question) =>
      question.options.map((option) => [option.id, option] as const),
    ),
  );

  return Object.values(answers)
    .flat()
    .map((answerId) => optionsById.get(answerId)?.[key])
    .filter((value): value is string => Boolean(value));
}

function appendKnownOfferLine(value: string, line: string) {
  return mergeKnownOfferLines(value, [], [line]);
}

function removeKnownOfferLine(value: string, line: string) {
  return removeKnownOfferLines(value, [line]);
}

function removeKnownOfferLines(value: string, lines: string[]) {
  const blockedLines = new Set(lines);

  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter((item) => item && !blockedLines.has(item))
    .join("\n");
}

function mergeKnownOfferLines(
  value: string,
  quickStarts: string[],
  extraLines: string[],
) {
  return uniqueStrings([
    ...value
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean),
    ...quickStarts,
    ...extraLines,
  ]).join("\n");
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
