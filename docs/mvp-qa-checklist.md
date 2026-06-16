# Promo Pulse: Bars & Timers - MVP QA Checklist

Use this checklist against a Shopify development store before considering the
Stage 1 MVP ready for broader merchant testing.

## 1. Install App

- Run `npm install`.
- Copy `.env.example` to `.env`.
- Link the app with `npm run config:link`.
- Confirm `shopify.app.toml` shows `Promo Pulse: Bars & Timers`.
- Run `npm run dev`.
- Confirm Shopify CLI updates the linked app home away from
  `https://shopify.dev/apps/default-app-home`.
- Run `npm run config:check`; it must pass before testing the embedded admin.
- Install the app on a dev store through Shopify CLI.
- Confirm the embedded admin opens without auth loops.
- If Shopify Admin shows `Find this app in the pages where you work`, the app
  is still using the placeholder app home URL. Re-run `npm run config:link` and
  `npm run dev`, then reinstall/open the app from the CLI URL.

## 2. Run Migrations

- Confirm `DATABASE_URL` points to a local SQLite file or intended test DB.
- Run `npm run prisma -- generate`.
- Run `npm run db:migrate`.
- Optional: run `npm run db:seed` for demo campaigns.
- Open the app dashboard and confirm no migration error banner appears.

## 3. Create Campaign

- Open `Campaigns`.
- Click `Create campaign`.
- Create a Flash Sale Countdown Bar as a draft.
- Confirm the campaign appears in the campaign list.
- Open the campaign editor and confirm details, placement, and translation were
  persisted.

## 4. Activate App Embed

- Open Shopify Admin > Online Store > Themes > Customize.
- Open `App embeds`.
- Enable `Promo Pulse embed`.
- Save the theme.
- Confirm no JavaScript errors appear on storefront page load.

## 5. Add Product Block

- In Theme Editor, open a product template.
- Add the `Promo Pulse product timer` app block.
- Save the theme.
- Open a product page and confirm the block renders only when an eligible
  `PRODUCT_PAGE` campaign exists.

## 6. Add Cart Block

- In Theme Editor, open the cart template.
- Add the `Promo Pulse cart timer` app block.
- Save the theme.
- Open `/cart` and confirm no render occurs when there is no eligible campaign.

## 7. Test Top Bar

- Activate a `COUNTDOWN_BAR` campaign with `TOP_BAR` placement.
- Visit the storefront.
- Confirm the bar appears, countdown updates, CTA is focusable, and close button
  is accessible.
- Confirm the campaign disappears or shows expired copy when expired.

## 8. Test Product Timer

- Activate a `PRODUCT_TIMER` campaign with `PRODUCT_PAGE` placement.
- Visit a targeted product page.
- Confirm timer, text, design colors, CTA, and discount code render correctly.
- Change locale/country targeting and confirm non-matching contexts do not
  render the campaign.

## 9. Test Cart Timer

- Activate a `CART_TIMER` campaign for `CART_PAGE`.
- Visit `/cart` and confirm the timer renders.
- Activate or retarget for `CART_DRAWER`.
- Open/close the drawer multiple times and confirm no duplicate insertion.
- If no drawer appears, set `customCartDrawerSelector` in Settings and retest.

## 10. Test Free Shipping Goal

- Create a `FREE_SHIPPING_GOAL` campaign with a threshold.
- Test empty cart, subtotal below threshold, exact threshold, and above
  threshold.
- Confirm progress percentage, amount remaining, success message, and currency
  formatting.
- Confirm cart drawer updates after cart changes when `/cart.js` is available.

## 11. Test Delivery Cutoff

- Create a `DELIVERY_CUTOFF` campaign with timezone, working days, and cutoff.
- Test before cutoff and after cutoff.
- Test Friday after cutoff with Monday-Friday working days.
- Add a holiday and confirm the promise skips it.
- Test English and Spanish storefront locales.

## 12. Test Analytics

- Render a campaign and confirm an `IMPRESSION` event is stored.
- Click CTA and confirm a `CLICK` event is stored.
- Copy coupon and confirm `COPY_CODE` is stored.
- Open `/app/analytics` and test 7-day and 30-day ranges.
- Confirm storefront UX still works if analytics endpoint fails.

## 13. Test Multi-Language

- Add Spanish copy to a campaign.
- Visit storefront with Spanish locale and confirm Spanish text appears.
- Remove Spanish copy and confirm fallback to English.
- Remove English copy in a test campaign and confirm fallback to the first
  available translation.

## 14. Final Validation Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npx shopify app build --no-color
```

All commands should pass before a release candidate is tagged.
