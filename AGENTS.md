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
