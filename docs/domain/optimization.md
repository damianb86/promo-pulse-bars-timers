# Optimization and extended campaign features

These features attach to campaigns but have focused models/services and plan gates. Read the owning existing guide for deep operational detail.

| Domain                         | Source and entry points                                                        | Key constraints                                                                                             | Tests/docs                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Experiments                    | `app/services/experiments/`, `ExperimentsEditor.tsx`, serializer override code | stable visitor hash, normalized integer weights, one open experiment, winner application needs publish      | experiment unit/E2E, [experiment reporting](../experiment-reporting.md)                                           |
| Markets                        | `app/services/markets/`, `MarketCampaignRule`                                  | most-specific matching rule; disabled match hides; missing context leaves base unchanged                    | Markets tests, [Markets](../markets.md)                                                                           |
| Basic/unique discounts         | discount sync model/services, `app/services/discounts/`, unique-code routes    | codes are real Shopify/configured codes; assignment is visitor/session scoped; never promise application    | unique-code tests, [unique codes](../unique-discount-codes.md)                                                    |
| Advanced discounts             | `app/services/discounts/advancedDiscounts.server.ts`, Function extension       | Function config/metafield and supported inputs must align; free gift is not auto-added                      | extension/unit tests, [advanced discounts](../advanced-discounts.md)                                              |
| Badges                         | `app/services/badges/`, badge endpoint/runtime                                 | badge placements use dedicated endpoint; stock/pricing claims need data                                     | badge tests, [advanced badges](../advanced-badges.md)                                                             |
| Checkout/post-purchase         | checkout/post-purchase services and UI extensions                              | no checkout blocking; no PII; applied/used claims require Shopify evidence                                  | endpoint/view-model/E2E, [checkout](../checkout-ui-extension.md), [post-purchase](../post-purchase-extensions.md) |
| Templates                      | `app/services/templates/`, `app.templates.tsx`                                 | system templates and shop templates share normalized campaign configuration; template is not a setup preset | template tests/E2E                                                                                                |
| AI builder/assets/translations | `app/services/ai/`, assets pipeline                                            | provider output is untrusted; claim/structure guardrails; Shopify Files scope/plan; merchant review         | AI/asset tests/E2E, [AI builder](../ai-campaign-builder.md)                                                       |
| Email timers                   | `app/services/email-timers/`, public token route                               | render image from real timer; public token, cache/privacy, no per-open fake urgency                         | tests/E2E, [email timers](../email-timers.md)                                                                     |
| Recommendations                | `app/services/recommendations/`, recommendations route                         | derive from real evidence; explain rationale; applying is explicit                                          | tests/E2E                                                                                                         |
| Agency                         | `app/services/agency/`, agency route                                           | explicit shop access/role and tenant isolation                                                              | tests/E2E                                                                                                         |

## Override ordering

Experiments select a variant with stable weighted assignment and can override text, design, discount, and placement in the serialized payload. Markets resolution then selects the best matching market/country/locale/currency rule, optionally hides the campaign, or applies allowed text/free-shipping/delivery changes. Applying an experiment winner copies allowed values into the editable base; publication is still required.

## Cross-cutting invariants

- Enforce premium features in mutation/public services, not just UI.
- External Shopify resources and scopes can be absent; return actionable admin errors and no-render public failures.
- Do not create a compatibility path for older configuration formats.
- Reported/recommended results distinguish observed events from inferred attribution.

## Validation

Run the owning unit tests and matching E2E spec, then campaign publication/serialization tests if the feature affects storefront. Extension/config changes require extension build/config checks.

## Maintenance

Source of truth: owning service/model/route and premium-feature gates. Update this map for a new extended domain, ownership shift, override stage, or broad invariant.
