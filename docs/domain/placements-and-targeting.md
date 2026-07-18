# Placements and targeting

## Placement model

A campaign has one or more `CampaignPlacement` records. Enabled records specify a `PlacementType`; only `CUSTOM_SELECTOR` persists per-campaign selector/style. Shop settings provide default and optional mobile selectors for known surfaces. Requested placements are matched before serialization, and one campaign payload can carry several placement descriptors.

| Placement family                        | Runtime owner                                    |
| --------------------------------------- | ------------------------------------------------ |
| `TOP_BAR`, `BOTTOM_BAR`, `CART_DRAWER`  | theme app embed/runtime                          |
| `PRODUCT_PAGE`, `CART_PAGE`             | theme app block/runtime                          |
| `PRODUCT_PAGE_BADGE`, `COLLECTION_CARD` | dedicated badge endpoint and badge block/runtime |
| `CUSTOM_SELECTOR`                       | theme runtime using campaign/shop selector       |
| `THANK_YOU_PAGE`                        | checkout UI extension                            |
| `ORDER_STATUS_PAGE`                     | customer account UI extension                    |

Support is a combination of campaign type and runtime, not an unrestricted enum cross-product. See the [capability matrix](../campaign-types/capability-matrix.md).

## Targeting dimensions

`CampaignTargeting` stores JSON lists for country, market, locale, product, collection, product/customer tag, included URL, excluded URL, UTM source, device, product/collection exclusions, and optional behavior rules. Empty inclusion lists mean unrestricted. Page tokens such as `page:product` are defined in `app/components/campaign-form/constants.tsx` and evaluated in `app/utils/storefront-campaigns.ts`.

## Eligibility precedence

1. Campaign status, schedule, publication, requested placement, impression/plan gates.
2. Product ID exclusion.
3. Collection ID exclusion.
4. Excluded URL/path match.
5. Every configured inclusion dimension must match: country, market, locale, product, collection, product tag, customer tag, included URL, UTM, device.
6. Behavior rules must match the privacy-gated visitor profile.
7. Base serialization.
8. Stable experiment override.
9. Best Markets rule; a matching disabled rule removes the campaign, otherwise permitted overrides win.

Exclusions therefore always win over inclusions. Missing context fails a configured inclusion rather than guessing. Locale matching and URL page-token behavior use focused normalizers; preserve their tests.

## Behavior targeting and privacy

Behavior rules derive recent anonymous event counts/timestamps. The server only builds the profile when active campaigns need it and consent/do-not-track/settings permit analytics. Adding a behavior signal affects analytics retention/lookup, cacheability, serialized rules, form parsing, and storefront request parameters.

## Main entry points

- Enum/options/form: `prisma/schema.prisma`, `app/types/campaign-options.ts`, `app/types/campaign.ts`, campaign form files.
- Evaluation/context parsing: `app/utils/storefront-campaigns.ts`.
- Behavior: `app/types/behavior-targeting.ts`, `app/services/behavior/`.
- Markets: `app/services/markets/marketOverrides.ts`.
- Shop selectors: `app/types/shop-settings.ts`, `app/services/shopSettings.server.ts`.

## Validation

Run campaign-structure/rules tests, behavior and Markets tests, `translations-targeting.spec.ts`, `behavior-targeting.spec.ts`, `markets.spec.ts`, campaign-type/cart-drawer E2E as relevant, theme build, and docs check.

## Related documentation

[Data flow](../architecture/data-flow.md), [add-placement workflow](../workflows/add-placement.md), existing [Markets guide](../markets.md).

## Maintenance

Source of truth: placement enum/options, form persistence, storefront evaluator, Markets and behavior services. Update when a placement, dimension, page token, precedence rule, or runtime owner changes.
