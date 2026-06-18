import type { ReactNode } from "react";
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

export type ExperimentRow = {
  id: string;
  name: string;
  status: string;
  primaryMetric: string;
  trafficSplitStrategy: string;
  startsAt: string;
  endsAt: string;
  variants: ExperimentVariantRow[];
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
        <s-banner tone="info" heading="Experiments updated">
          <s-paragraph>{notice}</s-paragraph>
        </s-banner>
      )}

      {errors?.form && (
        <s-banner tone="critical" heading="Experiments could not be updated">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      {!lockedReason && (
        <>
          <Form method="post" className="counterpulse-form">
            <input name="_action" type="hidden" value="createExperiment" />
            <div className="counterpulse-form-grid">
              <FormField label="Experiment name">
                <input name="name" defaultValue="Campaign A/B test" required />
              </FormField>
              <FormField label="Primary metric">
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
                  <FormField label="Primary metric">
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
                  Stop
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
          <FormField label={`Variant ${index + 1} weight`}>
            <input
              name="variantWeight"
              type="number"
              min="0"
              max="10000"
              step="1"
              defaultValue={variant.weight}
            />
          </FormField>
          <FormField label={`Variant ${index + 1} status`}>
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
          <FormField label={`Variant ${index + 1} text override JSON`}>
            <textarea
              name="textOverride"
              defaultValue={variant.textOverrideJson}
              rows={3}
            />
          </FormField>
          <FormField label={`Variant ${index + 1} design override JSON`}>
            <textarea
              name="designOverride"
              defaultValue={variant.designOverrideJson}
              rows={3}
            />
          </FormField>
          <FormField label={`Variant ${index + 1} discount override JSON`}>
            <textarea
              name="discountOverride"
              defaultValue={variant.discountOverrideJson}
              rows={3}
            />
          </FormField>
          <FormField label={`Variant ${index + 1} placement override JSON`}>
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

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="counterpulse-form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function formatMetric(value: string) {
  return value === "CLICK_RATE" ? "CTR" : value;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
