# Real Store E2E

This suite runs Playwright against a real Shopify dev store for Promo Pulse: Bars & Timers. It is separate from the local mocked E2E suite and is disabled unless `REAL_E2E_ENABLED=true`.

Use it to smoke real admin, storefront, theme app embed, theme blocks, cart behavior, checkout loading, analytics, reports, templates, settings, billing, and cleanup flows.

## Safety Model

- Tests only run when explicitly enabled with `REAL_E2E_ENABLED=true`.
- The suite uses `[PP-E2E]` for campaign/product/collection names and `PPE2E` for discount codes.
- Cleanup only runs with `REAL_E2E_CLEANUP=true`.
- Checkout only runs with `REAL_E2E_ALLOW_CHECKOUT=true`.
- The suite does not complete orders. Keep `REAL_E2E_ALLOW_ORDER=false` unless a future dedicated order spec is added.
- Helpers never delete non-prefixed resources.
- Missing required environment variables skip tests with actionable messages instead of failing with unclear setup errors.

## Prepare A Dev Store

1. Create or choose a Shopify dev store.
2. Install Promo Pulse: Bars & Timers in that store.
3. Make the storefront accessible. If it has a password page, set `SHOPIFY_STOREFRONT_PASSWORD`.
4. Enable the Promo Pulse app embed in the active theme.
5. Add product/cart blocks in the theme editor for specs that need them:
   - Product template: Promo Pulse product timer, badge, or low-stock block.
   - Cart page or drawer: Promo Pulse cart timer block if the theme does not use app embed drawer injection.
6. Use a safe product dedicated to testing, or provide an Admin API token that can create a `[PP-E2E] Test Product`.

Before running the suite, the app must be reachable by the store. For local/tunnel testing, run:

```bash
npm run dev
```

Then copy the app/admin URL or preview URL into `PROMO_PULSE_APP_ADMIN_URL`.

## Configure Environment

Copy the example and fill real values:

```bash
cp .env.real-e2e.example .env.real-e2e
```

Required when enabled:

```bash
REAL_E2E_ENABLED=true
SHOPIFY_SHOP_DOMAIN=example.myshopify.com
SHOPIFY_ADMIN_URL=https://admin.shopify.com/store/<store-handle>
SHOPIFY_STOREFRONT_URL=https://example.myshopify.com
PROMO_PULSE_APP_ADMIN_URL=<admin app URL or direct app tunnel URL>
REAL_E2E_STORAGE_STATE=playwright/.auth/shopify-admin.json
```

Useful optional values:

```bash
SHOPIFY_STOREFRONT_PASSWORD=
SHOPIFY_ADMIN_ACCESS_TOKEN=
REAL_E2E_THEME_NAME=
REAL_E2E_PRODUCT_HANDLE=
REAL_E2E_ALLOW_CHECKOUT=false
REAL_E2E_ALLOW_ORDER=false
REAL_E2E_CLEANUP=false
REAL_E2E_HEADLESS=true
REAL_E2E_DEBUG=false
REAL_E2E_LOCAL_THEME_ASSET_FALLBACK=false
REAL_E2E_THEME_ASSETS_DIR=extensions/counterpulse-theme/assets
PROMOPULSE_REAL_E2E_PLAN=PRO
REAL_E2E_TIMEOUT_MS=90000
```

If `SHOPIFY_ADMIN_ACCESS_TOKEN` is set, helper code can create and clean up prefixed Shopify resources where the token has scope. If it is not set, product/cart specs require `REAL_E2E_PRODUCT_HANDLE`.

For local `shopify app dev` runs, Shopify can occasionally leave the active
theme pointing at a stale `dev-...` theme extension asset URL. If storefront
tests fail with `cdn.shopify.com/extensions/.../assets/*.js:
net::ERR_BLOCKED_BY_ORB` and `curl -I` shows `HTTP 404`, enable:

```bash
REAL_E2E_LOCAL_THEME_ASSET_FALLBACK=true
```

With that flag, Playwright serves the theme extension JS/CSS from
`REAL_E2E_THEME_ASSETS_DIR` while keeping the Shopify storefront, admin, app
proxy, and app backend real.

## Create Playwright Session

Generate `storageState` after logging into Shopify Admin manually:

```bash
npm run test:e2e:real:auth
```

The script opens Chromium headed at `SHOPIFY_ADMIN_URL`. Finish Shopify login in the browser, wait until the admin is visible, then press Enter in the terminal. The session is saved to:

```bash
playwright/.auth/shopify-admin.json
```

`playwright/.auth/` is ignored by git. Never commit this file.

If Shopify blocks login in Playwright-launched Chrome, use the CDP flow with a
Chrome window you launch manually:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.countpulse-real-e2e-chrome"
```

Then run:

```bash
npm run test:e2e:real:auth:cdp
```

Complete Shopify login in that Chrome window and press Enter when Shopify Admin
is visible.

## Run Tests

```bash
npm run test:e2e:real
npm run test:e2e:real:headed
npm run test:e2e:real:ui
npm run test:e2e:real:debug
```

The real suite uses `playwright.real.config.ts`, `tests/e2e-real`, no required web server, `workers: 1`, `fullyParallel: false`, trace on failure, screenshot on failure, video on failure, and an isolated HTML report.

View the report:

```bash
npm run test:e2e:real:report
```

Trace files are under `test-results/real-e2e`.

## Specs

- `00.real-prerequisites.spec.ts`: env, storageState, admin, app, storefront, app embed.
- `01.admin-campaign-crud.spec.ts`: create/edit/activate/pause/duplicate/delete prefixed campaign.
- `02.storefront-countdown-bar.spec.ts`: countdown top bar on storefront desktop and mobile.
- `03.product-page-blocks.spec.ts`: product timer/badge/low-stock block.
- `04.free-shipping-goal.spec.ts`: cart progress after add-to-cart.
- `05.delivery-cutoff.spec.ts`: delivery cutoff message.
- `06.cart-drawer.spec.ts`: cart drawer widget stability and duplicate guard.
- `07.targeting-localization-markets.spec.ts`: locale/market storefront signals.
- `08.unique-codes.spec.ts`: unique code assignment, visitor stability, copy.
- `09.experiments.spec.ts`: experiment creation.
- `10.analytics-reports.spec.ts`: impressions/clicks and CSV export.
- `11.templates-ai.spec.ts`: template draft flow and AI draft guard.
- `12.settings-billing.spec.ts`: safe settings persistence and billing visibility.
- `13.checkout-smoke.spec.ts`: checkout load only when explicitly allowed.
- `99.cleanup.spec.ts`: prefixed cleanup only when `REAL_E2E_CLEANUP=true`.

## Theme Editor Setup Required

Some specs skip if the store is not prepared:

- App embed not enabled: enable Promo Pulse app embed in the active theme.
- Product blocks missing: add the Promo Pulse product block to the product template.
- Cart drawer missing: configure a drawer trigger in the theme or set the app `customCartDrawerSelector` setting.
- Markets/locales missing: configure Shopify Markets/locales or localized URLs.
- Unique codes, analytics, reports, experiments, templates: use a plan/dev config that enables those features.

## Cleanup

To pause/delete resources created by the suite:

```bash
REAL_E2E_CLEANUP=true npm run test:e2e:real -- 99.cleanup.spec.ts
```

Cleanup only targets resources prefixed with `[PP-E2E]` or `PPE2E`. It does not touch merchant data without that prefix.

## Limitations

- Shopify login sessions expire; rerun `npm run test:e2e:real:auth` when storageState stops working.
- Theme editor setup is intentionally manual because editing merchant themes via tests is brittle.
- Checkout completion and real orders do not run by default.
- Analytics, Web Pixel, and app proxy events can be delayed.
- Storefront selectors vary by theme. Specs prefer roles/labels and use `data-testid` or stable Promo Pulse classes for widgets.
- Admin API setup depends on token scopes and Shopify API availability. Without a token, set `REAL_E2E_PRODUCT_HANDLE`.
