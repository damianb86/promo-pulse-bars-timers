# Experiments and offers E2E audit

This matrix is the source of truth for end-to-end coverage of campaign
experiments and offer mechanisms. It reflects the current Prisma schema,
services, editor, storefront serializer/runtime, analytics ingestion, Shopify
Function, and existing automated tests.

## Current product model

- One campaign can have at most one open experiment. Different campaigns can
  run experiments simultaneously.
- Assignment is a deterministic server-side weighted hash of experiment ID and
  visitor ID. It is not stored in browser assignment keys.
- Paused, draft, completed, out-of-window, archived, and zero-weight variants
  are not assignable.
- Declaring a winner completes the experiment. Applying it updates the campaign
  draft; publishing is a separate merchant action before storefront traffic
  sees the winning base campaign.
- “Offers” is an editor workspace, not one database entity. It combines basic
  `DiscountSync`, unique-code pools and assignments, advanced app discount
  rules, and email timer configuration.

## Traceability matrix

| Risk / behavior                                                                | Unit or service coverage                      | Browser coverage                                                      | Backend assertion                          |
| ------------------------------------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| Weight normalization, control remainder, two/three variants, zero weights      | `experiments.server.test.ts`                  | `experiments.spec.ts`                                                 | experiment/variant read model              |
| Stable deterministic assignment and distribution tolerance                     | `experiments.server.test.ts` (5,000 visitors) | `experiments/critical-path.spec.ts`, `storefront-experiments.spec.ts` | exact touch experiment/variant IDs         |
| Draft/start/pause/resume/stop/completed lifecycle                              | `experiments.server.test.ts`                  | `experiments.spec.ts`                                                 | experiment and variant statuses            |
| One open experiment per campaign                                               | `experiments.server.test.ts`                  | `experiments.spec.ts`                                                 | service rejection                          |
| Simultaneous experiments on different campaigns                                | metric calculation tests                      | `experiments/critical-path.spec.ts`                                   | per-campaign touch isolation               |
| Impression dedupe and click attribution                                        | analytics and experiment tests                | `experiments/critical-path.spec.ts`                                   | exact session event/touch counts           |
| Cross-campaign experiment/variant spoofing                                     | analytics validation test                     | `experiments/critical-path.spec.ts`                                   | HTTP 400 and no touch                      |
| CTR, add-to-cart, checkout, revenue metrics                                    | `experiments.server.test.ts`                  | `experiments.spec.ts`                                                 | seeded touches/conversions                 |
| Auto-winner thresholds, ties, zero sample, insufficient runtime/sample         | `experiments.server.test.ts`                  | `auto-winner.spec.ts`                                                 | winner/status/application timestamp        |
| Winner application and publish boundary                                        | `experiments.server.test.ts`                  | `auto-winner.spec.ts`                                                 | completed experiment plus fresh storefront |
| Basic/manual discount display                                                  | serializer/service tests                      | storefront and editor specs                                           | `DiscountSync` state                       |
| Unique-code generation, visitor stability, exhaustion, expiration/reassignment | `uniqueCodes.server.test.ts`                  | `unique-codes.spec.ts`, `offers/critical-path.spec.ts`                | pool/code/assignment state and analytics   |
| Copy/apply event tracking                                                      | analytics tests                               | `offers/critical-path.spec.ts`                                        | exact session event counts                 |
| Advanced discount rule CRUD and plan gates                                     | `advancedDiscounts.server.test.ts`            | `campaign-editor-settings.spec.ts`                                    | rule status and E2E remote ID              |
| Threshold/product/shipping operation output                                    | Shopify Function tests                        | editor creation coverage                                              | pure Function output assertions            |
| Reports remain separated by campaign/variant                                   | report and experiment metric tests            | `experiments.spec.ts`, report specs                                   | touches and conversions by identity        |

## Commands

```bash
npm run test:unit:experiments-offers
npm run test:e2e:smoke
npm run test:e2e:experiments
npm run test:e2e:offers
```

The full regression gate remains `npm run lint`, `npm run typecheck`,
`npm run test:unit`, and `npm run test:e2e`. Distribution checks stay in Vitest
so they can use thousands of deterministic identities cheaply. Playwright uses
representative identities and validates the full browser-to-database path.

## Isolation and observability

Local Playwright defaults to `file:./e2e.sqlite`. Only `E2E_DATABASE_URL` may
override it; development and production URLs are never inherited.
`E2E_TEST_MODE=true` is rejected in production. Test reset and read routes are
guarded by that mode, and the read model is scoped to the demo shop.

The read endpoint exposes experiment, variant, touch, conversion, basic offer,
unique-code pool, advanced-rule, and raw analytics state. Browser tests use it
only for assertions; merchant actions still go through the real admin and
storefront routes.

## Real Shopify boundary

The isolated suite cannot prove Shopify Admin discount creation, checkout
discount application, order webhooks, theme compatibility, or deployed Shopify
Function execution. Those belong to `tests/e2e-real` and remain opt-in:

```bash
npm run test:e2e:real:auth
REAL_E2E_ENABLED=true npm run test:e2e:real -- tests/e2e-real/<selected-spec>
```

Never use `E2E_TEST_MODE` in real-store tests. Never create an order unless
`REAL_E2E_ALLOW_ORDER=true`, and never delete resources without the `[PP-E2E]`
prefix. A missing app embed or block is a prerequisite skip, not a product
failure.

## Maintenance

Update this matrix when experiment assignment/lifecycle, offer types, analytics
identity, winner behavior, or Shopify discount integration changes. Run
`npm run docs:check`, the focused unit command, and the relevant Playwright
command before handoff.
