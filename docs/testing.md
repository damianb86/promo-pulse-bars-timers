# Promo Pulse Testing

Promo Pulse uses Vitest for Stage 1 unit tests and lightweight integration
tests. The test suite is designed to run locally without a Shopify dev store,
real Shopify APIs, or a production database.

## Commands

```bash
npm run test
npm run lint
npm run typecheck
```

Run one file while iterating:

```bash
npm run test -- app/test/stage-one-flow.test.ts
```

## Test factories

Shared test factories live in `app/test/factories.ts`:

- `createTestShop`
- `createTestCampaign`
- `createTestContext`

They return Prisma-shaped objects and storefront context objects so tests can exercise the same serialization, view-model, targeting, timer, and plan-gating logic used by the app.

## Stage 1 flow coverage

`app/test/stage-one-flow.test.ts` covers the MVP flow without browser automation:

- Flash Sale Countdown Bar creation data.
- Design changes.
- Spanish campaign translation.
- Locale/country targeting.
- Activation status transition.
- Storefront campaign eligibility and non-eligibility.
- Storefront-safe serialization.
- Storefront API route behavior for eligible and non-eligible campaigns.
- Storefront API validation and dynamic cache headers.
- Admin/storefront view model rendering shape.
- Free Shipping Goal serialization and progress calculation.
- Delivery Cutoff serialization and promise calculation.
- Analytics impression/click validation, mocked persistence, and public app
  proxy action behavior.
- Plan gating for Free vs Pro features.

## Mocks

Analytics and storefront API persistence are mocked at the Prisma boundary in
the Stage 1 flow test. This keeps the test deterministic and verifies that the
route handlers call the same campaign filtering, serialization, plan gating,
and analytics ingestion code used by the app without requiring SQLite setup or
a Shopify store.

Shopify Admin API calls are not made in this suite. Discount API behavior remains covered by service-level tests with explicit mocks.

## Future browser coverage

Playwright is intentionally not required for Stage 1. A future browser suite should focus on:

- Embedded admin navigation.
- Campaign wizard happy path.
- Theme App Embed rendering in a dev theme.
- Product, cart page, and cart drawer blocks.
- Keyboard navigation and screen-reader labels.
