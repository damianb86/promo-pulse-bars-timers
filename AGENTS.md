# Agent Instructions

## Testing Discipline

- Before finishing a feature, run the relevant tests. Prefer at least
  `npm run test:unit` and the focused Playwright spec that covers the changed
  flow.
- Before release-oriented work, run `npm run lint`, `npm run typecheck`,
  `npm run test:unit`, and `npm run test:e2e`.
- If a Playwright test fails, inspect the trace or HTML report before changing
  code:

```bash
npm run test:e2e:report
npx playwright show-trace test-results/<test-name>/trace.zip
```

- Do not disable or weaken tests just to make the suite pass. Fix the product,
  the fixture, or the assertion so it reflects the intended behavior.
- Prefer role, label, and accessible-name selectors. Add `data-testid` only
  when the UI has no stable accessible selector.
- Keep the E2E bypass behind `E2E_TEST_MODE=true`, and never make it available
  when `NODE_ENV === "production"`.
- Do not make E2E tests depend on Shopify login, a real dev store, or real
  Shopify APIs unless the test is explicitly documented as a manual smoke test.

## Real Shopify E2E rules:
- Never run tests/e2e-real unless REAL_E2E_ENABLED=true.
- Never use E2E_TEST_MODE in real-store tests.
- Never create real orders unless REAL_E2E_ALLOW_ORDER=true.
- Never delete resources that do not start with [PP-E2E].
- Always use storageState for Shopify admin auth.
- If Shopify login is required, ask the user to run npm run test:e2e:real:auth.
- If a theme app block/app embed is missing, skip with a clear prerequisite message.
- Always inspect Playwright traces before changing code.