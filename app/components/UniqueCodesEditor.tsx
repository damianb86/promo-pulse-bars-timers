import { useState, type ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  discountValueTypeOptions,
  type DiscountSettingsValues,
  type DiscountValueTypeValue,
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
  reassignExpiredUnused: boolean;
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
  const [valueType, setValueType] = useState(values.valueType);
  const isFreeShipping = valueType === "FREE_SHIPPING";
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
      <div className="counterpulse-offer-strategy-panel">
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
            className="counterpulse-form counterpulse-offer-form"
            onSubmit={confirmSubmit.onSubmit}
          >
            <input name="_action" type="hidden" value="generateUniqueCodes" />
            <input name="mode" type="hidden" value="UNIQUE_CODES" />

            <section className="counterpulse-offer-hero counterpulse-offer-hero--unique">
              <div className="counterpulse-offer-hero__content">
                <span
                  className="counterpulse-offer-hero__icon"
                  aria-hidden="true"
                >
                  UC
                </span>
                <div>
                  <h2>Unique codes</h2>
                  <p>
                    Generate and monitor visitor-scoped codes with real
                    expiration, assignment, and usage states.
                  </p>
                </div>
              </div>
              <div className="counterpulse-offer-hero__control">
                <label className="counterpulse-toggle-label counterpulse-offer-switch">
                  <span>Enable unique codes</span>
                  <input
                    name="enableUniqueCodes"
                    type="checkbox"
                    defaultChecked={enabled}
                  />
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
            </section>

            <div className="counterpulse-offer-card-grid counterpulse-offer-card-grid--three">
              <article className="counterpulse-offer-card">
                <OfferCardHeader
                  icon="01"
                  title="Setup"
                  description="Define the core discount settings."
                />
                <FormField label="Discount title">
                  <input
                    name="title"
                    defaultValue={values.title || "Promo Pulse unique codes"}
                    placeholder="VIP visitor codes"
                  />
                </FormField>
                <div className="counterpulse-form-grid">
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
                    <select
                      name="valueType"
                      value={valueType}
                      onChange={(event) =>
                        setValueType(
                          event.currentTarget.value as DiscountValueTypeValue,
                        )
                      }
                    >
                      {discountValueTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                {!isFreeShipping && (
                  <FormField label="Discount value">
                    <div className="counterpulse-input-with-suffix">
                      <input
                        name="value"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={values.value}
                      />
                      <span>{valueType === "PERCENTAGE" ? "%" : "off"}</span>
                    </div>
                  </FormField>
                )}

                {isFreeShipping && (
                  <FormField label="Free shipping minimum subtotal">
                    <input
                      name="minimumSubtotal"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={values.minimumSubtotal}
                      placeholder="Optional"
                    />
                  </FormField>
                )}
              </article>

              <article className="counterpulse-offer-card">
                <OfferCardHeader
                  icon="02"
                  title="Validity"
                  description="Set how long codes last and when the pool is active."
                />
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
                  <div className="counterpulse-input-with-suffix">
                    <input
                      name="uniqueCodeExpiresMinutes"
                      type="number"
                      min="5"
                      max="43200"
                      step="1"
                      defaultValue={values.uniqueCodeExpiresMinutes}
                    />
                    <span>minutes</span>
                  </div>
                </FormField>
                <div className="counterpulse-form-grid">
                  <FormField label="Pool starts at">
                    <input
                      name="startsAt"
                      type="datetime-local"
                      defaultValue={values.startsAt}
                    />
                  </FormField>

                  <FormField label="Pool expires at">
                    <input
                      name="endsAt"
                      type="datetime-local"
                      defaultValue={values.endsAt}
                    />
                  </FormField>
                </div>
                <div className="counterpulse-toggle counterpulse-offer-toggle-row">
                  <label className="counterpulse-toggle-label">
                    <input
                      name="uniqueCodeReassignExpired"
                      type="checkbox"
                      defaultChecked={values.uniqueCodeReassignExpired}
                    />
                    <span>Reassign unused expired codes</span>
                  </label>
                  <FieldInfoButton
                    label="Reassign unused expired codes"
                    title="Reassign expired unused codes"
                  >
                    <UniqueCodeInfoContent
                      intro="When a visitor lets their assigned code expire without using it, Promo Pulse can return that code to the pool for another visitor."
                      items={[
                        [
                          "Original visitor",
                          "The visitor who missed the window stops seeing codes for this campaign.",
                        ],
                        [
                          "Unused codes",
                          "Expired unused codes can be assigned again with a fresh validity window.",
                        ],
                        [
                          "Used codes",
                          "Redeemed codes stay used and are never returned to the pool.",
                        ],
                      ]}
                    />
                  </FieldInfoButton>
                </div>
              </article>

              <article className="counterpulse-offer-card">
                <OfferCardHeader
                  icon="03"
                  title="Generation"
                  description="Control code generation and application."
                />
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

                <div className="counterpulse-toggle counterpulse-offer-toggle-row">
                  <label className="counterpulse-toggle-label">
                    <input
                      name="uniqueCodeAutoApply"
                      type="checkbox"
                      defaultChecked={values.uniqueCodeAutoApply}
                    />
                    <span>Auto-apply visitor codes when safe</span>
                  </label>
                  <FieldInfoButton
                    label="Auto-apply visitor codes"
                    title="Auto-apply unique codes"
                  >
                    <UniqueCodeInfoContent
                      intro="Auto-apply uses Shopify discount URLs when it is safe to route the shopper through a discount link."
                      items={[
                        [
                          "How it works",
                          "The storefront can link to /discount/CODE and preserve the visitor's current destination.",
                        ],
                        [
                          "Limitation",
                          "Shopify controls final cart and checkout behavior, so Promo Pulse does not force unsafe apply actions.",
                        ],
                      ]}
                    />
                  </FieldInfoButton>
                </div>

                {isFreeShipping && (
                  <AppAlert
                    tone="info"
                    title="Discount value is hidden for free-shipping codes"
                  >
                    <p>
                      Free-shipping unique codes use the optional minimum
                      subtotal instead of a percentage or fixed amount.
                    </p>
                  </AppAlert>
                )}
              </article>
            </div>

            <div className="counterpulse-offer-actions">
              <button className="counterpulse-button" type="submit">
                {isSubmitting ? "Generating..." : "Generate codes"}
              </button>
            </div>
          </Form>
        )}
        {confirmSubmit.modal}

        <dl className="counterpulse-offer-stat-strip">
          <div>
            <dt>Total assigned</dt>
            <dd>{stats.totalAssigned}</dd>
          </div>
          <div>
            <dt>Total used</dt>
            <dd>{stats.totalUsed}</dd>
          </div>
          <div>
            <dt>Total expired</dt>
            <dd>{stats.totalExpired}</dd>
          </div>
          <div>
            <dt>Conversion rate</dt>
            <dd>{formatPercent(stats.conversionRate)}</dd>
          </div>
        </dl>

        {pools.length > 0 && (
          <section className="counterpulse-offer-table-card">
            <div className="counterpulse-offer-table-card__header">
              <h3>Generated pools</h3>
              <p>Monitor code batches before they run out or expire.</p>
            </div>
            <div className="counterpulse-offer-table-card__scroll">
              <table className="counterpulse-table">
                <thead>
                  <tr>
                    <th>Prefix</th>
                    <th>Discount</th>
                    <th>Status</th>
                    <th>Generated</th>
                    <th>Assigned</th>
                    <th>Used</th>
                    <th>Reassign unused</th>
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
                      <td>
                        <span className="counterpulse-offer-status-pill">
                          {pool.status}
                        </span>
                      </td>
                      <td>{pool.totalGenerated}</td>
                      <td>{pool.totalAssigned}</td>
                      <td>{pool.totalUsed}</td>
                      <td>{pool.reassignExpiredUnused ? "Yes" : "No"}</td>
                      <td>{pool.expiresAt || "Never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="counterpulse-offer-table-card">
          <div className="counterpulse-offer-table-card__header">
            <h3>Assigned codes</h3>
            <p>Review assignment, expiration, and redemption status.</p>
          </div>
          <div className="counterpulse-offer-table-card__scroll">
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
                      <td>
                        <span className="counterpulse-offer-status-pill">
                          {code.status}
                        </span>
                      </td>
                      <td>{code.visitorId || "-"}</td>
                      <td>{code.assignedAt || "-"}</td>
                      <td>{code.expiresAt || "Never"}</td>
                      <td>{code.usedAt || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="counterpulse-offer-empty">
                        <span aria-hidden="true">CODE</span>
                        <strong>No unique codes generated yet</strong>
                        <p>
                          Generate codes to start assigning them to your
                          visitors.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
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

function OfferCardHeader({
  description,
  icon,
  title,
}: {
  description: string;
  icon: string;
  title: string;
}) {
  return (
    <div className="counterpulse-offer-card__header">
      <span aria-hidden="true">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
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
