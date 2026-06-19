# Promo Pulse: Bars & Timers - Stage 2 Release Notes

Date: 2026-06-19

## Release Goal

Stage 2 moves Promo Pulse from basic bars and timers into premium promotional
campaign optimization. The release keeps Stage 1 storefront behavior compatible
while adding premium flows for unique codes, experiments, advanced reporting,
email timers, market overrides, AI-assisted draft creation, and agency
operations.

This release is ready for QA in a Shopify development store. Public app review
still requires final Shopify Billing wiring, real-store extension deployment,
screenshots, and production URLs.

## Included

- Unique discount codes per anonymous visitor, backed by discount code pools,
  visitor-scoped assignment, expiration, copy/apply tracking, and reconciliation
  hooks for order usage.
- A/B testing for campaign message, design, discount, and placement overrides,
  with stable visitor assignment and experiment event attribution.
- Experiment reporting and conservative auto-winner detection. Winners are not
  applied automatically unless the merchant explicitly confirms the action.
- Shopify Function base for advanced discounts such as tiered discounts,
  spend-based rules, free gift rules, and cart-content conditions.
- Checkout UI extension for checkout-safe promotional reminders, plus
  thank-you and order-status extension surfaces for post-purchase messages.
- Dynamic email countdown timer image endpoint for email tools that cannot run
  JavaScript.
- Advanced product badge rule engine with priority, scheduling, market and
  locale conditions, and badge analytics.
- Shopify Markets overrides for country, locale, currency, threshold, delivery
  promise, and campaign text.
- AI Campaign Builder with mock/dev fallback, controlled prompt output, draft
  review, translations, and suggested experiment variants.
- Advanced reports with date, campaign, placement, country, locale, market, and
  device filters, plus CSV export.
- Behavior targeting, recommendations, campaign template library, and a simple
  multi-store agency dashboard.
- Premium and Agency plan gates for Stage 2 features.

## Plan Packaging

| Plan    | Stage 2 positioning                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Free    | Stage 1 basics only.                                                                                                        |
| Starter | Basic campaigns, scheduling, templates, recurring timers, and basic targeting.                                              |
| Growth  | Cart drawer, delivery cutoff, discount sync, analytics, and multi-language campaigns.                                       |
| Pro     | Advanced targeting, advanced badges, custom CSS, better attribution, reports, behavior targeting, and recommendations.      |
| Premium | Unique codes, A/B testing, auto-winner, advanced discounts, email timers, advanced reports, market overrides, and AI draft. |
| Agency  | Multi-store dashboard, shared/copy workflows, and higher limits.                                                            |

## Verified Scope Status

Configured in `shopify.app.toml`:

```text
read_products,read_orders,read_discounts,write_discounts,write_pixels,read_customer_events
```

- `write_discounts`: present. Required for native discount creation and unique
  code pools when using real Shopify Admin API calls.
- `read_products`: present. Required for product-aware targeting, product
  badges, product recommendations, and product context in premium rules.
- `read_orders`: present. Required for `orders/create` webhook reconciliation
  and used-code marking.
- `read_discounts`: present. Required for basic discount sync and discount
  validation.
- `write_pixels` and `read_customer_events`: present for Web Pixel setup and
  event ingestion.
- `read_shipping`: not present. Current Stage 2 code does not call Shopify
  Admin shipping APIs. Checkout and discount extensions use checkout/runtime
  data instead. Add `read_shipping` and force app reauthorization only if a
  future release reads shipping profiles, shipping zones, or carrier/rate data
  through Admin APIs.
- Checkout, thank-you, order-status, and Function surfaces are extension
  deployments. They do not add a separate Admin OAuth scope in this repo, but
  they must be deployed and manually added/configured in Shopify checkout or
  customer account editors where applicable.

After any scope change, reinstall or reauthorize the app in the dev store before
QA. Run `npm run config:check` after linking the Shopify app.

## QA Evidence

Automated release checks for this candidate:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

Focused Stage 2 E2E coverage exists for:

- `tests/e2e/unique-codes.spec.ts`
- `tests/e2e/experiments.spec.ts`
- `tests/e2e/auto-winner.spec.ts`
- `tests/e2e/email-timers.spec.ts`
- `tests/e2e/markets.spec.ts`
- `tests/e2e/ai-builder.spec.ts`
- `tests/e2e/reports.spec.ts`
- `tests/e2e/agency.spec.ts`

## Release Risks

- Shopify real store behavior can differ from E2E mocks for Admin GraphQL
  discount creation, app proxy routing, order webhooks, extension deployment,
  and checkout editor availability.
- Checkout UI extensions depend on the merchant adding the block in the
  checkout editor and on plan/platform eligibility. The extension must fail
  closed and never block checkout.
- Discount code apply URLs use Shopify `/discount/CODE?redirect=...`. Behavior
  can vary by market, checkout configuration, discount conflicts, and browser
  context. Promo Pulse must not claim a code is applied until Shopify handles
  the discount.
- Attribution is approximate and anonymous. It is based on visitor/session IDs,
  touch windows, and available checkout/order events; it is not customer-level
  or cross-device attribution.
- Public email timer URLs are bearer-style public tokens. Tokens must remain
  unguessable and must not encode customer data, shop secrets, or discount
  secrets.
- Storefront performance is guarded by feature gating and short caching, but
  theme-specific cart drawers and app proxy failures still need real-theme QA.
- AI output is draft-only, must be reviewed by the merchant, and cannot invent
  stock, discounts, delivery promises, or scarcity claims.

## Before Public App Review

- Replace placeholder Shopify app URLs with production URLs and run
  `npm run config:check -- --strict`.
- Verify all extension builds through Shopify CLI and deploy them to the target
  app.
- Connect Shopify Billing charge creation and subscription sync for paid plans.
- Reinstall the app in a dev store after confirming final scopes.
- Complete the Stage 2 QA checklist in `docs/stage-2-qa-checklist.md`.
- Capture final App Store screenshots and update the app listing copy.
