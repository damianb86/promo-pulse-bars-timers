import type { ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
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

export type UniqueCodeStats = {
  totalAssigned: number;
  totalUsed: number;
  totalExpired: number;
  conversionRate: number;
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
  stats: UniqueCodeStats;
  values: DiscountSettingsValues;
};

export function UniqueCodesEditor({
  codes,
  errors,
  lockedReason,
  notice,
  pools,
  stats,
  values,
}: UniqueCodesEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const enabled = values.mode === "UNIQUE_CODES";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Generate codes",
    title: "Generate unique visitor codes?",
    children: (
      <p>
        This creates a new pool of visitor-scoped codes. Generated codes can be
        assigned to shoppers while the campaign is eligible.
      </p>
    ),
  });

  return (
    <s-section heading="Unique Codes">
      <p className="counterpulse-section-description">
        Generate and monitor codes that are assigned one visitor at a time, with
        real expiration and usage states.
      </p>

      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Unique codes are locked"
        />
      )}

      {notice && (
        <AppAlert tone="info" title="Unique codes updated">
          <s-paragraph>{notice}</s-paragraph>
        </AppAlert>
      )}

      {errors?.form && (
        <AppAlert tone="critical" title="Unique codes could not be updated">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <Form
          method="post"
          className="counterpulse-form"
          onSubmit={confirmSubmit.onSubmit}
        >
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
            <div className="counterpulse-toggle">
              <label className="counterpulse-toggle-label">
                <input
                  name="enableUniqueCodes"
                  type="checkbox"
                  defaultChecked={enabled}
                />
                <span>Enable unique codes</span>
              </label>
              <FieldInfoButton
                label="Enable unique codes"
                title="Unique visitor codes"
              >
                <UniqueCodeInfoContent
                  intro="Unique codes change the offer from a shared discount code to visitor-scoped assignments."
                  items={[
                    [
                      "Assignment",
                      "Promo Pulse assigns one available code to each visitor ID and keeps returning that same valid code.",
                    ],
                    [
                      "No sharing by default",
                      "Codes are not intentionally reused across visitors while they are assigned or used.",
                    ],
                    [
                      "Pool dependency",
                      "The campaign needs generated codes before visitors can receive one.",
                    ],
                  ]}
                />
              </FieldInfoButton>
            </div>

            <FormField
              label="Prefix"
              info={
                <FieldInfoButton label="Prefix" title="Code prefix">
                  <UniqueCodeInfoContent
                    intro="Prefix is prepended to each generated code so merchants can recognize the campaign in Shopify and reports."
                    items={[
                      [
                        "Example",
                        "VIP can generate codes such as VIP-A1B2C3D4E5.",
                      ],
                      [
                        "Best practice",
                        "Keep it short, campaign-specific, and avoid customer names or PII.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <input
                name="uniqueCodePrefix"
                defaultValue={values.uniqueCodePrefix}
                placeholder="VIP"
              />
            </FormField>

            <FormField
              label="Discount type"
              info={
                <FieldInfoButton
                  label="Unique code discount type"
                  title="Unique code discount type"
                >
                  <UniqueCodeInfoContent
                    intro="Discount type controls what each generated visitor code represents."
                    items={[
                      [
                        "Percentage",
                        "Each code discounts a percentage from eligible items or orders.",
                      ],
                      [
                        "Fixed amount",
                        "Each code discounts a currency amount. Confirm the campaign currency and Shopify setup.",
                      ],
                      [
                        "Free shipping",
                        "Each code represents a shipping discount when Shopify discount creation supports it.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
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

            <FormField
              label="Duration per visitor"
              info={
                <FieldInfoButton
                  label="Duration per visitor"
                  title="Visitor code duration"
                >
                  <UniqueCodeInfoContent
                    intro="Duration is the real validity window for a code after it is assigned to a visitor."
                    items={[
                      [
                        "Before expiration",
                        "The visitor keeps seeing the same assigned code.",
                      ],
                      [
                        "After expiration",
                        "Promo Pulse stops showing the old code and the cleanup job can expire or revoke it.",
                      ],
                      [
                        "Urgency",
                        "Short windows are stronger but require accurate expiration messaging.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
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
              info={
                <FieldInfoButton
                  label="Total codes to generate"
                  title="Code pool size"
                >
                  <UniqueCodeInfoContent
                    intro="Pool size is the maximum number of visitors this batch can serve before the pool runs out."
                    items={[
                      [
                        "Controlled failure",
                        "When no available code remains, the storefront receives a controlled unavailable response.",
                      ],
                      [
                        "Planning",
                        "Generate enough codes for expected traffic, then monitor assigned and used totals.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
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
      {confirmSubmit.modal}

      <s-box paddingBlockStart="base">
        <table className="counterpulse-table">
          <thead>
            <tr>
              <th>Total assigned</th>
              <th>Total used</th>
              <th>Total expired</th>
              <th>Conversion rate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{stats.totalAssigned}</td>
              <td>{stats.totalUsed}</td>
              <td>{stats.totalExpired}</td>
              <td>{formatPercent(stats.conversionRate)}</td>
            </tr>
          </tbody>
        </table>
      </s-box>

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

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";

  return `${(value * 100).toFixed(1)}%`;
}

function UniqueCodeInfoContent({
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
