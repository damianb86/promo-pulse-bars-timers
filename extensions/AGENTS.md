# Shopify extensions

Read `docs/architecture/shopify-integration.md` plus the extension's feature guide before editing.

- Each extension is a separately deployed Shopify runtime. Respect its manifest API version, target capabilities, available data, and network-access policy.
- Theme assets are generated from `theme-extension-src/`; edit Liquid/manifests here but edit JavaScript/CSS source there.
- Checkout and account UI extensions must never block checkout and must not send PII. They render nothing when auth, plan, endpoint, or eligibility fails.
- Web Pixel runs in a strict privacy sandbox; update its mapper, ingestion validation, dedupe, and tests together.
- Discount Function input GraphQL, metafield config, JavaScript logic, output targets, and service-side rule serialization form one contract.
- Run extension-specific tests/build plus related backend endpoint tests and mocked E2E. Real Shopify validation remains opt-in under root safeguards.
