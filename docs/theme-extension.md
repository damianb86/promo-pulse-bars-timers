# Promo Pulse Theme App Extension

Promo Pulse: Bars & Timers ships a Theme App Extension with a global App Embed.
The embed loads lightweight storefront assets and renders eligible promotional
bars without requiring manual Liquid edits.

## Files

- `extensions/promo-pulse-theme/blocks/promo-pulse-embed.liquid`
- `extensions/promo-pulse-theme/blocks/product-timer.liquid`
- `extensions/promo-pulse-theme/blocks/product-badge.liquid`
- `extensions/promo-pulse-theme/blocks/cart-timer.liquid`
- `theme-extension-src/promo-pulse-theme/promo-pulse.js`
- `theme-extension-src/promo-pulse-theme/product-timer.js`
- `theme-extension-src/promo-pulse-theme/low-stock.js`
- `theme-extension-src/promo-pulse-theme/product-badge.js`
- `theme-extension-src/promo-pulse-theme/cart-timer.js`
- `theme-extension-src/promo-pulse-theme/free-shipping.js`
- `theme-extension-src/promo-pulse-theme/delivery-cutoff.js`
- `theme-extension-src/promo-pulse-theme/discount-code.js`
- `extensions/promo-pulse-theme/assets/promo-pulse.js`
- `extensions/promo-pulse-theme/assets/product-timer.js`
- `extensions/promo-pulse-theme/assets/low-stock.js`
- `extensions/promo-pulse-theme/assets/product-badge.js`
- `extensions/promo-pulse-theme/assets/cart-timer.js`
- `extensions/promo-pulse-theme/assets/free-shipping.js`
- `extensions/promo-pulse-theme/assets/delivery-cutoff.js`
- `extensions/promo-pulse-theme/assets/discount-code.js`
- `extensions/promo-pulse-theme/assets/promo-pulse.css`

Asset names, app proxy paths, and extension folders use the Promo Pulse naming
scheme so storefront configuration does not expose older project aliases.

`discount-code.js` is a shared storefront helper for coupon copy buttons. It
copies the code, dispatches `promo-pulse:copy-code`, and provides the
non-blocking analytics bridge used by the embed.

## App Embed Settings

The Theme Editor shows `Promo Pulse embed` with:

- `Enabled`: renders the embed root when active.
- `Debug mode`: shows a visible storefront diagnostic panel and logs API
  failures/fetch behavior to the browser console.
- `Default locale`: fallback storefront locale when Shopify does not expose one.

## Debug Mode

Turn on `Debug mode` in the App Embed or in an individual App Block when a
campaign does not appear on the storefront. In debug mode, Promo Pulse renders a
namespaced diagnostic wrapper before any API result is available.

The panel shows:

- the exact block name Shopify rendered;
- the expected placement;
- shop, locale, country, product, cart, and selection context when available;
- an example App Proxy API URL;
- the latest JavaScript status, such as API OK, zero eligible campaigns, missing
  product context, missing Campaign ID, missing drawer selector, or API error.

If the debug panel appears, the Theme App Extension block is mounted correctly.
If the status says `0 campanas elegibles`, check campaign status, schedule,
placement, campaign type, targeting, locale/country/product/cart context, and
plan gating. If the debug panel does not appear, the block or App Embed is not
enabled in the active theme/template.

If Network shows `302 Found` for `/apps/promo-pulse` and redirects
to `/password`, Shopify is not proxying that request to the app. Check that
`shopify.app.toml` has:

```toml
[app_proxy]
url = "https://shopify.dev/apps/promo-pulse"
subpath = "promo-pulse"
prefix = "apps"
```

Then restart `npm run dev` so Shopify CLI applies the generated tunnel URL to
the development store app configuration. The API response must be JSON, not the
storefront password HTML page.

For local debugging, open the `Promo Pulse embed` settings in Theme Editor and set
`App backend URL for development` to the current Shopify CLI tunnel base URL,
for example:

```text
https://encoding-exhibits-doctor-garcia.trycloudflare.com
```

Do not include `/apps/promo-pulse`; the storefront runtime appends
`/api/storefront/campaigns` automatically. Product/cart/badge blocks have the
same optional setting when you need to debug them without relying on the global
embed. Leave this setting blank in production so Shopify App Proxy remains the
public storefront path.

The cart drawer runtime uses a debounced `MutationObserver`. It intentionally
ignores Promo Pulse debug panel updates and existing Promo Pulse drawer slots so
debug text changes do not create repeated `/cart.js` or app proxy calls.

## Which Block To Use

Exact Theme Editor names:

- App Embed: `Promo Pulse embed`
- Product page app block: `Promo Pulse product timer`
- Cart page app block: `Promo Pulse cart timer`
- Product badge app block: `Promo Pulse badge`

Campaign placement mapping:

| Campaign type        | Placement                           | What to add in Theme Editor                                                         |
| -------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `COUNTDOWN_BAR`      | `TOP_BAR` or `BOTTOM_BAR`           | Enable `Promo Pulse embed`. No block is needed.                                     |
| `PRODUCT_TIMER`      | `PRODUCT_PAGE`                      | Add `Promo Pulse product timer` to a product template.                              |
| `CART_TIMER`         | `CART_PAGE`                         | Add `Promo Pulse cart timer` to the cart template.                                  |
| `CART_TIMER`         | `CART_DRAWER`                       | Enable `Promo Pulse embed`. No block is needed; JavaScript inserts into the drawer. |
| `FREE_SHIPPING_GOAL` | `TOP_BAR` or `BOTTOM_BAR`           | Enable `Promo Pulse embed`. No block is needed.                                     |
| `FREE_SHIPPING_GOAL` | `CART_PAGE`                         | Add `Promo Pulse cart timer` to the cart template.                                  |
| `FREE_SHIPPING_GOAL` | `CART_DRAWER`                       | Enable `Promo Pulse embed`. No block is needed.                                     |
| `FREE_SHIPPING_GOAL` | `PRODUCT_PAGE`                      | Add `Promo Pulse product timer` to a product template.                              |
| `DELIVERY_CUTOFF`    | `TOP_BAR` or `BOTTOM_BAR`           | Enable `Promo Pulse embed`. No block is needed.                                     |
| `DELIVERY_CUTOFF`    | `PRODUCT_PAGE`                      | Add `Promo Pulse product timer` to a product template.                              |
| `LOW_STOCK`          | `PRODUCT_PAGE`                      | Add `Promo Pulse product timer` to a product template.                              |
| `PRODUCT_BADGE`      | `PRODUCT_PAGE` or `COLLECTION_CARD` | Add `Promo Pulse badge` where the theme exposes product context.                    |

Yes: cart drawer rendering is intentionally automatic through the App Embed.
The merchant should not add a drawer block manually. The runtime tries default
selectors (`cart-drawer`, `#CartDrawer`, `.drawer__contents`,
`form[action="/cart"]`) and then the custom drawer selector saved in app
settings.

Yes: top and bottom countdown/announcement bars are also automatic through the
App Embed. The merchant only enables `Promo Pulse embed` and creates an active
campaign with `TOP_BAR` or `BOTTOM_BAR` placement.

## Activation In A Dev Store

1. Link the app to Shopify if it is not linked yet:

   ```bash
   npm run config:link
   ```

2. Run the app with Shopify CLI:

   ```bash
   npm run dev
   ```

3. Open the dev store Theme Editor.
4. Go to `App embeds`.
5. Enable `Promo Pulse embed`.
6. Save the theme.

The embed automatically injects the top and bottom bar containers when eligible campaigns are returned by the storefront campaigns API.
It also loads the cart timer asset so eligible `CART_DRAWER` campaigns can be inserted into cart drawers without theme code edits.
It loads a dedicated free shipping asset for `FREE_SHIPPING_GOAL` top and
bottom bars because those placements need live cart subtotal progress.
It also loads a dedicated delivery cutoff asset for localized delivery promise
messages in global bars and product page blocks.

## Storefront API

The embed calls the storefront App Proxy path:

```text
/apps/promo-pulse
```

Shopify forwards that request to the Promo Pulse app endpoint configured in
`shopify.app.toml`:

```text
/api/storefront/campaigns
```

with context such as `shop`, `path`, `locale`, `country`, `device`, `utmSource`, `productId`, `cartSubtotal`, `currency`, and `placement`.

The app proxy target URL is a placeholder until the app is linked/deployed. `shopify app config link`, `shopify app dev`, and production deployment should update it to the current app URL. If the API is unreachable, the JavaScript fails silently unless `Debug mode` is enabled.

## Rendered Placements

The App Embed currently requests:

- `TOP_BAR`
- `BOTTOM_BAR`
- `CART_DRAWER` through `cart-timer.js`
- `FREE_SHIPPING_GOAL` top and bottom bars through `free-shipping.js`
- `DELIVERY_CUTOFF` top and bottom bars through `delivery-cutoff.js`

It supports:

- global announcement/countdown bars;
- fixed-date countdowns using campaign `endsAt`;
- evergreen session timers using `sessionStorage`;
- recurring daily and weekly countdown calculations with timezone-aware cutoffs;
- delivery cutoff promise windows with working days and holidays;
- free shipping progress when cart subtotal is available from Liquid,
  `window.PromoPulseCartSubtotal`, or `/cart.js`.

The admin app uses the shared TypeScript timer engine in `app/lib/timer.ts`.
The storefront extension cannot import that module directly because Shopify
serves static theme assets, so `theme-extension-src/promo-pulse-theme/promo-pulse.js`
contains a minimal duplicated timer implementation and generates the minified
`assets/promo-pulse.js` file.

The editable JavaScript sources intentionally live outside
`extensions/promo-pulse-theme`. Shopify Theme App Extensions only allow
`assets`, `blocks`, `snippets`, and `locales` directories inside the extension.
Regenerate the static assets with:

```bash
npm run theme:build
```

## Product Page Block

The extension also provides `Promo Pulse product timer`, an app block for
product templates. It requests:

```text
/apps/promo-pulse?placement=PRODUCT_PAGE
```

and passes product context:

- `productId` as a Shopify Product GID.
- `productTags` as a comma-separated list.
- selected variant inventory from Liquid when Shopify exposes it.
- a per-variant inventory JSON map when Shopify exposes inventory.
- storefront locale and country when Shopify exposes them.

The block supports two selection modes:

- `Auto eligible`: renders the first active eligible `PRODUCT_PAGE` campaign.
- `Specific campaign`: renders only the configured `campaignId` if it is active,
  eligible, and has a product page placement.

Supported product block content:

- countdown timer;
- optional free shipping progress for `FREE_SHIPPING_GOAL` campaigns targeted
  to `PRODUCT_PAGE`;
- delivery cutoff before/after copy for `DELIVERY_CUTOFF` campaigns;
- low stock text for `LOW_STOCK` campaigns through the dedicated
  `low-stock.js` runtime;
- CTA, discount code, icon, compact mode, and CampaignDesign colors.

Low stock never creates fake inventory numbers. If Liquid does not expose
inventory, the runtime uses the configured fallback message. If that fallback is
blank, the block renders nothing.

## Add Product Block In Theme Editor

1. Open Shopify Admin and go to `Online Store > Themes`.
2. Open the Theme Editor.
3. Choose a product template.
4. Add an app block.
5. Select `Promo Pulse product timer`.
6. Choose `Auto eligible` or `Specific campaign`.
7. Save the theme.

No manual Liquid edits are required.

## Product Badge Block

The extension provides `Promo Pulse badge`, an app block for product and
collection templates. It requests:

```text
/apps/promo-pulse?placement=COLLECTION_CARD
```

by default, and can be switched to `PRODUCT_PAGE` in the block settings. The
block supports:

- `Auto eligible` or `Specific campaign` selection.
- `badgeText` from BadgeSettings, then localized campaign text fallback.
- `badgeShape`: `PILL`, `ROUNDED`, or `SQUARE`.
- `badgePosition`: `TOP_LEFT`, `TOP_RIGHT`, `BOTTOM_LEFT`, or `BOTTOM_RIGHT`.

Promo Pulse does not automatically rewrite every collection grid in Etapa 1.
Merchants should add the app block where the theme safely supports app blocks,
usually near a product image/card area or on the product template.

## Cart Page Block

The extension provides `Promo Pulse cart timer`, an app block for cart
templates. It requests:

```text
/apps/promo-pulse?placement=CART_PAGE
```

and passes cart context:

- cart subtotal from Liquid `cart.total_price`;
- cart currency from Liquid when available;
- cart token when Shopify exposes it.

The block supports:

- `CART_TIMER` countdowns, including cart-reserved timers driven by
  `TimerSettings.durationMinutes`;
- `FREE_SHIPPING_GOAL` progress using `cartSubtotal`;
- discount code, CTA, icon, compact mode, and CampaignDesign colors.

## Add Cart Block In Theme Editor

1. Open Shopify Admin and go to `Online Store > Themes`.
2. Open the Theme Editor.
3. Choose the cart template.
4. Add an app block.
5. Select `Promo Pulse cart timer`.
6. Choose `Auto eligible` or `Specific campaign`.
7. Save the theme.

For Dawn, add the block inside the cart items or cart footer section depending
on where the timer should appear.

## Cart Drawer Support

The global App Embed loads `cart-timer.js`, which observes theme changes with a
`MutationObserver` and requests:

```text
/apps/promo-pulse?placement=CART_DRAWER
```

Default drawer selectors are tried in this order:

- `cart-drawer`
- `#CartDrawer`
- `.drawer__contents`
- `form[action="/cart"]`

If a `CART_DRAWER` campaign placement has `customSelector`, that selector is
tried before the defaults. Use this for themes with non-standard drawer markup.
The runtime inserts a single `#promo-pulse-cart-drawer-slot` and reuses it, so
opening and closing the drawer repeatedly should not create duplicates.

If no drawer selector matches, Promo Pulse does nothing and the theme continues
normally.

## Free Shipping Threshold Rules

Free shipping settings support optional JSON rules for country and market
thresholds. The storefront API resolves the threshold before returning the
campaign.

Example:

```json
{
  "countries": { "US": 75, "CA": 100 },
  "markets": { "EU": 80 }
}
```

Market rules take priority over country rules. If no rule matches, Promo Pulse
uses the base threshold amount.

## Delivery Cutoff Edge Cases

Delivery cutoff settings support:

- `workingDays` as ISO weekdays, where Monday is `1` and Sunday is `7`;
- `holidays` as `YYYY-MM-DD` local dates;
- `countryRules` with optional overrides for cutoff, processing days, delivery
  range, working days, holidays, and after-cutoff behavior;
- `afterCutoffBehavior`: `SHOW_NEXT_WINDOW`, `SHOW_AFTER_CUTOFF_MESSAGE`, or
  `HIDE`.

For Dawn validation, create a `DELIVERY_CUTOFF` campaign with `PRODUCT_PAGE` and
`TOP_BAR` placements. Set `workingDays` to `[1,2,3,4,5]`, use a Friday date
after the cutoff, and verify the next ship date moves to Monday. Add a holiday
such as `["2026-06-22"]` and verify the ship date skips to Tuesday.

## Analytics

The embed and shared coupon helper dispatch browser events and post them to the
app without blocking storefront UX:

```text
promo-pulse:impression
promo-pulse:click
promo-pulse:copy-code
```

`discount-code.js` listens for those events and sends `POST
/apps/promo-pulse` through the same Shopify App Proxy used for
campaign fetching. The app proxy route forwards analytics payloads to the same
backend logic as `/api/analytics/event`, with `shop`, `campaignId`, `eventType`,
`placementType`, `sessionId`, cart context, locale, country, path, and user
agent when available. Failed analytics requests are intentionally ignored on the
storefront.

`IMPRESSION` events are deduped server-side by campaign, session, and placement
for a short window. `ORDER_ATTRIBUTED` is accepted by the backend when a reliable
order association exists, but full Web Pixel attribution is still a later
integration step.
