# Workflow: review performance-sensitive storefront rendering

## Use when

Changing the storefront response/cache/payload, theme JavaScript/CSS, cart observers, countdown loops, structure hydration, selectors, or analytics listeners.

## Review sequence

1. Read [storefront rendering](../architecture/storefront-rendering.md), [data flow](../architecture/data-flow.md), and the affected domain. Read `theme-extension-src/AGENTS.md`.
2. Trace one request from Liquid dataset/config through URL/context, access/cache, serialization, placement index, campaign surface hydration, and analytics.
3. Check network behavior: request count, ETag/cache headers, cache key context, schedule boundary, cart refresh debounce, error backoff, payload duplication/size.
4. Check DOM lifecycle: one node per campaign/placement, observer ignores internal mutations, listeners/timers are not multiplied, removed surfaces clear intervals, selector failures do not throw.
5. Check rendering: sanitized structure, mobile/desktop overflow, reduced motion/accessible controls, critical CSS and full CSS order, no unsafe HTML insertion.
6. Check parity: admin preview, custom structures, experiments/Markets overrides, dismissal/expiration, offer/progress/type-specific slots.
7. Edit source, run `npm run theme:build`, and inspect generated diff only for expected deterministic output.

## Validation

Run serializer/cache/timer/structure tests; focused storefront, cart drawer, preview parity, mobile, and analytics E2E; `npm run lint`, `npm run typecheck`, and `npm run build`. Use a browser trace/report and inspect console/network/DOM for runtime changes.

## Completion checklist

- [ ] No additional repeated request, observer, listener, timer, or duplicate surface.
- [ ] Cache changes vary on every new context dependency.
- [ ] Failure is no-render/non-blocking and debug output contains no secret.
- [ ] Generated assets match editable source and tests cover the changed flow.

## Maintenance

Update when storefront boot, cache strategy, renderer lifecycle, or performance test approach changes.
