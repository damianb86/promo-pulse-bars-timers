# Promo Pulse Pricing

Stage 2 pricing separates basic campaign tools from premium optimization and
agency workflows. Prices are monthly placeholders until Shopify Billing charges
are connected in production.

| Plan    | Price | Intended use                                                                                                               |
| ------- | ----: | -------------------------------------------------------------------------------------------------------------------------- |
| Free    |    $0 | Stage 1 basics: countdown bar, basic product timer, and basic free shipping bar.                                           |
| Starter |    $9 | Basic campaigns with scheduling, templates, recurring timers, and basic targeting.                                         |
| Growth  |   $19 | Cart drawer, delivery cutoff, discount sync, analytics, and multi-language campaigns.                                      |
| Pro     |   $39 | Advanced targeting, product badges, custom CSS, stronger attribution, and reports.                                         |
| Premium |   $79 | Unique codes, A/B testing, auto-winner, email timers, advanced reports, market overrides, and limited AI Campaign Builder. |
| Agency  | $149+ | Multi-store workspace, shared templates, agency dashboard, and higher limits.                                              |

## Feature Gating

| Feature key            | Required plan |
| ---------------------- | ------------- |
| `UNIQUE_CODES`         | Premium       |
| `AB_TESTING`           | Premium       |
| `AUTO_WINNER`          | Premium       |
| `ADVANCED_DISCOUNTS`   | Premium       |
| `CHECKOUT_EXTENSIONS`  | Pro           |
| `EMAIL_TIMERS`         | Premium       |
| `ADVANCED_BADGES`      | Pro           |
| `MARKETS_ADVANCED`     | Premium       |
| `AI_CAMPAIGN_BUILDER`  | Premium       |
| `ADVANCED_REPORTING`   | Premium       |
| `BEHAVIORAL_TARGETING` | Pro           |
| `RECOMMENDATIONS`      | Pro           |
| `CAMPAIGN_LIBRARY`     | Starter       |
| `AGENCY_DASHBOARD`     | Agency        |

## Development Overrides

Local and E2E environments may override `Shop.plan` with:

```bash
PROMO_PULSE_DEV_PLAN=AGENCY
PROMOPILOT_DEV_PLAN=AGENCY
COUNTERPULSE_DEV_PLAN=AGENCY
```

When no override is provided, `NODE_ENV=development` defaults to the `AGENCY`
effective plan. Overrides are ignored when `NODE_ENV=production`.

## Billing Status

`/app/billing` displays all plans and returns a local placeholder message when a
paid plan is selected. Shopify Billing charge creation still needs production
charge IDs and subscription persistence before public launch.
