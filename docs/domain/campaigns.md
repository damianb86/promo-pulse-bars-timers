# Campaigns

## Purpose and model

A campaign is the shop-owned configuration that connects intent (`goal`), renderer behavior (`type`), lifecycle, placements, targeting, translated messages, design/structure, and optional type/optimization records. `Campaign.type` determines specialized runtime data; `Campaign.goal` describes merchant intent and is not a renderer registry.

Core one-to-one/one-to-many records are defined in `prisma/schema.prisma`. `app/types/campaign.ts` defines included campaign graphs and targeting contracts. `app/models/campaign.server.ts` owns persistence, status transitions, publication snapshots, and duplication.

## Lifecycle and business rules

- States: `DRAFT`, `ACTIVE`, `PAUSED`, `EXPIRED`.
- Activation requires at least one enabled placement and at least one nonblank translation headline.
- `startsAt` and `endsAt` are nullable instants interpreted with the selected timezone for editor/timer behavior. Storefront excludes future campaigns. Past-end campaigns remain eligible only when the timer expired behavior is not `UNPUBLISH_TIMER`; the browser then applies visual expiration behavior.
- Draft saves update relational state. Publication stores a snapshot. Buyers receive only published campaigns whose current status/gates are eligible.
- Duplication copies the configured graph into a new draft and appends ` copy` to the name; operational history/analytics are not campaign configuration.
- There are no legacy campaigns or backward-compatibility paths to preserve. Change the current model and all consumers together.

## Capability composition

All types share placements, targeting, translations, design, and analytics identity. Timed types use `TimerSettings`; cart rescue, free shipping, delivery cutoff, low stock, and badges add focused records. Discounts, experiments, Markets, assets, email timers, advanced rules, and recommendations attach orthogonally and are plan/feature gated.

See the [capability matrix](../campaign-types/capability-matrix.md) for real identifiers, defaults, placements, and tests.

## Main entry points

- List/create/edit: `app/routes/app.campaigns.tsx`, `app.campaigns.new.tsx`, `app.campaigns.$id.tsx`.
- Editor contracts/defaults: `app/types/campaign-form.ts`, `app/types/campaign-options.ts`, `app/components/campaign-form/constants.tsx`.
- Form validation: `app/services/campaign-form.server.ts` and focused form services.
- Persistence/publication: `app/models/campaign.server.ts`.
- Public selection/serialization: `app/services/storefront-campaigns-response.server.ts`, `app/utils/storefront-campaigns.ts`.
- Templates: `app/services/templates/systemTemplates.js`, `templateLibrary.server.ts`.

## Common changes and failure modes

Adding a type touches Prisma enum/migration, option/preset/default/form parsing, type-specific persistence, view-model serialization, preview/theme runtime, templates/AI prompts, plan gates, tests, matrix, and generated references. A frequent failure is supporting a type in the editor but not a placement runtime, or saving a field without adding it to the publication snapshot.

## Validation

Run campaign rules/form/model tests, type-specific utility tests, `campaign-crud.spec.ts`, `campaign-types-storefront.spec.ts`, focused placement/design tests, docs generation/check, typecheck, and build.

## Related documentation

[Admin application](../architecture/admin-application.md), [lifecycle and timers](lifecycle-and-timers.md), [placements and targeting](placements-and-targeting.md), [ADR-001](../adr/ADR-001-published-campaign-snapshots.md).

## Maintenance

Source of truth: Prisma campaign records, campaign options/forms/model, and storefront serializer. Update when capability, invariant, lifecycle, or entry-point ownership changes.
