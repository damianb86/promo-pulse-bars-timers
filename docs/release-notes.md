# Promo Pulse: Bars & Timers - MVP Stage 1 Release Notes

## Release Goal

Prepare Promo Pulse: Bars & Timers for end-to-end validation in a Shopify
development store before app review and public listing work.

## Completed For MVP Testing

- Embedded Shopify admin app with dashboard, campaign list, campaign editor,
  onboarding, analytics, settings, and billing placeholder pages.
- Campaign CRUD with create, edit, duplicate, pause, activate, and delete flows.
- Campaign design editor with desktop/mobile preview.
- Campaign translations for `en`, `es`, `pt-BR`, `fr`, and `de`.
- Storefront campaigns API with placement, targeting, plan gating, and
  storefront-safe serialization.
- Theme App Extension with global App Embed, product timer block, product badge
  block, and cart timer block.
- Storefront rendering for countdown bars, product timers, cart timers, free
  shipping goal bars, delivery cutoff messages, low stock messages, badges, CTA,
  coupon copy, and basic analytics events.
- Shopify Web Pixel extension scaffold and event mapper.
- Prisma schema, migrations, and seed data for local/demo testing.
- Vitest coverage for critical Stage 1 logic and lightweight integration flow.

## Verified Configuration

Shopify app name:

```text
Promo Pulse: Bars & Timers
```

Minimum Stage 1 scopes:

```text
read_products,read_discounts,write_discounts,write_pixels,read_customer_events
```

Expected environment variables:

```text
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SCOPES
SHOPIFY_APP_URL
SHOP_CUSTOM_DOMAIN
DATABASE_URL
PROMO_PULSE_DEV_PLAN
```

`PROMO_PULSE_DEV_PLAN` is the local plan override.

## Critical TODOs Before Public App Review

- Connect Shopify Billing for real subscriptions. `billing.server.ts` still
  returns local placeholder messages.
- Create and sync Web Pixel records during install or onboarding. The extension
  exists, but app pixel creation must be wired to Shopify Admin GraphQL for
  production.
- Replace placeholder `application_url` and `redirect_urls` in
  `shopify.app.toml` by linking/deploying the real app with Shopify CLI. Run
  `npm run config:check` before testing in Shopify Admin.
- Run OAuth reinstall after scope changes so the dev store grants the minimum
  Stage 1 scopes.
- Decide production database strategy. SQLite is fine locally; production should
  use managed Postgres with a dedicated Prisma migration plan.
- Validate app proxy `/apps/promo-pulse` in the dev store after app
  linking. Storefront rendering depends on this proxy reaching
  `/api/storefront/campaigns`.
- Validate Theme App Extension blocks in Dawn and at least one non-Dawn theme.
  Cart drawer selector behavior is theme-dependent.
- Confirm discount sync behavior with real discounts and missing discount scopes.
- Confirm low stock behavior only displays exact inventory when Shopify exposes
  real inventory values.
- Add screenshots and merchant-facing support content before app listing.

## Known MVP Limitations

- Revenue attribution is approximate and session-based.
- Cart drawer placement cannot be guaranteed for every theme without a custom
  selector.
- Product badges are block-based; the app does not rewrite every collection card
  automatically in Stage 1.
- Shopify Billing subscription creation, cancellation, and sync are placeholders.
- Web Pixel activation requires manual setup until pixel creation is wired.
- Theme assets and app proxy paths use the final Promo Pulse naming.
