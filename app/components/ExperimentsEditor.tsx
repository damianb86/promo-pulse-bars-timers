import type { ReactNode } from "react";
import { AppAlert, FieldInfoButton } from "./Notifications";
import { Form, useNavigation } from "react-router";

import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

export type ExperimentVariantRow = {
  id: string;
  name: string;
  weight: number;
  status: string;
  designOverrideJson: string;
  textOverrideJson: string;
  discountOverrideJson: string;
  placementOverrideJson: string;
};

export type ExperimentVariantResultRow = {
  variantId: string;
  variantName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  addToCart: number;
  checkoutStarted: number;
  orders: number;
  revenue: number;
  revenuePerVisitor: number;
  conversionRate: number;
  visitors: number;
  primaryMetricValue: number;
};

export type ExperimentRow = {
  id: string;
  name: string;
  status: string;
  primaryMetric: string;
  trafficSplitStrategy: string;
  startsAt: string;
  endsAt: string;
  winnerVariantId: string;
  autoWinnerEnabled: boolean;
  autoWinnerMinSampleSize: number;
  autoWinnerMinRuntimeHours: number;
  autoWinnerConfidenceThreshold: number;
  variants: ExperimentVariantRow[];
  results: {
    runtimeHours: number;
    currencyCode: string;
    variants: ExperimentVariantResultRow[];
  };
};

export type ExperimentErrors = {
  form?: string;
  [key: string]: string | undefined;
};

type ExperimentsEditorProps = {
  errors?: ExperimentErrors;
  experiments: ExperimentRow[];
  lockedReason?: string;
  notice?: string;
};

const metricOptions = [
  { label: "CTR", value: "CLICK_RATE" },
  { label: "ADD_TO_CART_RATE", value: "ADD_TO_CART_RATE" },
  { label: "CHECKOUT_RATE", value: "CHECKOUT_RATE" },
  { label: "REVENUE_PER_VISITOR", value: "REVENUE_PER_VISITOR" },
];

const defaultVariants: ExperimentVariantRow[] = [
  {
    id: "",
    name: "Control",
    weight: 50,
    status: "DRAFT",
    designOverrideJson: "",
    textOverrideJson: "",
    discountOverrideJson: "",
    placementOverrideJson: "",
  },
  {
    id: "",
    name: "Variant B",
    weight: 50,
    status: "DRAFT",
    designOverrideJson: "",
    textOverrideJson: "",
    discountOverrideJson: "",
    placementOverrideJson: "",
  },
];

export function ExperimentsEditor({
  errors,
  experiments,
  lockedReason,
  notice,
}: ExperimentsEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-section heading="Experiments">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Experiments are locked"
        />
      )}

      {notice && (
        <AppAlert tone="info" title="Experiments updated">
          <s-paragraph>{notice}</s-paragraph>
        </AppAlert>
      )}

      {errors?.form && (
        <AppAlert tone="critical" title="Experiments could not be updated">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <>
          <Form method="post" className="counterpulse-form">
            <input name="_action" type="hidden" value="createExperiment" />
            <div className="counterpulse-form-grid">
              <FormField label="Experiment name">
                <input name="name" defaultValue="Campaign A/B test" required />
              </FormField>
              <FormField
                label="Primary metric"
                info={
                  <FieldInfoButton
                    label="Primary metric"
                    title="Experiment primary metric"
                  >
                    <ExperimentInfoContent
                      intro="The primary metric is the one Promo Pulse uses when comparing variants and detecting a winner."
                      items={[
                        [
                          "CTR",
                          "Best when you are testing headline, CTA, design, or placement engagement.",
                        ],
                        [
                          "Add-to-cart rate",
                          "Best when the campaign should move shoppers from viewing to cart intent.",
                        ],
                        [
                          "Checkout rate",
                          "Best for cart or checkout-focused urgency and offer messaging.",
                        ],
                        [
                          "Revenue per visitor",
                          "Best when discount depth or offer quality matters more than clicks.",
                        ],
                      ]}
                    />
                  </FieldInfoButton>
                }
              >
                <select name="primaryMetric" defaultValue="CLICK_RATE">
                  {metricOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <VariantFields variants={defaultVariants} />

            <div className="counterpulse-actions">
              <button className="counterpulse-button" type="submit">
                {isSubmitting ? "Creating..." : "Create experiment"}
              </button>
            </div>
          </Form>

          <s-box paddingBlockStart="base">
            <table className="counterpulse-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Primary metric</th>
                  <th>Winner</th>
                  <th>Variants</th>
                  <th>Started</th>
                  <th>Ended</th>
                </tr>
              </thead>
              <tbody>
                {experiments.length > 0 ? (
                  experiments.map((experiment) => (
                    <tr key={experiment.id}>
                      <td>{experiment.name}</td>
                      <td>{formatEnum(experiment.status)}</td>
                      <td>{formatMetric(experiment.primaryMetric)}</td>
                      <td>{winnerName(experiment)}</td>
                      <td>{experiment.variants.length}</td>
                      <td>{experiment.startsAt || "-"}</td>
                      <td>{experiment.endsAt || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>No experiments created yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </s-box>

          {experiments.map((experiment) => (
            <s-box key={experiment.id} paddingBlockStart="base">
              <Form method="post" className="counterpulse-form">
                <input name="_action" type="hidden" value="updateExperiment" />
                <input
                  name="experimentId"
                  type="hidden"
                  value={experiment.id}
                />
                <div className="counterpulse-form-grid">
                  <FormField label="Experiment name">
                    <input name="name" defaultValue={experiment.name} />
                  </FormField>
                  <FormField
                    label="Primary metric"
                    info={
                      <FieldInfoButton
                        label="Primary metric"
                        title="Experiment primary metric"
                      >
                        <ExperimentInfoContent
                          intro="Changing this affects future winner detection and reporting interpretation for the experiment."
                          items={[
                            [
                              "CTR",
                              "Compares click rate: clicks divided by impressions.",
                            ],
                            [
                              "Add-to-cart rate",
                              "Compares add-to-cart events divided by visitors or impressions.",
                            ],
                            [
                              "Checkout rate",
                              "Compares checkout-started events for each variant.",
                            ],
                            [
                              "Revenue per visitor",
                              "Compares attributed revenue normalized by visitor count.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
                  >
                    <select
                      name="primaryMetric"
                      defaultValue={experiment.primaryMetric}
                    >
                      {metricOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <VariantFields variants={experiment.variants} />

                <div className="counterpulse-actions">
                  <button className="counterpulse-button" type="submit">
                    {isSubmitting ? "Saving..." : "Save experiment"}
                  </button>
                </div>
              </Form>

              <s-box paddingBlockStart="base">
                <h3 className="counterpulse-section-heading">
                  Experiment Results
                </h3>
                <table className="counterpulse-table">
                  <thead>
                    <tr>
                      <th>Variant</th>
                      <th>Impressions</th>
                      <th>Clicks</th>
                      <th>CTR</th>
                      <th>Add-to-cart</th>
                      <th>Checkout started</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>RPV</th>
                      <th>Conversion</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {experiment.results.variants.map((variant) => (
                      <tr key={variant.variantId}>
                        <td>
                          {variant.variantName}
                          {variant.variantId === experiment.winnerVariantId
                            ? " (winner)"
                            : ""}
                        </td>
                        <td>{variant.impressions}</td>
                        <td>{variant.clicks}</td>
                        <td>{formatPercent(variant.ctr)}</td>
                        <td>{variant.addToCart}</td>
                        <td>{variant.checkoutStarted}</td>
                        <td>{variant.orders}</td>
                        <td>
                          {formatCurrency(
                            variant.revenue,
                            experiment.results.currencyCode,
                          )}
                        </td>
                        <td>
                          {formatCurrency(
                            variant.revenuePerVisitor,
                            experiment.results.currencyCode,
                          )}
                        </td>
                        <td>{formatPercent(variant.conversionRate)}</td>
                        <td>
                          <Form method="post">
                            <input
                              name="experimentId"
                              type="hidden"
                              value={experiment.id}
                            />
                            <input
                              name="variantId"
                              type="hidden"
                              value={variant.variantId}
                            />
                            <button
                              className="counterpulse-button"
                              name="_action"
                              type="submit"
                              value="declareExperimentWinner"
                            >
                              Declare winner
                            </button>
                          </Form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </s-box>

              <Form method="post" className="counterpulse-form">
                <input
                  name="_action"
                  type="hidden"
                  value="saveExperimentAutoWinner"
                />
                <input
                  name="experimentId"
                  type="hidden"
                  value={experiment.id}
                />
                <div className="counterpulse-form-grid">
                  <div className="counterpulse-toggle">
                    <label className="counterpulse-toggle-label">
                      <input
                        name="autoWinnerEnabled"
                        type="checkbox"
                        defaultChecked={experiment.autoWinnerEnabled}
                      />
                      <span>Enable auto-winner</span>
                    </label>
                    <FieldInfoButton
                      label="Enable auto-winner"
                      title="Auto-winner"
                    >
                      <ExperimentInfoContent
                        intro="Auto-winner can detect a likely winning variant using conservative thresholds."
                        items={[
                          [
                            "No silent publish by default",
                            "The winner is not applied to the base campaign unless the explicit apply action or setting allows it.",
                          ],
                          [
                            "Sample and runtime",
                            "Minimum sample size and runtime prevent early, noisy winners.",
                          ],
                          [
                            "Confidence",
                            "The threshold is a simple conservative guard, not a full statistical engine.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  </div>
                  <FormField
                    label="Minimum sample size"
                    info={
                      <FieldInfoButton
                        label="Minimum sample size"
                        title="Minimum sample size"
                      >
                        <ExperimentInfoContent
                          intro="Sample size is the minimum amount of traffic each relevant variant should have before winner detection is trusted."
                          items={[
                            [
                              "Higher values",
                              "Reduce noisy decisions but make tests run longer.",
                            ],
                            [
                              "Lower values",
                              "Speed up detection but increase the chance of choosing a weak winner.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
                  >
                    <input
                      name="autoWinnerMinSampleSize"
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={experiment.autoWinnerMinSampleSize}
                    />
                  </FormField>
                  <FormField label="Minimum runtime hours">
                    <input
                      name="autoWinnerMinRuntimeHours"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={experiment.autoWinnerMinRuntimeHours}
                    />
                  </FormField>
                  <FormField
                    label="Confidence threshold"
                    info={
                      <FieldInfoButton
                        label="Confidence threshold"
                        title="Confidence threshold"
                      >
                        <ExperimentInfoContent
                          intro="Confidence threshold controls how conservative the auto-winner rule should be."
                          items={[
                            ["0.95", "Conservative default for most tests."],
                            [
                              "0.90 or lower",
                              "Faster but less strict. Use when speed matters more than certainty.",
                            ],
                            [
                              "0.99",
                              "Very strict. Useful for high-traffic campaigns.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
                  >
                    <input
                      name="autoWinnerConfidenceThreshold"
                      type="number"
                      min="0.5"
                      max="0.99"
                      step="0.01"
                      defaultValue={experiment.autoWinnerConfidenceThreshold}
                    />
                  </FormField>
                </div>
                <div className="counterpulse-actions">
                  <button className="counterpulse-button" type="submit">
                    Save auto-winner
                  </button>
                </div>
              </Form>

              <Form method="post" className="counterpulse-actions">
                <input
                  name="experimentId"
                  type="hidden"
                  value={experiment.id}
                />
                <button
                  className="counterpulse-button"
                  name="_action"
                  type="submit"
                  value="startExperiment"
                >
                  Start
                </button>
                <button
                  className="counterpulse-button"
                  name="_action"
                  type="submit"
                  value="pauseExperiment"
                >
                  Pause
                </button>
                <button
                  className="counterpulse-button"
                  name="_action"
                  type="submit"
                  value="stopExperiment"
                >
                  Stop experiment
                </button>
                <button
                  className="counterpulse-button"
                  name="_action"
                  type="submit"
                  value="detectExperimentWinner"
                >
                  Auto declare winner
                </button>
                <button
                  className="counterpulse-button"
                  disabled={!experiment.winnerVariantId}
                  name="_action"
                  type="submit"
                  value="applyExperimentWinner"
                >
                  Apply winner
                </button>
              </Form>
            </s-box>
          ))}
        </>
      )}
    </s-section>
  );
}

function VariantFields({ variants }: { variants: ExperimentVariantRow[] }) {
  return (
    <>
      {variants.map((variant, index) => (
        <div className="counterpulse-form-grid" key={variant.id || index}>
          <input name="variantId" type="hidden" value={variant.id} />
          <FormField label={`Variant ${index + 1} name`}>
            <input name="variantName" defaultValue={variant.name} required />
          </FormField>
          <FormField
            label={`Variant ${index + 1} weight`}
            info={
              index === 0 ? (
                <FieldInfoButton
                  label="Variant weight"
                  title="Variant traffic weights"
                >
                  <ExperimentInfoContent
                    intro="Weights control how likely a new visitor is to be assigned to each active variant."
                    items={[
                      [
                        "Stable visitor assignment",
                        "After a visitor receives a variant, Promo Pulse keeps that assignment stable.",
                      ],
                      [
                        "Relative weights",
                        "50 and 50 split evenly. 1 and 100 strongly favors the second variant.",
                      ],
                      [
                        "Zero weight",
                        "Avoids assigning new visitors while preserving the variant configuration.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              ) : null
            }
          >
            <input
              name="variantWeight"
              type="number"
              min="0"
              max="10000"
              step="1"
              defaultValue={variant.weight}
            />
          </FormField>
          <FormField
            label={`Variant ${index + 1} status`}
            info={
              index === 0 ? (
                <FieldInfoButton label="Variant status" title="Variant status">
                  <ExperimentInfoContent
                    intro="Variant status controls whether a variant can receive new traffic and how results are interpreted."
                    items={[
                      [
                        "Draft",
                        "Configured but not intended for live assignment yet.",
                      ],
                      [
                        "Active",
                        "Eligible for visitor assignment while the experiment is running.",
                      ],
                      [
                        "Paused",
                        "Keeps historical results but stops new assignment.",
                      ],
                      [
                        "Winner or loser",
                        "Used after analysis to record the decision.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              ) : null
            }
          >
            <select name="variantStatus" defaultValue={variant.status}>
              {["DRAFT", "ACTIVE", "PAUSED", "WINNER", "LOSER", "ARCHIVED"].map(
                (status) => (
                  <option key={status} value={status}>
                    {formatEnum(status)}
                  </option>
                ),
              )}
            </select>
          </FormField>
          <FormField
            label={`Variant ${index + 1} text override JSON`}
            info={
              index === 0 ? (
                <FieldInfoButton
                  label="Text override JSON"
                  title="Text overrides"
                >
                  <ExperimentInfoContent
                    intro="Text overrides define what copy is different from the base campaign for this variant."
                    items={[
                      [
                        "Supported fields",
                        "Use keys such as headline, subheadline, ctaText, ctaUrl, or expiredText.",
                      ],
                      [
                        "Control variant",
                        "Leave the control blank to keep base campaign copy.",
                      ],
                      [
                        "Example",
                        '{"headline":"Ends tonight","ctaText":"Shop now"}.',
                      ],
                    ]}
                  />
                </FieldInfoButton>
              ) : null
            }
          >
            <textarea
              name="textOverride"
              defaultValue={variant.textOverrideJson}
              rows={3}
            />
          </FormField>
          <FormField
            label={`Variant ${index + 1} design override JSON`}
            info={
              index === 0 ? (
                <FieldInfoButton
                  label="Design override JSON"
                  title="Design overrides"
                >
                  <ExperimentInfoContent
                    intro="Design overrides let a variant test visual changes without changing the base campaign design."
                    items={[
                      [
                        "Typical fields",
                        "Colors, typography, button style, spacing, or layout values supported by the campaign preview model.",
                      ],
                      [
                        "Scope",
                        "Only include fields that should differ. Blank keeps the base design.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              ) : null
            }
          >
            <textarea
              name="designOverride"
              defaultValue={variant.designOverrideJson}
              rows={3}
            />
          </FormField>
          <FormField
            label={`Variant ${index + 1} discount override JSON`}
            info={
              index === 0 ? (
                <FieldInfoButton
                  label="Discount override JSON"
                  title="Discount overrides"
                >
                  <ExperimentInfoContent
                    intro="Discount overrides are for testing real offer differences between variants."
                    items={[
                      [
                        "Real discounts only",
                        "Do not enter a code or value unless the merchant has a matching real discount setup.",
                      ],
                      [
                        "Common key",
                        'Use {"discountCode":"SAVE20"} to show a variant-specific code.',
                      ],
                    ]}
                  />
                </FieldInfoButton>
              ) : null
            }
          >
            <textarea
              name="discountOverride"
              defaultValue={variant.discountOverrideJson}
              rows={3}
            />
          </FormField>
          <FormField
            label={`Variant ${index + 1} placement override JSON`}
            info={
              index === 0 ? (
                <FieldInfoButton
                  label="Placement override JSON"
                  title="Placement overrides"
                >
                  <ExperimentInfoContent
                    intro="Placement overrides test where the campaign appears, while preserving stable visitor assignment."
                    items={[
                      [
                        "Use carefully",
                        "Theme support can differ by placement, so test the storefront before starting the experiment.",
                      ],
                      [
                        "Blank state",
                        "Leave blank to use the base campaign placement.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              ) : null
            }
          >
            <textarea
              name="placementOverride"
              defaultValue={variant.placementOverrideJson}
              rows={3}
            />
          </FormField>
        </div>
      ))}
    </>
  );
}

function ExperimentInfoContent({
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

function FormField({
  label,
  children,
  info,
}: {
  label: string;
  children: ReactNode;
  info?: ReactNode;
}) {
  return (
    <div className="counterpulse-form-field">
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      <label className="counterpulse-field-control">
        <span className="counterpulse-sr-only">{label}</span>
        {children}
      </label>
    </div>
  );
}

function formatMetric(value: string) {
  return value === "CLICK_RATE" ? "CTR" : value;
}

function winnerName(experiment: ExperimentRow) {
  if (!experiment.winnerVariantId) return "-";

  return (
    experiment.variants.find(
      (variant) => variant.id === experiment.winnerVariantId,
    )?.name ?? experiment.winnerVariantId
  );
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";

  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode || "USD",
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
