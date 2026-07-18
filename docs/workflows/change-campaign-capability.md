# Workflow: change a campaign type or capability

## Use when

Adding/removing a campaign type, or changing which timer, specialized settings, placement, targeting, design, experiment, analytics, or template capabilities a type supports.

## Before editing

Read [campaigns](../domain/campaigns.md), the [capability matrix](../campaign-types/capability-matrix.md), and the affected domain/runtime doc. Search the identifier through code and tests to find distributed conditionals; there is no single capability registry.

## Coordinated changes

1. Update `prisma/schema.prisma` and create/review a migration if a stored enum/record changes.
2. Align `app/types/campaign-options.ts`, `app/types/campaign-form.ts`, setup presets/constants, visible editor choices, and form parsing/validation.
3. Add/update specialized persistence in `app/models/campaign.server.ts`, including duplicate, publication include/snapshot/hydration, and cleanup paths.
4. Update message/design/view-model serialization and public payload types in `app/utils/storefront-campaigns.ts`.
5. Update admin preview/structure slots and each supported theme or Shopify-extension renderer. Author theme changes under `theme-extension-src/`.
6. Review plan/premium gates, discounts, templates, AI prompts, experiment override allowlists, analytics producers/reports, and onboarding/help text.
7. Add unit tests for defaults/parsing/rules/serialization and browser tests for each claimed placement.
8. Update the capability matrix, task router if ownership changed, and generated identifiers.

## Completion checklist

- [ ] Editor can create, validate, save, reload, duplicate, activate, and publish the capability.
- [ ] Storefront uses the published snapshot and renders every documented placement without duplicates.
- [ ] Missing runtime data fails safely and claims remain truthful.
- [ ] Preview/mobile/custom structure and analytics interaction are covered where applicable.
- [ ] `npm run docs:generate && npm run docs:check`, Prisma/typecheck, unit tests, focused E2E, theme/build pass.

## Maintenance

Update when the cross-cutting file set or validation flow for campaign capabilities changes.
