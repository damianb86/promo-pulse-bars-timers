# Design, layouts, presets, and campaign structure

## Configuration layers

- `CampaignDesign` in Prisma stores colors/background, typography, alignment, spacing, borders, position/stickiness, desktop/mobile selectors/layout, timer/progress/button/offer controls, icons, animations, dismissal, custom CSS, and structural HTML/AST/version.
- `app/types/campaign-design.ts` owns TypeScript values/defaults and normalization helpers.
- `app/services/campaign-design-form.server.ts` parses design form input; `app/models/campaign.server.ts` maps it to persistence.
- `app/utils/campaign-structure.ts` defines the framework-independent safe structure tree and dynamic slots. `campaign-structure.server.ts` parses/sanitizes merchant HTML and scoped CSS.
- `app/services/templates/systemTemplates.js` and the template library provide reusable campaign configurations. Setup presets in `app/components/campaign-form/constants.tsx` provide type defaults; these are different concepts.

## Structure contract

Structural HTML is the merchant-editable source for DOM shape. It is converted to a reversible AST and stores safe tags/attributes/text order. Dynamic `data-cp-slot` markers are either replaced (`icon`, timers, offer, close, progress) or filled (`headline`, body, CTA, badge text, timer parts). Style values remain separate CSS/design configuration. The current structure version is exported from `campaign-structure.ts`.

Admin preview and `theme-extension-src/promo-pulse-theme/campaign-surface.js` must hydrate equivalent slots and classes. Shared safety CSS prevents common flex/text collapse but campaign CSS may override it within the scoped surface.

## Invariants and risks

- Sanitize structure and CSS server-side; do not trust saved JSON/HTML because it came from an authenticated merchant.
- Keep desktop and mobile resolution deterministic. Mobile overrides are JSON and must fall back to desktop fields when absent.
- Any layout/preset/design field added must flow through defaults, form, mapper, database, snapshot, serializer, preview, runtime/CSS, experiment override allowlist where applicable, and tests.
- Background images/assets are Shopify Files URLs. Asset generation/upload has scope and plan gates and no server-side fallback.
- Close buttons, offer widgets, progress, timers, and badge content are interactive slots; a visual-only change can break analytics or behavior.

## Validation

Run design, structure HTML/tree, inspector registry, asset pipeline, and view-model tests; `design-preview.spec.ts`, `storefront-custom-structure.spec.ts`, `preview-storefront-parity.spec.ts`, mobile/AI structure E2E where relevant; `npm run theme:build` and build. Inspect rendered DOM and overflow, not screenshots alone.

## Related documentation

[Admin application](../architecture/admin-application.md), [storefront rendering](../architecture/storefront-rendering.md), existing [AI builder](../ai-campaign-builder.md).

## Maintenance

Source of truth: Prisma design model, design types/form mapping, structure utilities, preview, and theme surface builder. Update for design fields, slots, sanitization, layouts, presets, or parity rules.
