# Persistence

## Store and model groups

`prisma/schema.prisma` targets PostgreSQL and is the data-model source of truth.

- Tenant/session: `Session`, `Shop`, `ShopSettings`, onboarding, agency access.
- Campaign core: `Campaign`, placements, targeting, design, timer/type settings, translations, assets, discount sync.
- Optimization: experiments/variants, unique-code pools/assignments, advanced discount/badge rules, Market rules, templates, recommendations, email timers.
- Measurement: `AnalyticsEvent`, attribution touches/conversions.

Most dependent campaign records cascade on campaign deletion. Analytics campaign relation uses `SetNull`, preserving shop-level history. Read exact relations before changing deletion behavior.

## Publication model

Relational records are editable draft state. `publishCampaignForShop()` serializes the included graph into `Campaign.publishedSnapshot` and records `publishedAt`. `getPublishedCampaignsForShop()` loads campaigns with a publication timestamp, then `hydratePublishedCampaignSnapshot()` replaces live relations/fields with the snapshot. Consequently:

- editing a draft must not leak to storefront;
- every newly storefront-relevant relation must be included in the publication include, snapshot, and hydration path;
- applying an experiment winner to base state still requires publication;
- schema changes to snapshotted fields require current-model handling only; the project explicitly has no legacy campaign compatibility requirement.

## Migrations

Change `prisma/schema.prisma`, generate a named migration against an appropriate development database, review SQL, then run Prisma generation/typecheck/tests. Do not modify an applied migration. `scripts/prisma-env.mjs` wraps setup/deploy operations. No database URL belongs in source or documentation examples beyond placeholders.

## Risks

- JSON columns hold targeting rules, overrides, mobile design, structures, and configuration. Runtime parsing must treat malformed values conservatively.
- Large campaign updates span multiple related tables; preserve transactions and shop scoping.
- Prisma enums are used in TypeScript, theme payload strings, extension code, tests, and generated docs.
- README and older architecture prose may mention SQLite; the current schema and migrations are PostgreSQL.

## Validation

Run `npx prisma generate`, migrate a disposable development/test database when schema changes, `npm run typecheck`, focused model/service tests, `npm run test:unit`, and `npm run docs:generate && npm run docs:check` for enum changes.

## Related documentation

[Campaigns](../domain/campaigns.md), [ADR-001](../adr/ADR-001-published-campaign-snapshots.md).

## Maintenance

Source of truth: Prisma schema/migrations and persistence models. Update for model ownership, relation semantics, snapshot inclusion, or migration workflow changes.
