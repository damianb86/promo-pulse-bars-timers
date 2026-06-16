# Promo Pulse Localization

Promo Pulse stores campaign-facing copy in `CampaignTranslation` rows, one row
per campaign and storefront locale.

## Supported Storefront Locales

Stage 1 requires these locales:

- `en`
- `es`
- `pt-BR`
- `fr`
- `de`

New campaigns create default copy for all five locales. Merchant-provided creation copy is applied to English when present.

## Fallback Rules

Use `getCampaignText(campaign, locale, field)` for storefront/admin text resolution.

Fallback order:

1. Requested locale when that field has text.
2. English (`en`) when that field has text.
3. First available translation that has text for the field.
4. Empty string when no translation has text.

Regional storefront locales are normalized for lookup. For example, `es-MX` resolves to `es`, and `pt_BR` resolves to `pt-BR`.

## Editable Fields

- `headline`
- `subheadline`
- `ctaText`
- `expiredText`
- `freeShippingEmptyText`
- `freeShippingProgressText`
- `freeShippingSuccessText`
- `deliveryBeforeCutoffText`
- `deliveryAfterCutoffText`
- `lowStockText`
- `badgeText`

## Admin Flow

Campaign edit includes a `Translations` section with locale tabs. Merchants can edit each locale independently or copy English text into one locale or all locales before saving.
