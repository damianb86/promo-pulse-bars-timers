import { useState, type ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

export type EmailTimerRow = {
  id: string;
  imageUrl: string;
  snippet: string;
  width: number;
  height: number;
  preset: string;
  fontFamily: string;
  mode: string;
  expiredBehavior: string;
  endsAt: string;
  createdAt: string;
};

export type EmailTimerErrors = {
  form?: string;
  width?: string;
  height?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  labelColor?: string;
  cornerRadius?: string;
  headingText?: string;
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

type EmailTimerConfig = {
  presetKey: string;
  width: number;
  height: number;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  labelColor: string;
  fontFamily: string;
  cornerRadius: number;
  showHeading: boolean;
  headingText: string;
  showLabels: boolean;
};

const emailTimerFontOptions = [
  { value: "BLOCK", label: "Block mono" },
  { value: "DIGITAL", label: "Digital segments" },
  { value: "WIDE", label: "Wide block" },
  { value: "COMPACT", label: "Compact mono" },
];

const emailTimerStylePresets: Array<
  EmailTimerConfig & { label: string; description: string }
> = [
  {
    presetKey: "midnight",
    label: "Midnight",
    description: "Dark urgency with orange accents.",
    width: 600,
    height: 180,
    backgroundColor: "#111827",
    textColor: "#FFFFFF",
    accentColor: "#F97316",
    labelColor: "#FDBA74",
    fontFamily: "BLOCK",
    cornerRadius: 0,
    showHeading: true,
    headingText: "ENDS IN",
    showLabels: true,
  },
  {
    presetKey: "clean-light",
    label: "Clean light",
    description: "White campaign block for editorial emails.",
    width: 600,
    height: 180,
    backgroundColor: "#FFFFFF",
    textColor: "#111827",
    accentColor: "#2563EB",
    labelColor: "#4B5563",
    fontFamily: "COMPACT",
    cornerRadius: 12,
    showHeading: true,
    headingText: "SALE ENDS IN",
    showLabels: true,
  },
  {
    presetKey: "neon-sale",
    label: "Neon sale",
    description: "Bright digital timer for flash emails.",
    width: 760,
    height: 220,
    backgroundColor: "#0F172A",
    textColor: "#67E8F9",
    accentColor: "#EC4899",
    labelColor: "#BAE6FD",
    fontFamily: "DIGITAL",
    cornerRadius: 18,
    showHeading: true,
    headingText: "FLASH SALE",
    showLabels: true,
  },
  {
    presetKey: "soft-countdown",
    label: "Soft countdown",
    description: "Low contrast blue for lifecycle emails.",
    width: 480,
    height: 140,
    backgroundColor: "#EEF6FF",
    textColor: "#1E3A8A",
    accentColor: "#0EA5E9",
    labelColor: "#2563EB",
    fontFamily: "WIDE",
    cornerRadius: 16,
    showHeading: false,
    headingText: "ENDS IN",
    showLabels: true,
  },
];

const defaultEmailTimerConfig = emailTimerStylePresets[0];

export function EmailTimerEditor({
  errors,
  lockedReason,
  timers,
}: EmailTimerEditorProps) {
  const navigation = useNavigation();
  const [copiedValue, setCopiedValue] = useState("");
  const [timerConfig, setTimerConfig] = useState<EmailTimerConfig>(
    defaultEmailTimerConfig,
  );
  const [expiredBehavior, setExpiredBehavior] = useState("SHOW_EXPIRED");
  const isSubmitting = navigation.state === "submitting";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Create email timer",
    title: "Create email countdown timer?",
    children: (
      <p>
        This creates a public image URL that can be inserted into email tools.
        The URL does not expose shop secrets, but recipients may load it.
      </p>
    ),
  });

  const copyText = async (value: string, key: string) => {
    if (!navigator.clipboard) return;

    await navigator.clipboard.writeText(value);
    setCopiedValue(key);
  };
  const updateSize = (field: "height" | "width", value: string) => {
    updateTimerConfig({
      [field]: Number(value),
    });
  };
  const updateTimerConfig = (updates: Partial<EmailTimerConfig>) => {
    setTimerConfig((current) => ({
      ...current,
      ...updates,
      presetKey: "custom",
    }));
  };

  return (
    <s-section heading="Email Timer">
      <p className="counterpulse-section-description">
        Create no-JavaScript countdown images for email platforms and choose
        what recipients see after the campaign expires.
      </p>

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
        <Form
          method="post"
          className="counterpulse-form"
          onSubmit={confirmSubmit.onSubmit}
        >
          <input name="_action" type="hidden" value="createEmailTimer" />
          <input
            name="emailTimerPresetKey"
            type="hidden"
            value={timerConfig.presetKey}
          />

          <div className="counterpulse-panel-grid">
            <div className="counterpulse-config-card counterpulse-config-card--wide">
              <PanelHeader
                eyebrow="Preset"
                title="Visual starting point"
                description="Apply a complete visual preset, then edit size, font, colors, labels, and expiration behavior manually."
              />
              <div className="counterpulse-email-style-presets">
                {emailTimerStylePresets.map((preset) => (
                  <button
                    aria-pressed={timerConfig.presetKey === preset.presetKey}
                    className="counterpulse-email-style-preset"
                    key={preset.presetKey}
                    type="button"
                    onClick={() => setTimerConfig(preset)}
                  >
                    <span
                      className="counterpulse-email-style-preset__swatch"
                      style={{
                        background: preset.backgroundColor,
                        borderColor: preset.accentColor,
                        color: preset.textColor,
                      }}
                    >
                      <span style={{ background: preset.accentColor }} />
                      <strong>01:59:24</strong>
                    </span>
                    <span>
                      <strong>{preset.label}</strong>
                      <small>{preset.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

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
                      timerConfig.width === preset.width &&
                      timerConfig.height === preset.height
                    }
                    className="counterpulse-preset-button"
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      updateTimerConfig({
                        height: preset.height,
                        width: preset.width,
                      })
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
                <FormField
                  label="Width"
                  error={errors?.width}
                  info={
                    <FieldInfoButton
                      label="Email timer width"
                      title="Email timer image size"
                    >
                      <EmailTimerInfoContent
                        intro="Email timers are rendered as PNG images, so width and height define the actual image subscribers load."
                        items={[
                          [
                            "Compatibility",
                            "Use standard sizes for Klaviyo, Omnisend, Mailchimp, and responsive email templates.",
                          ],
                          [
                            "Retina and scaling",
                            "Larger images can look sharper but increase email image weight.",
                          ],
                          [
                            "No JavaScript",
                            "The countdown updates because the email client reloads the image URL, not because code runs in the email.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
                  <input
                    name="emailTimerWidth"
                    type="number"
                    min="240"
                    max="1200"
                    step="1"
                    value={timerConfig.width}
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
                    value={timerConfig.height}
                    onChange={(event) =>
                      updateSize("height", event.currentTarget.value)
                    }
                  />
                </FormField>
                <FormField label="Corner radius" error={errors?.cornerRadius}>
                  <input
                    name="emailTimerCornerRadius"
                    type="number"
                    min="0"
                    max="40"
                    step="1"
                    value={timerConfig.cornerRadius}
                    onChange={(event) =>
                      updateTimerConfig({
                        cornerRadius: Number(event.currentTarget.value),
                      })
                    }
                  />
                </FormField>
              </div>
            </div>

            <div className="counterpulse-config-card">
              <PanelHeader
                eyebrow="Style"
                title="Fonts and colors"
                description="These values are stored with the timer and used by the generated PNG image."
              />
              <EmailTimerLivePreview config={timerConfig} />
              <div className="counterpulse-form-grid">
                <FormField label="Timer font">
                  <select
                    name="emailTimerFontFamily"
                    value={timerConfig.fontFamily}
                    onChange={(event) =>
                      updateTimerConfig({
                        fontFamily: event.currentTarget.value,
                      })
                    }
                  >
                    {emailTimerFontOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Heading text" error={errors?.headingText}>
                  <input
                    name="emailTimerHeadingText"
                    maxLength={24}
                    value={timerConfig.headingText}
                    onChange={(event) =>
                      updateTimerConfig({
                        headingText: event.currentTarget.value,
                      })
                    }
                  />
                </FormField>
                <EmailTimerColorField
                  error={errors?.backgroundColor}
                  label="Background"
                  name="emailTimerBackgroundColor"
                  value={timerConfig.backgroundColor}
                  onChange={(value) =>
                    updateTimerConfig({ backgroundColor: value })
                  }
                />
                <EmailTimerColorField
                  error={errors?.textColor}
                  label="Timer text"
                  name="emailTimerTextColor"
                  value={timerConfig.textColor}
                  onChange={(value) => updateTimerConfig({ textColor: value })}
                />
                <EmailTimerColorField
                  error={errors?.accentColor}
                  label="Accent"
                  name="emailTimerAccentColor"
                  value={timerConfig.accentColor}
                  onChange={(value) =>
                    updateTimerConfig({ accentColor: value })
                  }
                />
                <EmailTimerColorField
                  error={errors?.labelColor}
                  label="Labels"
                  name="emailTimerLabelColor"
                  value={timerConfig.labelColor}
                  onChange={(value) => updateTimerConfig({ labelColor: value })}
                />
              </div>
              <div className="counterpulse-toggle-grid">
                <div className="counterpulse-toggle">
                  <label className="counterpulse-toggle-label">
                    <input
                      name="emailTimerShowHeading"
                      type="hidden"
                      value="false"
                    />
                    <input
                      checked={timerConfig.showHeading}
                      name="emailTimerShowHeading"
                      type="checkbox"
                      value="true"
                      onChange={(event) =>
                        updateTimerConfig({
                          showHeading: event.currentTarget.checked,
                        })
                      }
                    />
                    <span>Show heading</span>
                  </label>
                </div>
                <div className="counterpulse-toggle">
                  <label className="counterpulse-toggle-label">
                    <input
                      name="emailTimerShowLabels"
                      type="hidden"
                      value="false"
                    />
                    <input
                      checked={timerConfig.showLabels}
                      name="emailTimerShowLabels"
                      type="checkbox"
                      value="true"
                      onChange={(event) =>
                        updateTimerConfig({
                          showLabels: event.currentTarget.checked,
                        })
                      }
                    />
                    <span>Show time labels</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="counterpulse-config-card">
              <PanelHeader
                eyebrow="Fallback"
                title="After expiration"
                description="Email clients cannot run JavaScript, so the image URL decides what expired subscribers see."
                action={
                  <FieldInfoButton
                    label="Email timer expired behavior"
                    title="Expired email timer behavior"
                  >
                    <EmailTimerInfoContent
                      intro="Expired behavior decides what the public image URL returns after the campaign deadline."
                      items={[
                        [
                          "Show expired image",
                          "Keeps a branded fallback visible and makes the expired state explicit.",
                        ],
                        [
                          "Show zero timer",
                          "Preserves the timer module while showing that the offer has ended.",
                        ],
                        [
                          "Transparent pixel",
                          "Minimizes the expired visual, but email clients cannot truly remove the original image block.",
                        ],
                      ]}
                    />
                  </FieldInfoButton>
                }
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
      {confirmSubmit.modal}

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
                      <span>{timer.preset}</span>
                      <span>{timer.fontFamily}</span>
                      <span>{formatEnum(timer.expiredBehavior)}</span>
                      <span>{timer.endsAt || "No fixed end"}</span>
                    </div>
                  </div>
                  <div className="counterpulse-stack">
                    <FormField
                      label="Email timer URL"
                      info={
                        <FieldInfoButton
                          label="Email timer URL"
                          title="Public timer URL"
                        >
                          <EmailTimerInfoContent
                            intro="This URL is safe to paste into email platforms, but it is intentionally public so recipients can load the image."
                            items={[
                              [
                                "Tokenized",
                                "The URL uses a non-guessable public token and does not expose shop secrets.",
                              ],
                              [
                                "Caching",
                                "Email clients may cache images, so the timer can update at the cadence allowed by the client.",
                              ],
                            ]}
                          />
                        </FieldInfoButton>
                      }
                    >
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
                  <FormField
                    label="Email snippet"
                    info={
                      <FieldInfoButton
                        label="Email snippet"
                        title="Email HTML snippet"
                      >
                        <EmailTimerInfoContent
                          intro="The snippet is generic HTML that can be inserted into most email builders."
                          items={[
                            [
                              "Editable",
                              "You can adjust surrounding email layout in the email platform after copying it.",
                            ],
                            [
                              "No script tags",
                              "The snippet uses only an image tag because most email clients block JavaScript.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
                  >
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
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
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
      {action}
    </div>
  );
}

function EmailTimerInfoContent({
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
  children,
  error,
  info,
  label,
}: {
  children: ReactNode;
  error?: string;
  info?: ReactNode;
  label: string;
}) {
  return (
    <div className="counterpulse-field">
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      <label className="counterpulse-field-control">
        <span className="counterpulse-sr-only">{label}</span>
        {children}
      </label>
      {error && <small className="counterpulse-field-error">{error}</small>}
    </div>
  );
}

function EmailTimerColorField({
  error,
  label,
  name,
  onChange,
  value,
}: {
  error?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <FormField label={label} error={error}>
      <span className="counterpulse-color-input">
        <input
          aria-label={`${label} swatch`}
          type="color"
          value={isHexColor(value) ? value : "#000000"}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <input
          name={name}
          pattern="^#[0-9A-Fa-f]{6}$"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </span>
    </FormField>
  );
}

function EmailTimerLivePreview({ config }: { config: EmailTimerConfig }) {
  const fontClass = `counterpulse-email-timer-live-preview__time--${config.fontFamily.toLowerCase()}`;

  return (
    <div className="counterpulse-email-timer-live-preview">
      <div
        className="counterpulse-email-timer-live-preview__bar"
        style={{
          backgroundColor: config.backgroundColor,
          borderRadius: `${Math.min(config.cornerRadius, 24)}px`,
          color: config.textColor,
        }}
      >
        <span
          className="counterpulse-email-timer-live-preview__accent"
          style={{ backgroundColor: config.accentColor }}
        />
        {config.showHeading && (
          <span
            className="counterpulse-email-timer-live-preview__heading"
            style={{ color: config.accentColor }}
          >
            {config.headingText || "ENDS IN"}
          </span>
        )}
        <strong
          className={`counterpulse-email-timer-live-preview__time ${fontClass}`}
        >
          01:59:24
        </strong>
        {config.showLabels && (
          <span
            className="counterpulse-email-timer-live-preview__labels"
            style={{ color: config.labelColor }}
          >
            Hrs&nbsp;&nbsp;&nbsp;Min&nbsp;&nbsp;&nbsp;Sec
          </span>
        )}
      </div>
    </div>
  );
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
