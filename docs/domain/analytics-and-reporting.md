# Analytics, attribution, and reporting

## Event pipeline

Theme assets emit impressions/interactions through the storefront campaigns action or `/api/analytics/event`. The Web Pixel maps Shopify customer events through `app/lib/web-pixel-events.ts` to `/api/analytics/pixel`. Checkout/post-purchase extensions emit their supported events. `app/models/analytics.server.ts` validates and normalizes, enforces shop/campaign identity and privacy gates, deduplicates, persists `AnalyticsEvent`, and may create attribution records.

Batch ingestion is intentionally sequential: database-backed deduplication must see earlier events in the same batch. Impressions use a 10-minute dedupe window; commerce interactions use a 5-second window with event-specific identity fields. Do not parallelize without replacing the consistency mechanism.

## Privacy and trust

- Shop settings control analytics, do-not-track respect, and consent mode. Behavior profiles use the same privacy posture.
- Public payloads use anonymous session/visitor/cart identifiers where needed; never add email, name, address, customer ID, or tokens.
- Revenue/order attribution is stored only when supported evidence exists. Post-purchase impressions/clicks alone do not establish a conversion.
- `orders/create` reconciles order/discount evidence and must be idempotent.

## Consumers

- Basic analytics: `app/routes/app.analytics.tsx` and `app/models/analytics.server.ts` summaries.
- Advanced reports/CSV: `app/services/reports/`, `app/routes/app.reports.tsx`, `app.reports.csv.ts`.
- Experiments: attribution touches/conversions grouped by variant.
- Recommendations: performance inputs from analytics, attribution, Markets, and codes.
- Behavior targeting: recent eligible anonymous event history.

The canonical event identifiers are the Prisma `AnalyticsEventType` enum, generated into [domain identifiers](../generated/domain-identifiers.md). Producers do not support every event; see their mapping/tests before adding one.

## Adding an event

Update the enum/migration, validation/normalization and dedupe category, every intended producer, Web Pixel mapping if Shopify-originated, reports/attribution/behavior consumers, fixtures, unit/E2E tests, generated docs, and the [event workflow](../workflows/add-analytics-event.md). Decide explicitly whether it counts as an impression, click, commerce step, or conversion.

## Failure modes and validation

Wrong shop/campaign association, unbounded strings, duplicate browser listeners, missing consent, parallel batch writes, and double-counted Web Pixel/theme signals are high risk. Run analytics model/pixel/attribution/report/behavior tests plus analytics, reports, experiments, and relevant producer E2E specs.

## Related documentation

[Data flow](../architecture/data-flow.md), [optimization](optimization.md), existing [analytics](../analytics.md) and [advanced reporting](../advanced-reporting.md) guides.

## Maintenance

Source of truth: Prisma event enum/models, analytics model/routes, Web Pixel mapper/extension, attribution and report services. Update for event, privacy, dedupe, attribution, or reporting semantics.
