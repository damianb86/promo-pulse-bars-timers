import { type ReactNode, useState } from "react";

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

  if (!activeSection) return null;

  return (
    <div className="counterpulse-offers-workspace">
      {merchandisingOnlyTypes.has(campaignType) && (
        <AppAlert tone="warning" title="Some offer settings are optional">
          <p>
            {campaignTypeLabel} campaigns usually rely on Conversion modules
            for the storefront presentation. Discount configuration remains
            available here, but unrelated discount fields are hidden inside each
            offer strategy.
          </p>
        </AppAlert>
      )}

      <div
        aria-label="Offer strategy"
        className="counterpulse-builder-tabs counterpulse-offers-tabs"
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
            {section.label}
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
