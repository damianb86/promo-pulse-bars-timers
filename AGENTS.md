# Promo Pulse agent guide

## Product

Promo Pulse is an embedded Shopify app for creating, publishing, targeting, localizing, and measuring promotional campaigns. The implemented campaign types are countdown bars, product timers, cart timers, free-shipping goals, delivery cutoffs, low-stock messages, and product badges. Campaigns render through a theme app extension, checkout/customer-account extensions, and public endpoints; optimization features include experiments, discounts, Markets overrides, templates, recommendations, and reporting.

## Technology and runtime

- Node.js `>=20.19 <22 || >=22.12`, npm workspaces, TypeScript, React 18, React Router 7, Vite.
- Shopify App Bridge and `@shopify/shopify-app-react-router`; this is not a Next.js application.
- Prisma 6 with PostgreSQL. The schema is `prisma/schema.prisma`.
- Vitest for unit/integration tests and Playwright for browser tests.
- Shopify Theme, Checkout UI, Customer Account UI, Web Pixel, and Function extensions.

## Start here

1. Read this file, then `docs/INDEX.md`.
2. Choose the affected domain and read only the routed architecture/domain documents.
3. Open the listed entry points and their nearest tests; avoid repository-wide scanning once the boundary is known.
4. Check for a nested `AGENTS.md` before editing under `app/`, `theme-extension-src/`, `extensions/`, or `tests/`.
5. Preserve behavior unless the task explicitly changes it. There are no legacy campaign compatibility requirements: implement the current model directly and do not add old-format fallbacks or migrations.
6. Update docs when behavior, schemas, contracts, boundaries, data flow, supported capabilities, paths, or validation commands change.
7. Run proportionate validation from the matrix in `docs/INDEX.md` and the definition of done below.

Detailed knowledge belongs in `docs/`, not in this always-loaded file.

## Repository map

| Path                                   | Responsibility                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `app/routes/`                          | React Router pages, loaders/actions, public APIs, webhooks, and guarded test routes        |
| `app/components/`                      | Embedded-admin UI, campaign editor, preview, design controls                               |
| `app/models/`                          | Prisma access and persistence-level domain operations                                      |
| `app/services/`                        | Use cases, Shopify integrations, optimization/reporting services                           |
| `app/utils/`, `app/lib/`, `app/types/` | Pure/shared contracts, engines, parsing, and view models                                   |
| `prisma/`                              | PostgreSQL schema, migrations, seed                                                        |
| `theme-extension-src/`                 | Editable source for generated theme JavaScript/CSS assets                                  |
| `extensions/`                          | Shopify extension manifests, Liquid, generated theme assets, and extension-specific source |
| `tests/e2e/`                           | Mocked Shopify browser flows using guarded E2E mode                                        |
| `tests/e2e-real/`                      | Opt-in real development-store tests with destructive-operation guards                      |
| `docs/`                                | Task router, architecture/domain knowledge, workflows, ADRs, generated references          |
| `scripts/`                             | Build, environment, Shopify-config, E2E, and documentation tooling                         |

## Sources of truth

| Concern                                   | Source                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Persistence, enums, relations             | `prisma/schema.prisma` and `prisma/migrations/`                                                                |
| Campaign/placement labels and defaults    | `app/types/campaign-options.ts`, `app/types/campaign-form.ts`, `app/components/campaign-form/constants.tsx`    |
| Campaign persistence/publication snapshot | `app/models/campaign.server.ts`                                                                                |
| Form validation and parsing               | `app/services/campaign-form.server.ts`, `app/utils/campaign-editor-form.server.ts`                             |
| Eligibility and targeting precedence      | `app/utils/storefront-campaigns.ts`                                                                            |
| Countdown calculation                     | `app/lib/timer.ts`; duplicated storefront implementations live under `theme-extension-src/promo-pulse-theme/`  |
| Localization defaults/fallbacks           | `app/utils/campaign-localization.ts`, `app/services/campaign-translations-form.server.ts`                      |
| Structure and safe HTML/CSS model         | `app/utils/campaign-structure.ts`, `app/utils/campaign-structure.server.ts`                                    |
| Storefront response and cache             | `app/services/storefront-campaigns-response.server.ts`, `app/services/storefront-cache.server.ts`              |
| Storefront rendering                      | `theme-extension-src/promo-pulse-theme/campaign-surface.js` and placement-specific assets                      |
| Analytics catalog and ingestion           | `prisma/schema.prisma` (`AnalyticsEventType`), `app/models/analytics.server.ts`, `app/lib/web-pixel-events.ts` |
| Experiment assignment/winner logic        | `app/services/experiments/experiments.server.ts`                                                               |
| Shopify configuration                     | `shopify.app.toml` and `extensions/*/shopify.extension.toml`                                                   |
| Shared campaign payload types             | `app/utils/storefront-campaigns.ts`, `app/types/campaign.ts`                                                   |

Generated identifier lists are routed through `docs/generated/domain-identifiers.md`; regenerate them rather than editing them.

## Repository-wide invariants

- Storefront reads the last `publishedSnapshot`, not unsaved/current draft relations. Saving and publishing are distinct operations.
- An active campaign requires an enabled placement and a nonblank translation headline.
- Eligibility applies status/date/plan/placement and exclusion rules before inclusion rules. Market and experiment overrides are applied after base serialization.
- Never fabricate urgency, inventory, discounts, delivery promises, offer use, or attribution. Hide or degrade safely when required data is absent.
- Public payloads and analytics must not expose Shopify access tokens, internal shop IDs, customer PII, or private configuration.
- E2E bypass requires `E2E_TEST_MODE=true` and must never be reachable when `NODE_ENV=production`.
- Theme asset source lives in `theme-extension-src/`; do not hand-edit generated files in `extensions/promo-pulse-theme/assets/`.
- A storefront/runtime change must consider admin preview parity, mobile behavior, custom structure, analytics, and all placements using the shared renderer.

## Generated files

- `extensions/promo-pulse-theme/assets/*.js` and the generated theme CSS counterparts come from `theme-extension-src/promo-pulse-theme/`; run `npm run theme:build`.
- `.react-router/`, `build/`, extension `dist/` and `generated/`, Prisma client output, Playwright reports/traces, and `.shopify/` bundles are tool output. Do not edit or commit them unless the owning tool explicitly requires it.
- `docs/generated/domain-identifiers.md` comes from Prisma and campaign option sources; run `npm run docs:generate`.
- Prisma migrations are generated change history. Change `prisma/schema.prisma`, create a named migration, inspect its SQL, and never rewrite an applied migration.

## Commands

```bash
npm install                         # install workspace dependencies
npm run dev                         # Shopify CLI development server
npm run build                       # theme asset + React Router production build
npm run typecheck                   # route type generation + tsc --noEmit
npm run lint                        # ESLint
npm run format                      # Prettier write
npm run format:check                # Prettier check
npm run test:unit                   # Vitest unit/integration suite
npm run test:e2e                    # mocked Playwright suite
npm run test:e2e:report             # open failed Playwright report
npm run docs:generate               # regenerate derived documentation
npm run docs:check                  # freshness, structure, and local-link validation
npm run db:migrate                  # deploy Prisma migrations to configured database
npm run db:seed                     # seed the configured database
```

There is no separate integration-test command; integration-style tests run under `test:unit`. Real-store tests are opt-in and governed below.

## Testing discipline

- Before finishing a feature, run relevant focused tests plus `npm run test:unit`; run the focused Playwright spec for changed user flows.
- Before release work run `npm run docs:check`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, and `npm run build`.
- Inspect the HTML report or trace before changing code for a Playwright failure: `npm run test:e2e:report` or `npx playwright show-trace test-results/<test-name>/trace.zip`.
- Do not weaken tests. Prefer role, label, and accessible-name selectors; add `data-testid` only without a stable accessible selector.
- Mocked E2E must not depend on Shopify login, a real store, or live Shopify APIs.

### Real Shopify E2E

- Never run `tests/e2e-real` unless `REAL_E2E_ENABLED=true`; never combine it with `E2E_TEST_MODE`.
- Never create real orders unless `REAL_E2E_ALLOW_ORDER=true`.
- Never delete resources not prefixed `[PP-E2E]`.
- Always use `storageState`. If login is required, ask the user to run `npm run test:e2e:real:auth`.
- Skip with a clear prerequisite when an app embed/block is unavailable, and inspect traces before changing code.

## Definition of done

- The requested behavior and cross-runtime parity are implemented without unrelated changes.
- Business rules and security/privacy invariants have focused automated coverage.
- Generated assets/references are refreshed and clean.
- Relevant domain docs and `docs/INDEX.md` routes remain accurate.
- `npm run docs:check`, formatting, lint, typecheck, unit tests, focused E2E, and build have been run in proportion to risk; any skipped gate is reported with the reason.

See `docs/INDEX.md` for task-specific reading, entry points, coupling, and validation.
