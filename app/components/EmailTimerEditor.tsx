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
  borderColor?: string;
  borderWidth?: string;
  paddingX?: string;
  paddingY?: string;
  cornerRadius?: string;
  headingText?: string;
  daysLabel?: string;
  hoursLabel?: string;
  minutesLabel?: string;
  secondsLabel?: string;
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
  borderColor: string;
  fontFamily: string;
  cornerRadius: number;
  borderWidth: number;
  paddingX: number;
  paddingY: number;
  showHeading: boolean;
  headingText: string;
  showLabels: boolean;
  showDays: boolean;
  showHours: boolean;
  showMinutes: boolean;
  showSeconds: boolean;
  daysLabel: string;
  hoursLabel: string;
  minutesLabel: string;
  secondsLabel: string;
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
    borderColor: "#111827",
    fontFamily: "BLOCK",
    cornerRadius: 0,
    borderWidth: 0,
    paddingX: 34,
    paddingY: 24,
    showHeading: true,
    headingText: "ENDS IN",
    showLabels: true,
    showDays: true,
    showHours: true,
    showMinutes: true,
    showSeconds: true,
    daysLabel: "Days",
    hoursLabel: "Hrs",
    minutesLabel: "Mins",
    secondsLabel: "Secs",
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
    borderColor: "#CBD5E1",
    fontFamily: "COMPACT",
    cornerRadius: 12,
    borderWidth: 2,
    paddingX: 40,
    paddingY: 28,
    showHeading: true,
    headingText: "SALE ENDS IN",
    showLabels: true,
    showDays: true,
    showHours: true,
    showMinutes: true,
    showSeconds: false,
    daysLabel: "Days",
    hoursLabel: "Hours",
    minutesLabel: "Minutes",
    secondsLabel: "Seconds",
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
    borderColor: "#EC4899",
    fontFamily: "DIGITAL",
    cornerRadius: 18,
    borderWidth: 3,
    paddingX: 46,
    paddingY: 30,
    showHeading: true,
    headingText: "FLASH SALE",
    showLabels: true,
    showDays: false,
    showHours: true,
    showMinutes: true,
    showSeconds: true,
    daysLabel: "Days",
    hoursLabel: "Hrs",
    minutesLabel: "Mins",
    secondsLabel: "Secs",
  },
  {
    presetKey: "soft-countdown",
    label: "Soft countdown",
    description: "Compact lifecycle reminder without a headline.",
    width: 480,
    height: 140,
    backgroundColor: "#ECFDF5",
    textColor: "#064E3B",
    accentColor: "#10B981",
    labelColor: "#047857",
    borderColor: "#A7F3D0",
    fontFamily: "WIDE",
    cornerRadius: 22,
    borderWidth: 1,
    paddingX: 28,
    paddingY: 20,
    showHeading: false,
    headingText: "ENDS IN",
    showLabels: true,
    showDays: true,
    showHours: true,
    showMinutes: true,
    showSeconds: false,
    daysLabel: "Days",
    hoursLabel: "Hrs",
    minutesLabel: "Min",
    secondsLabel: "Sec",
  },
  {
    presetKey: "luxury-gold",
    label: "Luxury gold",
    description: "Premium dark block with restrained gold type.",
    width: 640,
    height: 190,
    backgroundColor: "#1F1A14",
    textColor: "#FDE68A",
    accentColor: "#B45309",
    labelColor: "#FBBF24",
    borderColor: "#92400E",
    fontFamily: "WIDE",
    cornerRadius: 6,
    borderWidth: 2,
    paddingX: 44,
    paddingY: 26,
    showHeading: true,
    headingText: "PRIVATE OFFER",
    showLabels: true,
    showDays: true,
    showHours: true,
    showMinutes: true,
    showSeconds: true,
    daysLabel: "Days",
    hoursLabel: "Hours",
    minutesLabel: "Min",
    secondsLabel: "Sec",
  },
  {
    presetKey: "coupon-punch",
    label: "Coupon punch",
    description: "High-contrast coupon style for bold promos.",
    width: 720,
    height: 160,
    backgroundColor: "#FFF7ED",
    textColor: "#7C2D12",
    accentColor: "#EA580C",
    labelColor: "#9A3412",
    borderColor: "#FB923C",
    fontFamily: "BLOCK",
    cornerRadius: 28,
    borderWidth: 4,
    paddingX: 36,
    paddingY: 22,
    showHeading: true,
    headingText: "COUPON EXPIRES",
    showLabels: false,
    showDays: false,
    showHours: true,
    showMinutes: true,
    showSeconds: true,
    daysLabel: "Days",
    hoursLabel: "Hrs",
    minutesLabel: "Mins",
    secondsLabel: "Secs",
  },
];

const defaultEmailTimerConfig = emailTimerStylePresets[0];

const emailTimerUnitControls = [
  {
    key: "days",
    label: "Days",
    showField: "showDays",
    labelField: "daysLabel",
    name: "emailTimerShowDays",
    inputName: "emailTimerDaysLabel",
  },
  {
    key: "hours",
    label: "Hours",
    showField: "showHours",
    labelField: "hoursLabel",
    name: "emailTimerShowHours",
    inputName: "emailTimerHoursLabel",
  },
  {
    key: "minutes",
    label: "Minutes",
    showField: "showMinutes",
    labelField: "minutesLabel",
    name: "emailTimerShowMinutes",
    inputName: "emailTimerMinutesLabel",
  },
  {
    key: "seconds",
    label: "Seconds",
    showField: "showSeconds",
    labelField: "secondsLabel",
    name: "emailTimerShowSeconds",
    inputName: "emailTimerSecondsLabel",
  },
] satisfies Array<{
  key: string;
  label: string;
  showField: keyof Pick<
    EmailTimerConfig,
    "showDays" | "showHours" | "showMinutes" | "showSeconds"
  >;
  labelField: keyof Pick<
    EmailTimerConfig,
    "daysLabel" | "hoursLabel" | "minutesLabel" | "secondsLabel"
  >;
  name: string;
  inputName: string;
}>;

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
                        borderColor: preset.borderColor,
                        borderRadius: `${Math.min(preset.cornerRadius, 18)}px`,
                        borderWidth: `${Math.max(1, preset.borderWidth)}px`,
                        color: preset.textColor,
                      }}
                    >
                      <span style={{ background: preset.accentColor }} />
                      <strong
                        className={`counterpulse-email-timer-live-preview__time--${preset.fontFamily.toLowerCase()}`}
                      >
                        {formatPreviewTimeText(preset)}
                      </strong>
                      {preset.showLabels && (
                        <em style={{ color: preset.labelColor }}>
                          {formatPreviewLabelText(preset)}
                        </em>
                      )}
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
                <FormField label="Horizontal padding" error={errors?.paddingX}>
                  <input
                    name="emailTimerPaddingX"
                    type="number"
                    min="0"
                    max="160"
                    step="1"
                    value={timerConfig.paddingX}
                    onChange={(event) =>
                      updateTimerConfig({
                        paddingX: Number(event.currentTarget.value),
                      })
                    }
                  />
                </FormField>
                <FormField label="Vertical padding" error={errors?.paddingY}>
                  <input
                    name="emailTimerPaddingY"
                    type="number"
                    min="0"
                    max="120"
                    step="1"
                    value={timerConfig.paddingY}
                    onChange={(event) =>
                      updateTimerConfig({
                        paddingY: Number(event.currentTarget.value),
                      })
                    }
                  />
                </FormField>
                <FormField label="Border width" error={errors?.borderWidth}>
                  <input
                    name="emailTimerBorderWidth"
                    type="number"
                    min="0"
                    max="16"
                    step="1"
                    value={timerConfig.borderWidth}
                    onChange={(event) =>
                      updateTimerConfig({
                        borderWidth: Number(event.currentTarget.value),
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
                <EmailTimerColorField
                  error={errors?.borderColor}
                  label="Border"
                  name="emailTimerBorderColor"
                  value={timerConfig.borderColor}
                  onChange={(value) =>
                    updateTimerConfig({ borderColor: value })
                  }
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

            <div className="counterpulse-config-card counterpulse-config-card--units">
              <PanelHeader
                eyebrow="Timer"
                title="Units and labels"
                description="Choose which time units appear in the email image and edit the label text shown under each unit."
              />
              <div className="counterpulse-email-unit-grid">
                {emailTimerUnitControls.map((unit) => {
                  const checked = Boolean(timerConfig[unit.showField]);
                  const labelValue = String(timerConfig[unit.labelField]);
                  const error =
                    unit.key === "days"
                      ? errors?.daysLabel
                      : unit.key === "hours"
                        ? errors?.hoursLabel
                        : unit.key === "minutes"
                          ? errors?.minutesLabel
                          : errors?.secondsLabel;

                  return (
                    <div
                      className="counterpulse-email-unit-card"
                      key={unit.key}
                    >
                      <label className="counterpulse-toggle-label">
                        <input name={unit.name} type="hidden" value="false" />
                        <input
                          checked={checked}
                          name={unit.name}
                          type="checkbox"
                          value="true"
                          onChange={(event) =>
                            updateTimerConfig({
                              [unit.showField]: event.currentTarget.checked,
                            })
                          }
                        />
                        <span>{unit.label}</span>
                      </label>
                      <FormField label={`${unit.label} label`} error={error}>
                        <input
                          disabled={!checked}
                          maxLength={10}
                          name={unit.inputName}
                          value={labelValue}
                          onChange={(event) =>
                            updateTimerConfig({
                              [unit.labelField]: event.currentTarget.value,
                            })
                          }
                        />
                      </FormField>
                    </div>
                  );
                })}
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
              <EmailTimerFallbackPreview
                config={timerConfig}
                expiredBehavior={expiredBehavior}
              />
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

function EmailTimerLivePreview({
  config,
  previewMode = "active",
}: {
  config: EmailTimerConfig;
  previewMode?: "active" | "expired" | "zero";
}) {
  const fontClass = `counterpulse-email-timer-live-preview__time--${config.fontFamily.toLowerCase()}`;
  const previewUnits = getEmailTimerPreviewUnits(config, previewMode);

  return (
    <div className="counterpulse-email-timer-live-preview">
      <div
        className="counterpulse-email-timer-live-preview__bar"
        style={{
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          borderRadius: `${Math.min(config.cornerRadius, 24)}px`,
          borderWidth: `${config.borderWidth}px`,
          color: config.textColor,
          padding: `${Math.min(config.paddingY, 32)}px ${Math.min(
            config.paddingX,
            52,
          )}px`,
        }}
      >
        <span
          className="counterpulse-email-timer-live-preview__accent"
          style={{ backgroundColor: config.accentColor }}
        />
        {config.showHeading && (
          <span
            className="counterpulse-email-timer-live-preview__heading"
            style={{ color: config.textColor }}
          >
            {config.headingText || "ENDS IN"}
          </span>
        )}
        {previewMode === "expired" ? (
          <strong
            className={`counterpulse-email-timer-live-preview__time ${fontClass}`}
          >
            EXPIRED
          </strong>
        ) : (
          <span className="counterpulse-email-timer-live-preview__units">
            {previewUnits.map((unit) => (
              <span
                className="counterpulse-email-timer-live-preview__unit"
                key={unit.key}
              >
                <strong
                  className={`counterpulse-email-timer-live-preview__time ${fontClass}`}
                >
                  {unit.value}
                </strong>
                {config.showLabels && (
                  <span
                    className="counterpulse-email-timer-live-preview__labels"
                    style={{ color: config.labelColor }}
                  >
                    {unit.label}
                  </span>
                )}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function EmailTimerFallbackPreview({
  config,
  expiredBehavior,
}: {
  config: EmailTimerConfig;
  expiredBehavior: string;
}) {
  if (expiredBehavior === "HIDE") {
    return (
      <div className="counterpulse-email-fallback-preview">
        <span className="counterpulse-email-fallback-preview__pixel" />
        <div>
          <strong>Transparent pixel</strong>
          <small>
            The expired email image collapses to a 1px transparent PNG.
          </small>
        </div>
      </div>
    );
  }

  const previewMode = expiredBehavior === "SHOW_ZERO" ? "zero" : "expired";
  const expiredConfig =
    expiredBehavior === "SHOW_ZERO"
      ? config
      : { ...config, showHeading: true, headingText: "OFFER ENDED" };

  return (
    <div className="counterpulse-email-fallback-preview">
      <div>
        <strong>Fallback preview</strong>
        <small>
          {expiredBehavior === "SHOW_ZERO"
            ? "Subscribers see the same timer frame at zero."
            : "Subscribers see a branded expired-state image."}
        </small>
      </div>
      <EmailTimerLivePreview config={expiredConfig} previewMode={previewMode} />
    </div>
  );
}

function getEmailTimerPreviewUnits(
  config: EmailTimerConfig,
  previewMode: "active" | "expired" | "zero" = "active",
) {
  const activeValues = previewMode === "zero" ? ["00", "00", "00", "00"] : null;
  const units = [
    {
      key: "days",
      value: activeValues?.[0] ?? "06",
      label: config.daysLabel || "Days",
      visible: config.showDays,
    },
    {
      key: "hours",
      value: activeValues?.[1] ?? "01",
      label: config.hoursLabel || "Hrs",
      visible: config.showHours,
    },
    {
      key: "minutes",
      value: activeValues?.[2] ?? "59",
      label: config.minutesLabel || "Mins",
      visible: config.showMinutes,
    },
    {
      key: "seconds",
      value: activeValues?.[3] ?? "24",
      label: config.secondsLabel || "Secs",
      visible: config.showSeconds,
    },
  ].filter((unit) => unit.visible);

  return units.length > 0
    ? units
    : [{ key: "seconds", value: "24", label: "Secs", visible: true }];
}

function formatPreviewTimeText(config: EmailTimerConfig) {
  return getEmailTimerPreviewUnits(config)
    .map((unit) => unit.value)
    .join(":");
}

function formatPreviewLabelText(config: EmailTimerConfig) {
  return getEmailTimerPreviewUnits(config)
    .map((unit) => unit.label)
    .join(" ");
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
