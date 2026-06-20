import { type ReactNode, useMemo, useState } from "react";

import { AppAlert } from "./Notifications";
import type { CampaignTypeValue } from "../types/campaign-options";
import type { DiscountModeValue } from "../types/discount";

type OfferSectionKey =
  | "basic-discount"
  | "unique-codes"
  | "advanced-rules"
  | "email-timer";

type OfferSection = {
  key: OfferSectionKey;
  label: string;
  description: string;
  content: ReactNode;
};

type OffersEditorProps = {
  advancedRulesCount: number;
  campaignType: CampaignTypeValue;
  campaignTypeLabel: string;
  discountMode: DiscountModeValue;
  sections: OfferSection[];
  uniquePoolsCount: number;
};

const merchandisingOnlyTypes = new Set<CampaignTypeValue>([
  "LOW_STOCK",
  "PRODUCT_BADGE",
]);

export function OffersEditor({
  advancedRulesCount,
  campaignType,
  campaignTypeLabel,
  discountMode,
  sections,
  uniquePoolsCount,
}: OffersEditorProps) {
  const [activeSectionKey, setActiveSectionKey] = useState<OfferSectionKey>(
    () =>
      discountMode === "UNIQUE_CODES"
        ? "unique-codes"
        : advancedRulesCount > 0
          ? "advanced-rules"
          : "basic-discount",
  );
  const activeSection =
    sections.find((section) => section.key === activeSectionKey) ?? sections[0];
  const offerStateItems = useMemo(
    () => [
      ["Shared discount", formatDiscountMode(discountMode)],
      ["Unique code pools", String(uniquePoolsCount)],
      ["Advanced rules", String(advancedRulesCount)],
      ["Campaign type", campaignTypeLabel],
    ],
    [advancedRulesCount, campaignTypeLabel, discountMode, uniquePoolsCount],
  );

  if (!activeSection) return null;

  return (
    <div className="counterpulse-offers-workspace">
      <div className="counterpulse-offer-overview">
        <AppAlert tone="info" title="Choose one offer strategy at a time">
          <p>
            Basic discounts are shared Shopify codes, Unique Codes assigns one
            code per visitor, and Advanced Rules are Shopify Function based
            discount logic. Email timers are assets that can support any offer.
          </p>
        </AppAlert>

        {merchandisingOnlyTypes.has(campaignType) && (
          <AppAlert tone="warning" title="Some offer settings are optional">
            <p>
              {campaignTypeLabel} campaigns usually rely on the Merchandising
              tab. Discount configuration remains available, but unrelated
              discount fields are hidden inside each offer strategy.
            </p>
          </AppAlert>
        )}

        <dl className="counterpulse-offer-summary">
          {offerStateItems.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div
        aria-label="Offer strategy"
        className="counterpulse-subtabs"
        role="tablist"
      >
        {sections.map((section) => (
          <button
            aria-controls={`offer-panel-${section.key}`}
            aria-selected={activeSection.key === section.key}
            className={activeSection.key === section.key ? "is-active" : ""}
            id={`offer-tab-${section.key}`}
            key={section.key}
            role="tab"
            type="button"
            onClick={() => setActiveSectionKey(section.key)}
          >
            <span>{section.label}</span>
            <small>{section.description}</small>
          </button>
        ))}
      </div>

      {sections.map((section) => (
        <section
          aria-labelledby={`offer-tab-${section.key}`}
          className="counterpulse-subtab-panel"
          hidden={activeSection.key !== section.key}
          id={`offer-panel-${section.key}`}
          key={section.key}
          role="tabpanel"
        >
          {section.content}
        </section>
      ))}
    </div>
  );
}

function formatDiscountMode(value: DiscountModeValue) {
  if (value === "NONE") return "No shared discount";
  if (value === "LINK_EXISTING") return "Linked Shopify discount";
  if (value === "CREATE_NEW") return "Created Shopify code";
  return "Unique codes active";
}
