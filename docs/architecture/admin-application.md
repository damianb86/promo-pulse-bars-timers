# Admin application

## Responsibility

The embedded React Router application authenticates merchants, loads shop-scoped data, validates campaign input, persists draft relations, publishes snapshots, and presents analytics/optimization tools. UI uses React plus Shopify Polaris web components/App Bridge.

## Campaign editor flow

1. `app.campaigns.new.tsx` or `app.campaigns.$id.tsx` authenticates the admin and loads plan, shop settings, targeting options, templates, and campaign details.
2. `CampaignEditorLayout.tsx` coordinates the setup/message/design/placement/targeting/schedule/review tabs. Specialized editors own translations, design, discounts, experiments, and offers.
3. `app/services/campaign-form.server.ts` parses and validates the base form. Cross-cutting sections are parsed in `app/utils/campaign-editor-form.server.ts` and focused form services.
4. The action calls `app/models/campaign.server.ts` plus services for related records. Saving updates `lastSavedAt`; activation validates headline and placement. Publishing creates `publishedSnapshot` and `publishedAt`.
5. `CampaignPreviewPanel.tsx` and campaign view-model/structure utilities render the admin preview. This preview is a contract partner of the theme runtime, not authoritative storefront output.

## Invariants and coupling

- Every database operation is scoped to the authenticated shop; never accept a client-supplied shop ID as authorization.
- Form enum options, Prisma enums, parsing guards, setup presets, persistence branches, and storefront support must stay aligned.
- Multiple placements are represented by `placementTypes`; `placementType` remains the primary form value. Normalize/deduplicate before persistence.
- A successful draft save does not change what buyers see until publication captures a new snapshot.
- AI or template application still passes through normal structure, message, and form guardrails.
- Preview changes must be checked against custom structure HTML, mobile design, theme CSS, dynamic slots, and storefront text resolution.

## Main tests

- `app/services/campaign-form.server.test.ts`, `app/services/campaign-rules.test.ts`.
- `app/utils/campaign-design.test.ts`, `campaign-structure.test.ts`, `structure-html.test.ts`.
- `tests/e2e/campaign-crud.spec.ts`, `campaign-editor-settings.spec.ts`, `design-preview.spec.ts`, `preview-storefront-parity.spec.ts`.

## Related documentation

[Campaigns](../domain/campaigns.md), [design and structure](../domain/design-and-structure.md), [persistence](persistence.md).

## Maintenance

Source of truth: campaign routes, form parsers, editor components, and campaign model. Update when editor tabs, save/publish semantics, validation ownership, or preview contracts change.
