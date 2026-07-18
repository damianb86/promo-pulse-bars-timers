# Workflow: add an analytics event

## Prerequisites

Read [analytics and reporting](../domain/analytics-and-reporting.md), [data flow](../architecture/data-flow.md), and privacy rules in `app/services/privacy.server.ts`/shop settings.

## Steps

1. Define the event's evidence and semantics: producer, trigger, dedupe identity/window, placement/campaign requirement, privacy gate, and whether it affects attribution, experiments, behavior, or reports.
2. Add the Prisma `AnalyticsEventType` value and migration; regenerate Prisma and docs.
3. Update `validateAnalyticsEventPayload`, event normalization, dedupe classification/filters, and attribution hooks in `app/models/analytics.server.ts`.
4. Add intended producers only: shared theme tracker/placement asset, checkout/post-purchase extension, webhook, or `app/lib/web-pixel-events.ts` plus Web Pixel source. Prevent two producers from double-counting the same action.
5. Update report summaries/CSV, experiment metrics, recommendations, and behavior profiles only when the event contributes to them.
6. Add validation/dedupe/privacy unit tests and producer-to-report E2E coverage.

## Completion checklist

- [ ] No PII or secret is accepted/stored/emitted.
- [ ] Invalid shop/campaign/placement is rejected or ignored consistently.
- [ ] Batches remain sequential or use an equally safe atomic dedupe mechanism.
- [ ] Consent/do-not-track and analytics-disabled behavior is tested.
- [ ] Migration, generated reference, docs check, unit/E2E, typecheck/build pass.

## Maintenance

Update when event registration, privacy, dedupe, or consumer wiring changes.
