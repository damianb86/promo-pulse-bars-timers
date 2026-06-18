import type { ReactNode } from "react";
import { Form, useNavigation } from "react-router";

import {
  discountValueTypeOptions,
  type DiscountSettingsValues,
} from "../types/discount";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

export type UniqueCodePoolRow = {
  id: string;
  prefix: string;
  discountType: string;
  value: string;
  status: string;
  totalGenerated: number;
  totalAssigned: number;
  totalUsed: number;
  expiresAt: string;
};

export type UniqueCodeRow = {
  id: string;
  code: string;
  status: string;
  visitorId: string;
  assignedAt: string;
  expiresAt: string;
  usedAt: string;
};

export type UniqueCodeErrors = {
  form?: string;
  totalCodesToGenerate?: string;
};

type UniqueCodesEditorProps = {
  codes: UniqueCodeRow[];
  errors?: UniqueCodeErrors;
  lockedReason?: string;
  notice?: string;
  pools: UniqueCodePoolRow[];
  values: DiscountSettingsValues;
};

export function UniqueCodesEditor({
  codes,
  errors,
  lockedReason,
  notice,
  pools,
  values,
}: UniqueCodesEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const enabled = values.mode === "UNIQUE_CODES";

  return (
    <s-section heading="Unique Codes">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Unique codes are locked"
        />
      )}

      {notice && (
        <s-banner tone="info" heading="Unique codes updated">
          <s-paragraph>{notice}</s-paragraph>
        </s-banner>
      )}

      {errors?.form && (
        <s-banner tone="critical" heading="Unique codes could not be updated">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      {!lockedReason && (
        <Form method="post" className="counterpulse-form">
          <input name="_action" type="hidden" value="generateUniqueCodes" />
          <input name="mode" type="hidden" value="UNIQUE_CODES" />
          <input
            name="title"
            type="hidden"
            value={values.title || "Promo Pulse unique codes"}
          />
          <input name="startsAt" type="hidden" value={values.startsAt} />
          <input name="endsAt" type="hidden" value={values.endsAt} />
          <input
            name="minimumSubtotal"
            type="hidden"
            value={values.minimumSubtotal}
          />

          <div className="counterpulse-form-grid">
            <label className="counterpulse-toggle">
              <input
                name="enableUniqueCodes"
                type="checkbox"
                defaultChecked={enabled}
              />
              <span>Enable unique codes</span>
            </label>

            <FormField label="Prefix">
              <input
                name="uniqueCodePrefix"
                defaultValue={values.uniqueCodePrefix}
                placeholder="VIP"
              />
            </FormField>

            <FormField label="Discount type">
              <select name="valueType" defaultValue={values.valueType}>
                {discountValueTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Discount value">
              <input
                name="value"
                type="number"
                min="0"
                step="0.01"
                defaultValue={values.value}
              />
            </FormField>

            <FormField label="Duration per visitor">
              <input
                name="uniqueCodeExpiresMinutes"
                type="number"
                min="5"
                max="43200"
                step="1"
                defaultValue={values.uniqueCodeExpiresMinutes}
              />
            </FormField>

            <FormField
              label="Total codes to generate"
              error={errors?.totalCodesToGenerate}
            >
              <input
                name="totalCodesToGenerate"
                type="number"
                min="1"
                max="500"
                step="1"
                defaultValue="25"
              />
            </FormField>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Generating..." : "Generate codes"}
            </button>
          </div>
        </Form>
      )}

      {pools.length > 0 && (
        <s-box paddingBlockStart="base">
          <table className="counterpulse-table">
            <thead>
              <tr>
                <th>Prefix</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Generated</th>
                <th>Assigned</th>
                <th>Used</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((pool) => (
                <tr key={pool.id}>
                  <td>{pool.prefix}</td>
                  <td>
                    {pool.discountType}
                    {pool.value ? ` ${pool.value}` : ""}
                  </td>
                  <td>{pool.status}</td>
                  <td>{pool.totalGenerated}</td>
                  <td>{pool.totalAssigned}</td>
                  <td>{pool.totalUsed}</td>
                  <td>{pool.expiresAt || "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </s-box>
      )}

      <s-box paddingBlockStart="base">
        <table className="counterpulse-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Visitor</th>
              <th>Assigned</th>
              <th>Expires</th>
              <th>Used</th>
            </tr>
          </thead>
          <tbody>
            {codes.length > 0 ? (
              codes.map((code) => (
                <tr key={code.id}>
                  <td>{code.code}</td>
                  <td>{code.status}</td>
                  <td>{code.visitorId || "-"}</td>
                  <td>{code.assignedAt || "-"}</td>
                  <td>{code.expiresAt || "Never"}</td>
                  <td>{code.usedAt || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No unique codes generated yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </s-box>
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
