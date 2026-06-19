# Promo Pulse: Bars & Timers - Stage 2 QA Checklist

Use this checklist against a Shopify development store before tagging a Stage 2
release candidate. Automated E2E tests are required, but they do not replace
real Shopify QA for discounts, webhooks, extensions, and app proxy behavior.

## 1. Release Setup

- Pull the release branch and run `npm install`.
- Copy `.env.example` to `.env` and configure Shopify app credentials.
- Confirm `SCOPES` includes:
  `read_products,read_orders,read_discounts,write_discounts,write_pixels,read_customer_events`.
- Run `npm run prisma -- generate`.
- Run `npm run db:migrate`.
- Run `npm run db:seed` if demo data is useful for the QA pass.
- Link the Shopify app with `npm run config:link`.
- Run `npm run config:check`.
- Run `npm run dev` and confirm the CLI shows a generated HTTPS app URL.
- Install or reinstall the app in the development store after any scope change.
- Enable the Theme App Extension app embed in the theme editor.
- Deploy or preview the checkout, thank-you, order-status, web pixel, and
  discount function extensions for the dev app.

## 2. Automated Gates

Run all release commands before manual QA:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

Optional Shopify CLI validation:

```bash
npx shopify app build --no-color
```

## 3. Unique Codes

- Set the dev shop to a Premium or Agency plan. In local development the
  effective default is `AGENCY`; use `PROMO_PULSE_DEV_PLAN=PREMIUM` only when
  you need to QA Premium without Agency features.
- Create an active campaign with unique codes enabled.
- Create a pool with a short, recognizable prefix and a real discount value.
- Generate codes through the admin UI.
- Open the storefront in a clean browser profile and confirm visitor A receives
  code A.
- Reload the page and confirm visitor A still sees code A while it is valid.
- Open another clean profile or reset browser storage and confirm visitor B
  receives code B.
- Click `Copy code` and confirm a `COPY_CODE` event appears in analytics.
- Click `Apply discount` and confirm Shopify receives a `/discount/CODE`
  redirect.
- Shorten the code expiration window or use a test mutation locally and confirm
  expired codes stop rendering as active offers.
- Place an order using a code and confirm the order webhook marks the code as
  used without double-counting repeat webhooks.

## 4. A/B Testing

- Create an active campaign.
- Add an A/B experiment with two variants and positive weights.
- Add text, design, discount, or placement overrides to variant B.
- Start the experiment.
- Visit storefront as visitor A and record the assigned variant.
- Reload and revisit; visitor A must keep the same variant.
- Visit as visitor B and confirm assignment follows configured weights over a
  broader sample.
- Confirm the storefront renders the selected variant override.
- Confirm analytics events include `experimentId` and `variantId`.
- Pause the experiment and confirm the base campaign renders without experiment
  overrides.

## 5. Auto-Winner

- Seed or generate enough impressions and clicks/orders for two variants.
- Open the campaign editor and inspect `Experiment Results`.
- Confirm impressions, clicks, CTR, orders, revenue, RPV, and conversion rate
  are correct by variant.
- Try auto-winner before minimum sample/runtime is met and confirm no winner is
  declared.
- Meet the configured thresholds and click `Auto declare winner`.
- Confirm the winning variant is marked as winner.
- Click `Apply winner`.
- Confirm the base campaign fields now contain the winning overrides.
- Confirm the experiment is completed or no longer serving losing variants.

## 6. Email Timers

- Create an active campaign with a real end time.
- Create an email timer in the campaign editor.
- Copy the PNG URL.
- Open the URL in a private browser and confirm HTTP 200 and image content.
- Refresh after at least a few seconds and confirm the countdown changes.
- Use the URL in a generic email snippet and confirm no JavaScript is required.
- Expire the timer and confirm the configured expired fallback image renders.
- Confirm the public URL does not expose shop secrets, customer data, or private
  discount details.

## 7. Checkout Extension

- Confirm checkout extension deployment is available in the dev store.
- Add the Promo Pulse checkout block in the checkout editor.
- Test `AUTO_ELIGIBLE` mode with an eligible checkout-safe campaign.
- Test `SPECIFIC_CAMPAIGN` mode with an explicit campaign ID.
- Toggle compact mode and timer visibility.
- Simulate API failure or disable the campaign and confirm checkout still loads
  and payment is not blocked.
- Confirm no misleading discount, stock, or delivery claim appears.
- Confirm Pro, Premium, and Agency shops can use the block and lower plans are
  gated in the admin/API.

## 8. Market Overrides

- Create a global free shipping or countdown campaign.
- Add a US market override with USD threshold and English text.
- Add an ES market override with EUR threshold and Spanish text.
- Visit storefront with US market/country/currency context and confirm US copy
  and threshold.
- Visit storefront with ES market/country/currency context and confirm ES copy
  and threshold.
- Visit with an unsupported market and confirm fallback to global settings.
- Confirm global campaigns still render when no market rule exists.

## 9. Advanced Reports

- Generate or seed events for multiple campaigns, countries, locales, markets,
  placements, and experiment variants.
- Open `/app/reports`.
- Verify summary metrics: impressions, clicks, CTR, add-to-cart rate, checkout
  started rate, orders, revenue, RPV, conversion rate, AOV, unique code usage,
  and email timer views.
- Filter by date range.
- Filter by campaign, placement, country, locale, market, and device.
- Confirm experiment variant performance matches seeded or observed events.
- Export CSV and confirm the file contains only the filtered rows.
- Confirm reports remain responsive with demo-size data.

## 10. AI Builder

- Set the shop to Premium or Agency.
- Open `Create campaign` and fill objective, product/category, event,
  country/language, brand tone, real offer, and target URL.
- Generate with AI.
- Confirm the suggestion appears as a preview and does not modify the campaign
  form automatically.
- Confirm copy does not invent stock, unavailable discounts, delivery promises,
  or fake scarcity.
- Apply the suggestion.
- Save the campaign and confirm it remains a draft.
- Confirm suggested A/B variants are draft-only until the merchant starts an
  experiment.
- Test missing API key/dev mode and confirm mock output works for QA.

## 11. Agency Dashboard

- Set the shop to Agency or seed the E2E agency scenario.
- Open `/app/agency`.
- Confirm only shops granted through `AgencyShopAccess` appear.
- Confirm active campaigns, attributed revenue, and recommendations are grouped
  by shop.
- Switch shop context from the dashboard.
- Copy a campaign from one connected shop to another.
- Confirm the copied campaign is a draft and does not publish automatically.
- Try to access a shop without agency access and confirm server-side
  authorization blocks it.

## 12. Final Sign-Off

- Capture screenshots listed in `docs/app-store-listing-draft.md`.
- Record Shopify app URL, extension versions, test store name, and test date.
- Document any theme-specific or checkout-editor limitation found in QA.
- Confirm no console errors or failed storefront requests appear during the
  critical flows.
- Confirm no feature creates fake stock, fake discount state, or misleading
  timer urgency by default.
