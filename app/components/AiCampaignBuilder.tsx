import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppAlert, AppToast } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  type CampaignAiAnswerMap,
  type CampaignAiFollowUpQuestion,
  campaignAiToneOptions,
  type CampaignAiFormErrors,
  type CampaignAiInput,
  type CampaignSuggestion,
} from "../types/ai-campaign";
import type { CampaignFormValues } from "../types/campaign-form";
import { campaignGoalOptions } from "../types/campaign-options";
import { storefrontLocales } from "../types/localization";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

type AiCampaignBuilderProps = {
  errors?: CampaignAiFormErrors;
  followUpQuestions?: CampaignAiFollowUpQuestion[];
  lockedReason?: string;
  onApplied?: () => void;
  suggestion?: CampaignSuggestion | null;
  templateSourceName?: string;
  values: CampaignAiInput;
};

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
  onApplied,
  suggestion,
  templateSourceName,
  values,
}: AiCampaignBuilderProps) {
  const navigation = useNavigation();
  const suggestionPreviewRef = useRef<HTMLDivElement | null>(null);
  const [applied, setApplied] = useState(false);
  const [formValues, setFormValues] = useState(values);
  const [followUpAnswers, setFollowUpAnswers] = useState<CampaignAiAnswerMap>(
    {},
  );
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

  useEffect(() => {
    const syncFormValues = window.setTimeout(() => {
      setFormValues(values);
    }, 0);

    return () => window.clearTimeout(syncFormValues);
  }, [values]);

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
                Generate variants from {templateSourceName}, then review before
                applying or saving.
              </s-paragraph>
            </AppAlert>
          )}

          <div className="counterpulse-ai-builder__intro">
            <span className="counterpulse-ai-builder__icon" aria-hidden="true">
              <AiSparkIcon />
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

          <Form method="post" className="counterpulse-form">
            <input
              name="_action"
              type="hidden"
              value="generateAiCampaignSuggestion"
            />
            <input
              name="objective"
              type="hidden"
              value={formValues.objective}
            />
            <input
              name="brandTone"
              type="hidden"
              value={formValues.brandTone}
            />
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
            <input
              name="quickStartsJson"
              type="hidden"
              value={JSON.stringify(formValues.quickStarts)}
            />
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

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Goal setup</p>
                <h3>{activeGoalFlow.summary}</h3>
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

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Tone</p>
                <h3>How should the campaign sound?</h3>
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

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Offer</p>
                <h3>Pick any relevant starting points</h3>
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
                <FormField label="Campaign name hint">
                  <input
                    name="campaignNameHint"
                    value={formValues.campaignNameHint}
                    placeholder="Optional. Leave blank to generate a name."
                    onChange={(event) =>
                      updateValue("campaignNameHint", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Language" error={errors.locale}>
                  <select
                    name="locale"
                    value={formValues.locale}
                    onChange={(event) =>
                      updateValue(
                        "locale",
                        event.currentTarget.value as CampaignAiInput["locale"],
                      )
                    }
                  >
                    {storefrontLocales.map((locale) => (
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
                >
                  <textarea
                    name="productContext"
                    value={formValues.productContext}
                    rows={3}
                    placeholder="Example: premium skincare bundles, summer dresses, returning customers, first-time buyers."
                    required
                    onChange={(event) =>
                      updateValue("productContext", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Offer details"
                  error={errors.knownOffer}
                  fullWidth
                >
                  <textarea
                    name="knownOffer"
                    value={formValues.knownOffer}
                    rows={3}
                    placeholder="Optional. Example: 20% off, free shipping over $75, sale ends Sunday, only 12 units left."
                    onChange={(event) =>
                      updateValue("knownOffer", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Extra campaign notes" fullWidth>
                  <textarea
                    name="merchantNotes"
                    value={formValues.merchantNotes}
                    rows={3}
                    placeholder="Optional. Add brand constraints, audience notes, exclusions, merchandising rules, or anything the AI should respect."
                    onChange={(event) =>
                      updateValue("merchantNotes", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Event or season" error={errors.eventName}>
                  <input
                    name="eventName"
                    value={formValues.eventName}
                    placeholder="Optional. Black Friday, launch week..."
                    onChange={(event) =>
                      updateValue("eventName", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Country" error={errors.countryCode}>
                  <input
                    name="countryCode"
                    value={formValues.countryCode}
                    maxLength={2}
                    placeholder="US"
                    onChange={(event) =>
                      updateValue(
                        "countryCode",
                        event.currentTarget.value.toUpperCase(),
                      )
                    }
                  />
                </FormField>

                <FormField label="Target URL" error={errors.ctaUrl} fullWidth>
                  <input
                    name="ctaUrl"
                    value={formValues.ctaUrl}
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
                    required
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
                    {storefrontLocales.map((locale) => (
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
              <button className="counterpulse-ai-submit" type="submit">
                {isGenerating
                  ? "Generating..."
                  : isAnsweringFollowUp
                    ? "Generate campaign with these answers"
                    : templateSourceName
                      ? "Generate variants from template"
                      : "Generate with AI"}
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
                </div>

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

function AiSparkIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 2.5 13.6 8l5.6 1.6-5.6 1.6L12 16.7l-1.6-5.5-5.6-1.6L10.4 8 12 2.5Z" />
      <path d="M18.5 14.2 19.4 17l2.9.9-2.9.9-.9 2.8-.9-2.8-2.8-.9 2.8-.9.9-2.8Z" />
    </svg>
  );
}

function AiGoalIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 3.2a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm0 3.2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z" />
    </svg>
  );
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
}: {
  label: string;
  error?: string;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <label
      className={
        fullWidth
          ? "counterpulse-form-field counterpulse-form-field--full"
          : "counterpulse-form-field"
      }
    >
      <span>{label}</span>
      {children}
      {error && <span className="counterpulse-form-error">{error}</span>}
    </label>
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
