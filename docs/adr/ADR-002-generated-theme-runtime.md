# ADR-002: Generate deployable theme assets from editable source

## Status

Accepted current architecture. This ADR records the implemented constraint rather than claiming original historical intent.

## Context

Shopify Theme App Extensions accept constrained extension directories and serve static browser assets. The storefront runtime cannot import the server's TypeScript modules, while maintainable source needs readable JavaScript/CSS and deterministic minification.

## Decision

Editable theme runtime source lives in `theme-extension-src/promo-pulse-theme/`. `scripts/build-theme-assets.mjs` minifies JavaScript and copies CSS into `extensions/promo-pulse-theme/assets/`. Generated assets are not hand-edited.

## Consequences

- Timer, render, and view-model semantics are duplicated across TypeScript/React and browser source and require parity tests.
- Every theme source change must run `npm run theme:build` and include expected generated output.
- Extension Liquid references deployable generated filenames; adding an asset updates the build list and Liquid/load path.

## Related code

`scripts/build-theme-assets.mjs`, `theme-extension-src/promo-pulse-theme/`, `extensions/promo-pulse-theme/`.

## Related documentation

[Storefront rendering](../architecture/storefront-rendering.md), [runtime review workflow](../workflows/review-storefront-runtime.md).
