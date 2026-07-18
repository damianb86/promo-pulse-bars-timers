# Storefront rendering

## Request and payload

The theme app embed and blocks call the app-proxy path `/apps/promo-pulse` (mapped to `/api/storefront/campaigns`) with shop, requested placements, page/product/cart context, locale/market/country/currency, device, visitor/session, and privacy signals. `app/services/storefront-campaigns-response.server.ts` verifies access, rate-limits, loads the snapshot/cache, applies gates, and delegates serialization to `app/utils/storefront-campaigns.ts`.

The compact response stores each campaign once and indexes campaign IDs by placement. The general endpoint excludes badge placements from its default front-placement token; `PRODUCT_PAGE_BADGE` and `COLLECTION_CARD` use the dedicated badge endpoint. Checkout, thank-you, and order-status use focused endpoints/view models rather than the theme payload.

## Browser runtime

- Liquid entry points: `extensions/promo-pulse-theme/blocks/promo-pulse-embed.liquid`, `product-timer.liquid`, `cart-timer.liquid`.
- Editable browser code: `theme-extension-src/promo-pulse-theme/`.
- Shared DOM builder/hydrator: `campaign-surface.js`; bootstrap/fetch coordination: `campaign-loader.js` and `promo-pulse.js`.
- Placement/type behavior: `product-timer.js`, `cart-timer.js`, `free-shipping.js`, `delivery-cutoff.js`, `low-stock.js`, `product-badge.js`, `discount-code.js`.
- Generated deployment assets: `extensions/promo-pulse-theme/assets/` via `npm run theme:build`.

Top/bottom bars and cart drawer are injected by the app embed. Product/cart page blocks supply their page context. Custom selectors use campaign/shop selectors. The runtime avoids duplicate campaign/placement renders, maintains anonymous visitor/session storage, ticks timers, responds to cart mutations, and emits analytics.

## Precedence and behavior

- Server eligibility is authoritative for status, schedule, plan, and available targeting context. Embedded targeting is also serialized where browser re-evaluation is needed.
- A campaign with multiple matching placements is serialized once with placement descriptors, then expanded into render targets in the browser.
- Experiment overrides may alter text/design/discount/placement for a stable visitor assignment. Markets overrides apply to the serialized base and can disable the campaign.
- Dismissal storage is keyed by campaign and design `dismissBehavior`; timer storage differs by fixed/evergreen/recurring and reset behavior. Check all placement-specific implementations before changing it.
- Missing API/data/selector should fail silently for buyers unless debug mode is enabled. Never block checkout or cart interaction.

## Performance and security

- Keep the critical CSS small; avoid repeated fetches, observers, listeners, timers, and layout reads. Cart drawer mutations are especially sensitive.
- Update cache keys/bypass logic when adding request context. Payloads support ETags and schedule-boundary invalidation.
- Custom HTML/CSS passes through server sanitization and structural slot guardrails. Do not inject merchant strings with unsafe HTML APIs.
- CORS/app-proxy verification and public shop settings are owned by storefront security/settings services; do not expose database records directly.

## Validation

Run relevant serialization/cache/unit tests, `npm run theme:build`, `npm run test:e2e -- <focused spec>`, `preview-storefront-parity.spec.ts` for shared rendering, `npm run typecheck`, and `npm run build`. Inspect mobile overflow and duplicate DOM/listeners for visual/runtime changes.

## Related documentation

[Data flow](data-flow.md), [design and structure](../domain/design-and-structure.md), [runtime review workflow](../workflows/review-storefront-runtime.md), existing [theme extension guide](../theme-extension.md).

## Maintenance

Source of truth: storefront response/serializer/cache services and editable theme sources. Update when endpoints, payload shape, render ownership, generated assets, cache variation, or failure behavior changes.
