# Campaign data flow

```mermaid
sequenceDiagram
  participant M as Merchant admin
  participant R as Campaign route/action
  participant P as Models/services
  participant D as PostgreSQL
  participant A as Storefront API
  participant T as Theme/Shopify extension
  participant N as Analytics

  M->>R: Submit campaign form
  R->>R: Parse and validate all sections
  R->>P: Save shop-scoped draft relations
  P->>D: Transactional writes
  M->>R: Publish/activate
  R->>P: Validate activation and publish
  P->>D: Store publishedSnapshot + publishedAt
  T->>A: Request shop + placement + context
  A->>D: Load cached published snapshot set
  A->>A: Status/date/plan/targeting evaluation
  A->>A: Experiment and Markets overrides
  A-->>T: Compact public payload + ETag
  T->>T: Render, tick, dismiss, react to cart
  T->>N: Impression/interaction batch
  N->>D: Privacy gate, validate, dedupe, attribute
```

## Evaluation stages

1. Publication: relational state is copied into `publishedSnapshot`. Storefront hydration uses this copy while retaining database identity fields needed by the query.
2. Base activity: `ACTIVE`, schedule, timer expiration behavior, and optional placement filtering are checked in `app/models/campaign.server.ts`.
3. Request context: `parseStorefrontCampaignContext()` reads placement(s), product/collection/tags, country/market/locale, URL/UTM/device, cart, visitor/session, consent, and shop.
4. Access and limits: storefront access, rate limit, monthly impression gate, and plan capability filter run before serialization.
5. Targeting: explicit product/collection/URL exclusions fail first; every configured inclusion dimension must match. Behavior targeting uses a privacy-gated derived profile.
6. Serialization: translation, design, timer, offer, type-specific settings, and placement descriptors become a public view model.
7. Overrides: active experiment assignment and the most specific Markets rule can modify the serialized campaign. Disabled Market rules remove it for that context.
8. Rendering and events: theme/UI extensions render; analytics ingestion validates shop access and privacy, deduplicates sequentially, then records attribution where applicable.

## Cache implications

Published snapshot version, context, active experiment visitor scope, behavior targeting, and upcoming start/end boundaries influence cache eligibility or keys. Adding a context-dependent rule without updating `app/services/storefront-cache.server.ts` can serve the wrong campaign.

## Related documentation

[Storefront rendering](storefront-rendering.md), [placements and targeting](../domain/placements-and-targeting.md), [analytics](../domain/analytics-and-reporting.md).

## Maintenance

Source of truth: `campaign.server.ts`, `storefront-campaigns-response.server.ts`, `storefront-campaigns.ts`, experiment and Markets services. Update when stage order or cache variance changes.
