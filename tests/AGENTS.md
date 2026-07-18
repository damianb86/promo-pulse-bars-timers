# Test suites

Read `docs/testing.md` for setup and the root `AGENTS.md` for quality gates.

- `tests/e2e/` uses `E2E_TEST_MODE=true`, a deterministic local server/database, and no Shopify login or live APIs. The bypass must remain unavailable in production.
- Prefer accessible role/label/name locators. Do not weaken assertions or add arbitrary waits; inspect the report/trace first.
- `tests/e2e-real/` is opt-in only: require `REAL_E2E_ENABLED=true`, use admin `storageState`, never combine with E2E mode, never create orders without `REAL_E2E_ALLOW_ORDER=true`, and only delete `[PP-E2E]` resources.
- When real auth is missing, ask the user to run `npm run test:e2e:real:auth`. Missing embed/block/external Shopify setup is a documented prerequisite and should skip clearly.
- Add the narrowest test that proves the intended business rule, then run the focused spec and relevant unit suite.
- For experiment or offer changes, update `docs/testing/experiments-and-offers-e2e.md` and use `test:e2e:experiments`, `test:e2e:offers`, or `test:e2e:smoke`. Distribution sampling belongs in unit tests; browser tests prove representative end-to-end identities and exact persisted attribution.
