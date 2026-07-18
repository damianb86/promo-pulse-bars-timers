# Documentation index

Use this file after the root `AGENTS.md`. Select the narrowest matching task, read the listed documents, then inspect the entry points. Existing release/feature notes remain useful background but are not sources of truth when they conflict with code.

## Task router

| Task                                                                                              | Read first                                                                                                                                             | Inspect first                                                                                                                                        | Related risk                                                     | Minimum validation                                                   |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Add or modify a campaign type                                                                     | [Campaigns](domain/campaigns.md), [capability matrix](campaign-types/capability-matrix.md), [workflow](workflows/change-campaign-capability.md)        | `prisma/schema.prisma`, `app/types/campaign-options.ts`, `app/components/campaign-form/constants.tsx`, campaign routes/model, storefront serializers | placements, plan gates, editor/preview/runtime parity, templates | `docs:check`, unit tests, `campaign-types-storefront.spec.ts`, build |
| Add a placement                                                                                   | [Placements](domain/placements-and-targeting.md), [storefront rendering](architecture/storefront-rendering.md), [workflow](workflows/add-placement.md) | Prisma `PlacementType`, campaign options/form parsing, `app/utils/storefront-campaigns.ts`, theme/extension target                                   | selectors, payload dedupe, preview, extension availability       | unit tests, `placement`/campaign-type E2E, theme build               |
| Change scheduling or countdown expiration                                                         | [Lifecycle and timers](domain/lifecycle-and-timers.md), [storefront rendering](architecture/storefront-rendering.md)                                   | `app/lib/timer.ts`, `app/models/campaign.server.ts`, serializers, every theme timer implementation                                                   | timezone/DST, persisted visitor timers, server/client boundary   | timer/campaign tests, storefront countdown E2E, theme build          |
| Change targeting or precedence                                                                    | [Placements and targeting](domain/placements-and-targeting.md), [data flow](architecture/data-flow.md)                                                 | `app/utils/storefront-campaigns.ts`, behavior targeting, Markets overrides                                                                           | exclusions, missing context, cache variation, privacy            | targeting/behavior/Markets unit and E2E tests                        |
| Change localization or Markets                                                                    | [Localization](domain/localization-and-messages.md), [optimization](domain/optimization.md)                                                            | localization utility/form service, `app/services/markets/`, storefront context                                                                       | locale fallback, rule specificity, cache keys                    | localization/Markets tests and storefront E2E                        |
| Change editor, preview, design, layout, preset, or safe structure                                 | [Admin application](architecture/admin-application.md), [design](domain/design-and-structure.md)                                                       | campaign routes/components, design/form services, structure utilities, system templates                                                              | preview/storefront/mobile parity, sanitization                   | design/structure unit tests, preview parity E2E, theme build         |
| Change storefront rendering or performance-sensitive code                                         | [Storefront rendering](architecture/storefront-rendering.md), [performance workflow](workflows/review-storefront-runtime.md)                           | response/cache/payload services, `theme-extension-src/`, Liquid blocks                                                                               | payload size, duplicate renders/listeners, cache, cart mutations | focused unit/E2E, theme build, build                                 |
| Change experiments                                                                                | [Optimization](domain/optimization.md), [analytics](domain/analytics-and-reporting.md)                                                                 | experiment service/editor, storefront override application, attribution                                                                              | stable assignment, weights, snapshot publication, reporting      | experiment unit and storefront/admin E2E                             |
| Add an analytics event or change reporting                                                        | [Analytics and reporting](domain/analytics-and-reporting.md), [workflow](workflows/add-analytics-event.md)                                             | Prisma event enum, analytics model/routes, theme tracker, web pixel, reports                                                                         | privacy/consent, dedupe, attribution, every producer/consumer    | analytics/web-pixel/report unit and E2E tests                        |
| Change persistence or database schema                                                             | [Persistence](architecture/persistence.md), [campaigns](domain/campaigns.md)                                                                           | `prisma/schema.prisma`, migrations, relevant model/service                                                                                           | publication snapshots, cascade behavior, JSON contracts          | Prisma generate/migrate on disposable DB, unit tests, typecheck      |
| Change Shopify extension or integration                                                           | [Shopify integration](architecture/shopify-integration.md), relevant domain                                                                            | `shopify.app.toml`, extension manifest/source, endpoint/auth service                                                                                 | scopes, target availability, network access, generated assets    | config check, extension tests/build, focused endpoint tests          |
| Change billing, authentication, webhooks, or privacy                                              | [Shopify integration](architecture/shopify-integration.md), [persistence](architecture/persistence.md)                                                 | `app/shopify.server.ts`, billing/admin-auth/privacy services, auth/webhook routes                                                                    | shop isolation, OAuth/session lifecycle, compliance              | focused unit/E2E plus config check                                   |
| Change discounts, templates, recommendations, AI, email timers, badges, or checkout/post-purchase | [Optimization](domain/optimization.md), relevant existing feature doc                                                                                  | owning service directory, editor route, schema model, endpoint/extension                                                                             | plan gates, truthful claims, external prerequisites              | owning unit tests plus routed E2E spec                               |

## Architecture

- [Overview](architecture/overview.md): boundaries and runtime map.
- [Admin application](architecture/admin-application.md): routes, editor, validation, and save/publish flow.
- [Data flow](architecture/data-flow.md): admin-to-database-to-storefront evaluation sequence.
- [Storefront rendering](architecture/storefront-rendering.md): endpoints, cache, payload, theme runtime, and parity constraints.
- [Persistence](architecture/persistence.md): Prisma model groups, snapshots, migrations, and transaction risks.
- [Shopify integration](architecture/shopify-integration.md): authentication, app proxy, webhooks, billing, scopes, and extensions.

## Domains

- [Campaigns](domain/campaigns.md)
- [Lifecycle and timers](domain/lifecycle-and-timers.md)
- [Placements and targeting](domain/placements-and-targeting.md)
- [Localization and messages](domain/localization-and-messages.md)
- [Design and structure](domain/design-and-structure.md)
- [Analytics and reporting](domain/analytics-and-reporting.md)
- [Optimization features](domain/optimization.md)
- [Campaign capability matrix](campaign-types/capability-matrix.md)
- [Glossary](glossary.md)
- [Generated identifiers](generated/domain-identifiers.md)
- [Experiments and offers E2E matrix](testing/experiments-and-offers-e2e.md)

## Procedures and decisions

- [Change a campaign capability](workflows/change-campaign-capability.md)
- [Add a placement](workflows/add-placement.md)
- [Add an analytics event](workflows/add-analytics-event.md)
- [Review storefront runtime](workflows/review-storefront-runtime.md)
- [ADR-001: published snapshots](adr/ADR-001-published-campaign-snapshots.md)
- [ADR-002: generated theme assets](adr/ADR-002-generated-theme-runtime.md)
- [ADR-003: targeting and override stages](adr/ADR-003-staged-campaign-evaluation.md)

## Maintenance

Manually maintained docs name their code source and update triggers in a short maintenance section. Generated references say so in their header. Run `npm run docs:generate` after identifier changes and `npm run docs:check` before handoff. The repository currently has no checked-in CI workflow or pull-request template; `docs:check` is ready to add to CI when one is introduced.

## Routing audit

The task router was checked against six representative changes. A new campaign type routes to the campaign workflow/matrix; a new placement to the placement workflow/runtime owners; targeting precedence to the evaluator and staged-evaluation ADR; countdown expiration to both TypeScript and browser timer copies; a new analytics event to its producer/dedupe/consumer workflow; and performance-sensitive rendering to the cache/payload/theme runtime review. Each route names related risks and focused validation without requiring a broad repository scan.
