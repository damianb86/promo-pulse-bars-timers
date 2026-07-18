# Campaign lifecycle and timers

## Schedule versus countdown

Campaign schedule (`startsAt`, `endsAt`, `timezone`) determines server eligibility. `TimerSettings` determines the displayed countdown. They overlap for fixed timers but are not identical: `countdownTo` can provide the fixed countdown target, while campaign `endsAt` remains the eligibility boundary. Read the save/serialization code before changing either.

## Timer modes

| Mode                | Source of deadline                                                               | Persistence/edge behavior                                                                  |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `FIXED_DATE`        | configured fixed instant (`countdownTo`/campaign end in view-model construction) | inactive without a valid deadline                                                          |
| `EVERGREEN_SESSION` | first valid render plus `durationMinutes`                                        | reuses stored start/end according to reset behavior and timezone                           |
| `RECURRING_DAILY`   | daily cutoff hour/minute in campaign timezone                                    | after cutoff the current cycle is expired; repeat behavior/runtime determines next display |
| `RECURRING_WEEKLY`  | weekday cutoff rules in campaign timezone                                        | supported by engine/schema/runtime, but not exposed in the primary editor mode options     |

Reset values are `NEVER`, `ON_SESSION_END`, `DAILY`, and `WEEKLY`. Expired values are `UNPUBLISH_TIMER`, `HIDE_TIMER`, `REPEAT_COUNTDOWN`, `SHOW_CUSTOM_TITLE`, and `DO_NOTHING`. The form forces repeat-countdown reset behavior to `ON_SESSION_END`.

## Precedence and invariants

- Invalid `now`, duration, deadline, timezone input, or recurring configuration must produce a safe inactive/expired state, never a fabricated countdown.
- Server filtering removes a past-end campaign only for `UNPUBLISH_TIMER`. Other expiration presentations are resolved by the browser renderer.
- Cart rescue can force an evergreen timer and has extra start triggers (`CART_VIEWED`, cart item added, checkout started) plus optional arming behavior. Its timer storage/fingerprint is implemented in `cart-timer.js`.
- Storefront code cannot import `app/lib/timer.ts`; equivalent logic exists in multiple browser assets. Any semantic change must update and test all implementations.
- Timezone/DST conversion is business logic. Use IANA timezones and existing helpers; do not replace zoned calculation with local browser time.

## Dismissal

Design controls whether closing is available and whether it affects only the current page instance (`SHOW_AGAIN`) or is remembered in browser local storage (`HIDE_PERMANENTLY`). Theme runtimes currently key stored dismissal only by campaign ID, stop timers on removal, and apply exit animation. The editor description says republishing makes the campaign visible again, but no publication version appears in the browser key; verify this ambiguity before relying on republish reset. Placement-specific copies exist in product/cart/general runtimes and must change together.

## Sources and tests

- Engine: `app/lib/timer.ts`, tests `app/lib/timer.test.ts`, `app/lib/timezone.test.ts`.
- Save/view model: `app/types/campaign-form.ts`, `app/models/campaign.server.ts`, `app/utils/storefront-campaigns.ts`.
- Browser implementations: theme sources containing `calculateTimerState`, `dailyDeadline`, `weeklyDeadline`, and dismissal helpers.
- E2E: `storefront-countdown.spec.ts`, `delivery-cutoff.spec.ts`, `campaign-editor-settings.spec.ts`, cart/free-shipping flows.

## Related documentation

[Campaigns](campaigns.md), [storefront rendering](../architecture/storefront-rendering.md).

## Maintenance

Source of truth: Prisma timer enums/model, TypeScript timer engine, form mapping, and browser runtime copies. Update on mode, deadline, expiration, reset, schedule, timezone, or dismissal changes.
