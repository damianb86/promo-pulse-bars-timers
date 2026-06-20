import type { ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  badgePositionOptions,
  badgeShapeOptions,
  badgeTextPresets,
  type BadgeSettingsErrors,
  type BadgeSettingsValues,
} from "../types/badge";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

type BadgeSettingsEditorProps = {
  enabled: boolean;
  errors?: BadgeSettingsErrors;
  lockedReason?: string;
  values: BadgeSettingsValues;
};

export function BadgeSettingsEditor({
  enabled,
  errors,
  lockedReason,
  values,
}: BadgeSettingsEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save badge settings",
    title: "Save product badge settings?",
    children: (
      <p>
        This updates the simple product badge shown by this campaign for
        matching placements.
      </p>
    ),
  });

  if (!enabled) return null;

  return (
    <s-section heading="Product Badge">
      <p className="counterpulse-section-description">
        Configure the default badge text, shape, and position for product or
        collection placements.
      </p>

      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Product badges are locked"
        />
      )}

      {errors?.form && (
        <AppAlert tone="critical" title="Badge settings could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <Form
          method="post"
          className="counterpulse-form"
          onSubmit={confirmSubmit.onSubmit}
        >
          <input name="_action" type="hidden" value="saveBadgeSettings" />

          <div className="counterpulse-form-grid">
            <FormField
              label="Badge text"
              error={errors?.badgeText}
              info={
                <FieldInfoButton label="Badge text" title="Product badge text">
                  <BadgeInfoContent
                    intro="Badge text is the short label shown on product or collection placements."
                    items={[
                      [
                        "Keep it short",
                        "Use concise, factual text such as New, Sale, Limited offer, or Pre-order.",
                      ],
                      [
                        "No fake scarcity",
                        "Only use urgency or stock language when it matches real data.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <input
                name="badgeText"
                defaultValue={values.badgeText}
                list="counterpulse-badge-presets"
                maxLength={48}
              />
              <datalist id="counterpulse-badge-presets">
                {badgeTextPresets.map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
            </FormField>

            <FormField
              label="Badge shape"
              error={errors?.badgeShape}
              info={
                <FieldInfoButton label="Badge shape" title="Badge shape">
                  <BadgeInfoContent
                    intro="Shape changes how the badge appears over product imagery or product-card content."
                    items={[
                      [
                        "Pill",
                        "Soft, compact label for most merchandising badges.",
                      ],
                      ["Square", "Sharper label for sale or editorial styles."],
                      [
                        "Ribbon",
                        "More prominent treatment; test on the real theme to avoid overlap.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <select name="badgeShape" defaultValue={values.badgeShape}>
                {badgeShapeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Badge position"
              error={errors?.badgePosition}
              info={
                <FieldInfoButton label="Badge position" title="Badge position">
                  <BadgeInfoContent
                    intro="Position controls where the badge is anchored inside supported product placements."
                    items={[
                      [
                        "Theme-dependent",
                        "Some themes crop product cards differently, so verify the selected corner on collection and product pages.",
                      ],
                      [
                        "Avoid overlap",
                        "Choose a position that does not cover price, sale labels, or product actions.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <select name="badgePosition" defaultValue={values.badgePosition}>
                {badgePositionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save badge settings"}
            </button>
          </div>
        </Form>
      )}
      {confirmSubmit.modal}
    </s-section>
  );
}

function BadgeInfoContent({
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
  error,
  children,
  info,
}: {
  label: string;
  error?: string;
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
      {error && <span className="counterpulse-form-error">{error}</span>}
    </div>
  );
}
