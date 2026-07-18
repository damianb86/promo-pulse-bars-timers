# Workflow: add a placement

## Prerequisites

Read [placements and targeting](../domain/placements-and-targeting.md), [storefront rendering](../architecture/storefront-rendering.md), the [capability matrix](../campaign-types/capability-matrix.md), and Shopify target documentation if this is not a theme surface.

## Steps

1. Decide the runtime owner: embed injection, theme block, badge endpoint, checkout/account extension, or a new justified boundary. Identify context actually available there.
2. Add the Prisma `PlacementType` and migration. Align option labels/descriptions, form guards, setup/default mappings, plan limits, shop selectors, and editor preview.
3. Update `parseStorefrontCampaignContext`, supported/default placement lists, matching/serialization/deduplication, payload placement index, and cache variation. Dedicated endpoints must apply equivalent status/schedule/plan/shop checks.
4. Implement the renderer and selector/slot behavior. For theme code, edit `theme-extension-src/`, Liquid/manifests if needed, then generate assets.
5. Update analytics validation/producers/report dimensions and experiment placement override validation.
6. Add unit tests for invalid/requested/multiple placement behavior and E2E for actual insertion, no duplicates, responsive layout, and missing target failure.
7. Update capability and generated matrices plus integration docs.

## Completion checklist

- [ ] A campaign cannot claim support without an implemented renderer and test.
- [ ] Multi-placement payload contains the campaign once and renders once per descriptor.
- [ ] Custom selector/context is sanitized and absent targets fail closed.
- [ ] Plan/auth/privacy gates apply at the owning endpoint.
- [ ] Docs, migration, typecheck, unit tests, focused E2E, theme/extension build pass.

## Maintenance

Update when placement ownership, payload representation, or required validation changes.
