# ADR-001: Serve published campaign snapshots

## Status

Accepted current architecture. This record documents observable code behavior; original historical rationale is not asserted.

## Context

Campaign configuration spans many mutable relations. Merchants need to save edits without immediately changing buyer-facing campaigns, and storefront cache/versioning needs a stable publication unit.

## Decision

Publishing serializes the included campaign graph into `Campaign.publishedSnapshot` and sets `publishedAt`. Public campaign queries load records with `publishedAt`, then hydrate storefront configuration from the snapshot. Draft relation changes become public only after another publish.

## Consequences

- Save and publish are distinct workflows and must remain visible in UI/tests.
- New storefront fields/relations require explicit snapshot inclusion and hydration.
- Applying a winner or other base edit does not deploy it by itself.
- Snapshots duplicate relational data and require careful current-schema mapping; the repository does not maintain legacy campaign compatibility paths.

## Related code

`app/models/campaign.server.ts`, `app/types/campaign.ts`, `app/services/storefront-campaigns-response.server.ts`.

## Related documentation

[Persistence](../architecture/persistence.md), [campaigns](../domain/campaigns.md).
