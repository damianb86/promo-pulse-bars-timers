import type { ReactNode } from "react";
import { AppAlert } from "./Notifications";
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

  if (!enabled) return null;

  return (
    <s-section heading="Product Badge">
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
        <Form method="post" className="counterpulse-form">
          <input name="_action" type="hidden" value="saveBadgeSettings" />

          <div className="counterpulse-form-grid">
            <FormField label="Badge text" error={errors?.badgeText}>
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

            <FormField label="Badge shape" error={errors?.badgeShape}>
              <select name="badgeShape" defaultValue={values.badgeShape}>
                {badgeShapeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Badge position" error={errors?.badgePosition}>
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
    </s-section>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="counterpulse-form-field">
      <span>{label}</span>
      {children}
      {error && <span className="counterpulse-form-error">{error}</span>}
    </label>
  );
}
