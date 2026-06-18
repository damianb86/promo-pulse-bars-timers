import { useState, type ReactNode } from "react";
import { Form, useNavigation } from "react-router";

import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

export type EmailTimerRow = {
  id: string;
  imageUrl: string;
  snippet: string;
  width: number;
  height: number;
  mode: string;
  expiredBehavior: string;
  endsAt: string;
  createdAt: string;
};

export type EmailTimerErrors = {
  form?: string;
  width?: string;
  height?: string;
};

type EmailTimerEditorProps = {
  errors?: EmailTimerErrors;
  lockedReason?: string;
  timers: EmailTimerRow[];
};

const expiredBehaviorOptions = [
  { label: "Show expired image", value: "SHOW_EXPIRED" },
  { label: "Show zero timer", value: "SHOW_ZERO" },
  { label: "Transparent pixel", value: "HIDE" },
];

export function EmailTimerEditor({
  errors,
  lockedReason,
  timers,
}: EmailTimerEditorProps) {
  const navigation = useNavigation();
  const [copiedValue, setCopiedValue] = useState("");
  const isSubmitting = navigation.state === "submitting";

  const copyText = async (value: string, key: string) => {
    if (!navigator.clipboard) return;

    await navigator.clipboard.writeText(value);
    setCopiedValue(key);
  };

  return (
    <s-section heading="Email Timer">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Email timers are locked"
        />
      )}

      {errors?.form && (
        <s-banner tone="critical" heading="Email timer could not be created">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      {!lockedReason && (
        <Form method="post" className="counterpulse-form">
          <input name="_action" type="hidden" value="createEmailTimer" />

          <div className="counterpulse-form-grid">
            <FormField label="Width" error={errors?.width}>
              <input
                name="emailTimerWidth"
                type="number"
                min="240"
                max="1200"
                step="1"
                defaultValue="600"
              />
            </FormField>

            <FormField label="Height" error={errors?.height}>
              <input
                name="emailTimerHeight"
                type="number"
                min="80"
                max="400"
                step="1"
                defaultValue="180"
              />
            </FormField>

            <FormField label="Expired behavior">
              <select name="emailTimerExpiredBehavior" defaultValue="SHOW_EXPIRED">
                {expiredBehaviorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Creating..." : "Create email timer"}
            </button>
          </div>
        </Form>
      )}

      <s-box paddingBlockStart="base">
        {timers.length > 0 ? (
          <div className="counterpulse-stack">
            {timers.map((timer) => (
              <div className="counterpulse-card" key={timer.id}>
                <div className="counterpulse-form-grid">
                  <div>
                    <img
                      alt="Email countdown preview"
                      src={timer.imageUrl}
                      width={Math.min(timer.width, 360)}
                    />
                  </div>
                  <div className="counterpulse-stack">
                    <FormField label="Email timer URL">
                      <input readOnly value={timer.imageUrl} />
                    </FormField>
                    <div className="counterpulse-actions">
                      <button
                        className="counterpulse-button"
                        type="button"
                        onClick={() =>
                          void copyText(timer.imageUrl, `${timer.id}:url`)
                        }
                      >
                        {copiedValue === `${timer.id}:url`
                          ? "Copied URL"
                          : "Copy URL"}
                      </button>
                    </div>
                  </div>
                </div>

                <s-box paddingBlockStart="base">
                  <FormField label="Email snippet">
                    <textarea readOnly rows={3} value={timer.snippet} />
                  </FormField>
                  <div className="counterpulse-actions">
                    <button
                      className="counterpulse-button"
                      type="button"
                      onClick={() =>
                        void copyText(timer.snippet, `${timer.id}:snippet`)
                      }
                    >
                      {copiedValue === `${timer.id}:snippet`
                        ? "Copied snippet"
                        : "Copy snippet"}
                    </button>
                  </div>
                </s-box>

                <s-box paddingBlockStart="base">
                  <table className="counterpulse-table">
                    <thead>
                      <tr>
                        <th>Size</th>
                        <th>Mode</th>
                        <th>Expires</th>
                        <th>Expired behavior</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          {timer.width} x {timer.height}
                        </td>
                        <td>{timer.mode}</td>
                        <td>{timer.endsAt || "Never"}</td>
                        <td>{timer.expiredBehavior}</td>
                      </tr>
                    </tbody>
                  </table>
                </s-box>
              </div>
            ))}
          </div>
        ) : (
          <s-paragraph>No email timers created yet.</s-paragraph>
        )}
      </s-box>
    </s-section>
  );
}

function FormField({
  children,
  error,
  label,
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="counterpulse-field">
      <span>{label}</span>
      {children}
      {error && <small className="counterpulse-field-error">{error}</small>}
    </label>
  );
}
