# ADR-003: Evaluate campaigns in ordered stages

## Status

Accepted current architecture. The motivation is inferred only from current correctness/privacy constraints.

## Context

Campaign visibility combines publication, schedule, plan, placement, multi-dimensional targeting, behavioral history, experiment assignment, and Markets overrides. Mixing these in renderers would duplicate sensitive logic and make cache behavior unreliable.

## Decision

The server evaluates base activity and gates first, exclusions before inclusions, behavior rules with a privacy-gated profile, then serializes the base view model. It applies stable experiment overrides and finally the most specific Markets rule. Browser code renders the resulting public payload and only performs runtime behavior requiring browser/cart/storage state.

## Consequences

- Exclusions always win over base inclusions.
- Missing required targeting context fails eligibility rather than guessing.
- New context-dependent rules require cache-key/bypass review.
- Overrides operate on allowlisted serialized fields; applying a winner to base still requires publication.
- Focused checkout/post-purchase endpoints must reproduce applicable earlier gates even though their view model is smaller.

## Related code

`app/models/campaign.server.ts`, `app/services/storefront-campaigns-response.server.ts`, `app/utils/storefront-campaigns.ts`, `app/services/experiments/experiments.server.ts`, `app/services/markets/marketOverrides.ts`.

## Related documentation

[Data flow](../architecture/data-flow.md), [placements and targeting](../domain/placements-and-targeting.md), [optimization](../domain/optimization.md).
