# Application boundary

Read `docs/architecture/overview.md` and the routed domain doc before editing here.

- Routes own HTTP/auth/UI coordination; models own Prisma operations; services own use cases/integrations; utilities/libs should stay pure where practical.
- Scope every admin read/write by authenticated shop. Public routes must use the matching storefront/app-proxy/extension auth and plan/privacy gates.
- Campaign draft state and `publishedSnapshot` are separate. A new storefront field must participate in save, duplicate, publish/hydrate, serialization, and tests.
- `app/utils/storefront-campaigns.ts`, `app/models/campaign.server.ts`, and campaign editor routes are high-coupling files. Inspect callers/tests before editing.
- Do not put server-only dependencies in isomorphic view-model/structure utilities used by preview/tests.
- Validate with focused unit tests, `npm run typecheck`, relevant Playwright specs, and `npm run docs:check`; storefront-affecting changes also follow `docs/workflows/review-storefront-runtime.md`.
