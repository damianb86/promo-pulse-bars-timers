# Stage 2 Performance, Privacy, And Compliance Audit

Date: 2026-06-19

## Scope

Audited Stage 2 storefront and attribution surfaces:

- Theme App Extension runtime assets.
- Unique discount code assignment widget.
- A/B experiment assignment.
- Cart drawer observer and cart polling.
- Storefront campaign eligibility endpoint.
- Analytics and attribution ingestion.

## Performance Findings

- The global storefront embed caches campaign eligibility responses in memory for
  30 seconds and dedupes in-flight requests by URL.
- The storefront API uses short HTTP caching for non-cart, non-behavior
  eligibility responses: `public, max-age=45, stale-while-revalidate=30`.
- Behavior-targeted or cart subtotal dependent requests use `no-store`.
- Unique-code assignment now dedupes in-flight visitor/campaign requests and
  reuses the assignment response for 30 seconds to avoid duplicate POSTs when a
  widget rerenders.
- Cart drawer rendering is debounced and rate-limited. The drawer observer
  ignores Promo Pulse DOM updates and falls back cleanly if `/cart.js` or the
  app proxy returns storefront HTML.
- Paid-plan behavior is gated at runtime: unique-code network calls only happen
  when a rendered campaign contains `discount.uniqueCode`, and experiment
  assignment only happens for `RUNNING` experiments with assignable variants.
- Email countdown timers do not load storefront JavaScript; they are public
  image endpoints only.

## Privacy Findings

- Promo Pulse stores opaque anonymous IDs only:
  `promo_pulse_visitor_id`, `promo_pulse_session_id`, and last-touch campaign
  metadata. It does not store names, email, phone, address, IP address, or
  Shopify customer IDs in browser storage.
- Analytics events are blocked when merchant settings disable analytics, when
  Do Not Track is enabled and respected, or when consent mode is `STRICT` and
  Shopify customer privacy does not allow analytics processing.
- Behavior targeting receives no visitor/session IDs from the storefront helper
  when analytics privacy gates block tracking. The backend also refuses behavior
  profile building under the same privacy conditions.
- Unique codes may still use an anonymous functional visitor ID to avoid sharing
  a discount code between visitors. This is not used for behavioral analytics
  when analytics consent is missing.
- Unique-code values are no longer included in analytics event payloads. The
  code is sent only to the assignment endpoint for functional discount handling.
- Discount auto-apply redirects use the current pathname only. Query strings are
  not propagated into `/discount/CODE?redirect=...` links, so public URLs do not
  echo possible sensitive URL parameters.

## Compliance And UX Findings

- No Stage 2 runtime creates fake stock. Low-stock messaging depends on product
  inventory context or merchant-configured copy.
- No widget shows discount controls after its campaign timer or unique-code
  timer expires.
- Unique-code expiration is enforced in UI and best-effort synchronized back to
  the backend with `action: "expire"`.
- Campaign timers are still only as accurate as their configured campaign or
  synced Shopify discount dates. Merchants must not promise discount expiry
  unless the discount is synced or manually aligned.
- AI campaign generation is draft-only and must pass anti-fake-scarcity
  validation before merchant review.
- Checkout and post-purchase extensions render messages only and must fail
  closed if their APIs are unavailable; they must not block purchase completion.

## Attribution Limits

Attribution is approximate. Promo Pulse attributes conversions from anonymous
touches in the same browser/session window using configured attribution models
such as last touch 24h or 7d. It does not support deterministic cross-device
identity, and it should not be presented as customer-level attribution.

## Remaining Risks

- Theme Liquid still includes several legacy script tags for compatibility.
  The JS runtime gates premium network calls, but a deeper asset split should
  separate analytics, unique codes, experiments, cart drawer, free shipping, and
  delivery cutoff into independent lazy-loaded entrypoints.
- Shopify discount behavior for `/discount/CODE?redirect=...` can vary by
  checkout configuration and market. The UI must continue to show copy fallback.
- Browser storage may be unavailable or partitioned. Runtime falls back to
  in-memory IDs, which means assignments can reset on page reload.
- App proxy failures, password pages, or non-JSON storefront responses are
  handled defensively, but merchants still need correct Shopify app proxy
  configuration for reliable rendering.
- Public email timer URLs are bearer-style public tokens. Tokens must remain
  unguessable and must not encode shop secrets or customer data.

## Verification

Relevant automated coverage:

- Consent disabled blocks analytics events.
- Browser storage unavailable does not break rendering.
- Storefront campaign API failure fails closed without console errors.
- Expired unique-code pool renders expired text and no code value.
- Cart drawer avoids duplicate widgets under repeated mutations.
- E2E fixtures assert no console errors and no failed network requests.
