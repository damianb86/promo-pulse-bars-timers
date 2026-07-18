# Theme runtime source

Read `docs/architecture/storefront-rendering.md` and `docs/workflows/review-storefront-runtime.md` before editing.

- This directory is the editable source. Run `npm run theme:build`; never implement only in `extensions/promo-pulse-theme/assets/`.
- It is dependency-free browser JavaScript/CSS and cannot import `app/` TypeScript. Preserve semantic parity with server serialization, timer engine, React preview, and structure slots.
- Storefront failures must be non-blocking/no-render. Never expose secrets or PII in URLs, payloads, storage, or debug output.
- Avoid duplicate fetches, campaign nodes, observers, listeners, intervals, and layout thrashing. Clear timers/listeners when surfaces disappear; ignore internal cart-drawer mutations.
- Sanitize/select safely, respect dismissal/consent/reduced-motion behavior, and test mobile overflow and custom structure.
- Validate with `npm run theme:build`, relevant unit tests, focused storefront/preview/cart Playwright specs, and `npm run build`.
