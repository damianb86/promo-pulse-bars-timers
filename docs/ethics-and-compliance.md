# Promo Pulse Ethics, Accessibility, And Pre-Publication Checklist

Promo Pulse is built to help merchants run clear promotional campaigns without
dark patterns. Stage 1 must favor accurate urgency, lightweight storefront code,
and graceful failure over aggressive conversion tactics.

## Ethical UX rules

- Do not show exact stock unless Shopify exposes a real inventory quantity for the current product or variant.
- If inventory is unavailable, show a generic low-stock fallback only when the merchant configured one, or render nothing.
- Do not create fake timers by default. Fixed timers require real campaign dates, and evergreen timers require an explicit duration.
- Evergreen timers are session or browser-storage based. They represent a visitor-specific promotion window, not a storewide sale deadline.
- If a campaign has expired, hide it unless an `expiredText` message is configured.
- Coupon buttons and CTA links should not be shown after the timer is expired.
- Never change cart contents, checkout behavior, payment flow, or add-to-cart behavior in Stage 1.
- Discount expiry is only reliable when campaign dates are synced from Shopify discounts or the merchant keeps campaign dates aligned manually.
- Unique codes must expire in the backend or stop rendering in the storefront
  when their code-level timer reaches zero.
- A/B tests and behavior targeting must respect analytics consent, Do Not Track,
  and merchant analytics settings.
- AI-generated copy must stay draft-only until merchant confirmation and must
  not invent stock, discount availability, delivery promises, or scarcity
  claims.
- Checkout and order-status extensions must render promotional messages only;
  they must never block payment or checkout completion.

## Accessibility requirements

- Countdown output uses `aria-live="polite"` and an explicit time remaining label.
- CTA links and coupon/close buttons must be keyboard focusable and show visible focus styles.
- Close buttons must have an accessible label.
- Progress bars must include `role="progressbar"` and value attributes, so free-shipping progress is not conveyed by color alone.
- Templates should maintain at least WCAG AA-style 4.5:1 contrast for body text and button text.
- Animations and progress transitions must respect `prefers-reduced-motion`.

## Performance requirements

- Theme assets must be loaded with `defer` where Liquid controls the script tag.
- Storefront code must fail silently outside debug mode if the API is unavailable.
- API calls should be deduped per placement and cached briefly in memory where safe.
- Unique-code assignment calls should be deduped per anonymous visitor/campaign
  to avoid multiple POSTs for the same widget render.
- Cart drawer observers must be debounced and must not assume a drawer exists.
- CSS must remain namespaced with `.pp-` classes and avoid global resets.
- Z-index values should be high enough for bars, but not maximum browser values.

## Pre-publication checklist

- Run `npm run format:check`.
- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm run test`.
- Run `npm run build`.
- Run `npx shopify app build --no-color`.
- Test the app embed in Dawn with top and bottom bar campaigns.
- Test product timer, product badge, and cart timer blocks without editing theme code.
- Test a theme without a cart drawer and confirm no console errors.
- Test keyboard navigation for CTA, coupon copy, and close controls.
- Test mobile viewport spacing and safe-area padding.
- Test `prefers-reduced-motion` in browser devtools.
- Confirm no campaign displays exact stock unless real inventory data is present.
- Confirm evergreen timer copy is acceptable for the merchant's promotion.
- Confirm discount dates are synced or manually aligned with campaign dates.
