import { useState, type ReactNode } from "react";
import { AppAlert } from "./Notifications";
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
  {
    description: "Keep a branded fallback visible after the offer ends.",
    label: "Show expired image",
    value: "SHOW_EXPIRED",
  },
  {
    description: "Render 00:00:00 while preserving the timer size.",
    label: "Show zero timer",
    value: "SHOW_ZERO",
  },
  {
    description: "Return a 1px transparent image for expired emails.",
    label: "Transparent pixel",
    value: "HIDE",
  },
];

const sizePresets = [
  { height: 140, label: "Compact", width: 480 },
  { height: 180, label: "Standard", width: 600 },
  { height: 220, label: "Hero", width: 760 },
];

export function EmailTimerEditor({
  errors,
  lockedReason,
  timers,
}: EmailTimerEditorProps) {
  const navigation = useNavigation();
  const [copiedValue, setCopiedValue] = useState("");
  const [size, setSize] = useState({ height: 180, width: 600 });
  const [expiredBehavior, setExpiredBehavior] = useState("SHOW_EXPIRED");
  const isSubmitting = navigation.state === "submitting";

  const copyText = async (value: string, key: string) => {
    if (!navigator.clipboard) return;

    await navigator.clipboard.writeText(value);
    setCopiedValue(key);
  };
  const updateSize = (field: "height" | "width", value: string) => {
    setSize((current) => ({
      ...current,
      [field]: Number(value),
    }));
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
        <AppAlert tone="critical" title="Email timer could not be created">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <Form method="post" className="counterpulse-form">
          <input name="_action" type="hidden" value="createEmailTimer" />

          <div className="counterpulse-panel-grid">
            <div className="counterpulse-config-card">
              <PanelHeader
                eyebrow="Image"
                title="Email-safe canvas"
                description="The timer is a static PNG URL, so it works in Klaviyo, Omnisend, Mailchimp, and plain email HTML."
              />
              <div className="counterpulse-preset-row">
                {sizePresets.map((preset) => (
                  <button
                    aria-pressed={
                      size.width === preset.width &&
                      size.height === preset.height
                    }
                    className="counterpulse-preset-button"
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setSize({ height: preset.height, width: preset.width })
                    }
                  >
                    <strong>{preset.label}</strong>
                    <span>
                      {preset.width} x {preset.height}
                    </span>
                  </button>
                ))}
              </div>
              <div className="counterpulse-form-grid">
                <FormField label="Width" error={errors?.width}>
                  <input
                    name="emailTimerWidth"
                    type="number"
                    min="240"
                    max="1200"
                    step="1"
                    value={size.width}
                    onChange={(event) =>
                      updateSize("width", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Height" error={errors?.height}>
                  <input
                    name="emailTimerHeight"
                    type="number"
                    min="80"
                    max="400"
                    step="1"
                    value={size.height}
                    onChange={(event) =>
                      updateSize("height", event.currentTarget.value)
                    }
                  />
                </FormField>
              </div>
            </div>

            <div className="counterpulse-config-card">
              <PanelHeader
                eyebrow="Fallback"
                title="After expiration"
                description="Email clients cannot run JavaScript, so the image URL decides what expired subscribers see."
              />
              <div className="counterpulse-choice-list">
                {expiredBehaviorOptions.map((option) => {
                  const inputId = `email-timer-expired-${option.value}`;

                  return (
                    <div
                      className="counterpulse-choice-card"
                      key={option.value}
                    >
                      <input
                        checked={expiredBehavior === option.value}
                        id={inputId}
                        name="emailTimerExpiredBehavior"
                        type="radio"
                        value={option.value}
                        onChange={() => setExpiredBehavior(option.value)}
                      />
                      <label htmlFor={inputId}>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
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
              <div className="counterpulse-config-card" key={timer.id}>
                <div className="counterpulse-email-timer-card">
                  <div className="counterpulse-email-timer-card__preview">
                    <img
                      alt="Email countdown preview"
                      src={timer.imageUrl}
                      width={Math.min(timer.width, 360)}
                    />
                    <div className="counterpulse-detail-list">
                      <span>
                        {timer.width} x {timer.height}
                      </span>
                      <span>{formatEnum(timer.expiredBehavior)}</span>
                      <span>{timer.endsAt || "No fixed end"}</span>
                    </div>
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

function PanelHeader({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="counterpulse-panel-heading counterpulse-panel-heading--compact">
      <div>
        <p className="counterpulse-kicker">{eyebrow}</p>
        <h3>{title}</h3>
        <p className="counterpulse-panel-description">{description}</p>
      </div>
    </div>
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

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
