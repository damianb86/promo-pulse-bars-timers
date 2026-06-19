# Promo Pulse Testing

Promo Pulse uses Vitest for unit and lightweight integration tests, and
Playwright for browser E2E flows. The main E2E suite does not require Shopify
login, a dev store, or a real Admin session.

## Commands

```bash
npm run test:unit
npm run test:e2e
npm run test
```

Useful Playwright modes:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug
npm run test:e2e:report
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm run format:check
```

## E2E Test Mode

Playwright starts the app through `npm run test:e2e:web`. That script sets:

```bash
E2E_TEST_MODE=true
NODE_ENV=development
DATABASE_URL=file:./e2e.sqlite
PROMO_PULSE_DEV_PLAN=AGENCY
PROMOPILOT_DEV_PLAN=AGENCY
PORT=31338
```

`E2E_TEST_MODE` is blocked when `NODE_ENV === "production"`. The test-only
routes call `requireE2ETestMode()` and return 404 outside this mode.

The Playwright web server does not reuse an already-running local server. This
prevents stale `react-router dev` or `shopify app dev` processes from running
the suite with old code or without `E2E_TEST_MODE=true`. The default E2E port is
`31338`; override it with `E2E_PORT=...` if that port is busy.

The demo shop is `demo-shop.myshopify.com`. `/__test/login` sets a local test
cookie and `authenticateAdmin()` returns a mock admin session only in E2E mode.
Real Shopify auth routes still use the official Shopify template auth.

When no dev override is provided and `NODE_ENV=development`, Promo Pulse treats
the effective local plan as `AGENCY` so all Stage 2 surfaces are available
during development.

## Test Routes

- `/__test/login`
- `/__test/reset-db`
- `/__test/storefront`
- `/__test/storefront-product`
- `/__test/storefront-cart`
- `/__test/analytics-summary`

The fake storefront routes load the same theme assets through
`/__test/theme-asset/:asset` and call the local app proxy route
`/apps/counterpulse-campaigns`.

## E2E Coverage

The Playwright suite covers:

- onboarding starter campaign activation;
- campaign CRUD actions;
- campaign create validation and campaign list filters;
- design preview and persistence;
- advanced campaign editor settings for free shipping, delivery cutoff, low
  stock, badge, and manual discount references;
- Spanish translations plus locale/country targeting;
- storefront countdown rendering and CTA analytics;
- free shipping goal progress and unlocked state;
- delivery cutoff before and after cutoff;
- cart drawer insertion without duplicate widgets;
- shop Settings persistence;
- Billing plan cards and local billing placeholder behavior;
- analytics events visible in the admin page.

Fixtures in `tests/e2e/fixtures.ts` reset the database, log in as the demo shop,
create campaigns through the UI, and capture console/request failures. Expected
React Router `.data` aborts and non-blocking analytics aborts are ignored; other
failed requests still fail the test.

## Reports And Traces

Playwright is configured with:

- `trace: retain-on-failure`;
- screenshots on failure;
- videos on failure;
- HTML report in `playwright-report/`;
- raw artifacts in `test-results/`.

Open a failed trace:

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

Open the HTML report:

```bash
npm run test:e2e:report
```

## Unit Coverage

Vitest covers pure and server-side logic including:

- timer engine;
- targeting;
- delivery promise calculation;
- free shipping progress;
- translation fallback;
- plan limits;
- campaign rules;
- settings defaults;
- analytics aggregation;
- Shopify discount service mocks;
- Stage 1 flow integration helpers.

Shared factories live in `app/test/factories.ts`.

## Smoke Tests Against Shopify

The main suite intentionally avoids Shopify. For a real dev store smoke test:

1. Set real `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`,
   `SCOPES`, and `DATABASE_URL`.
2. Run `npm run config:link`.
3. Run `npm run dev`.
4. Install the app in a dev store.
5. Create a campaign in the admin.
6. Enable the theme app embed.
7. Add product/cart app blocks where needed.
8. Verify the storefront manually.

Do not enable `E2E_TEST_MODE` for real store testing.

## Limitations

- The mock admin session does not verify OAuth, billing, or Shopify Admin API
  permissions.
- The fake storefront covers common theme integration points, not every theme
  DOM structure.
- Web Pixel behavior is unit-tested at the mapper level; real pixel activation
  still needs Shopify dev store smoke testing.
- App Bridge may emit known standalone-mode warnings in E2E because tests run
  outside Shopify Admin.
