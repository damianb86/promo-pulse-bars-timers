# Promo Pulse Pricing

Promo Pulse currently has four public plans: Free, Starter, Growth, and Pro.
Growth is the recommended plan. Pro is the final plan and includes every
implemented feature.

| Plan    | Price | Included usage and positioning                                                                 |
| ------- | ----: | ---------------------------------------------------------------------------------------------- |
| Free    |    $0 | Real trial usage: 10,000 impressions/month, 2 active campaigns, basic campaigns, 7-day analytics. |
| Starter |    $9 | Small-store paid entry: 50,000 impressions/month, 5 active campaigns, templates, 30-day analytics. |
| Growth  |   $19 | Recommended optimization plan: 250,000 impressions/month, 25 active campaigns, advanced reports. |
| Pro     |   $39 | Everything included: 1,500,000 impressions/month, unlimited reasonable campaigns, all automation. |

## Feature Gating

| Feature key            | Required plan |
| ---------------------- | ------------- |
| `UNIQUE_CODES`         | Free          |
| `AB_TESTING`           | Free          |
| `AUTO_WINNER`          | Pro           |
| `ADVANCED_DISCOUNTS`   | Pro           |
| `CHECKOUT_EXTENSIONS`  | Pro           |
| `EMAIL_TIMERS`         | Growth        |
| `ADVANCED_BADGES`      | Growth        |
| `MARKETS_ADVANCED`     | Growth        |
| `AI_CAMPAIGN_BUILDER`  | Growth        |
| `ADVANCED_REPORTING`   | Growth        |
| `BEHAVIORAL_TARGETING` | Pro           |
| `RECOMMENDATIONS`      | Pro           |
| `CAMPAIGN_LIBRARY`     | Starter       |
| `AGENCY_DASHBOARD`     | Pro           |

## Plan Limits

| Limit                    | Free  | Starter | Growth                | Pro                    |
| ------------------------ | ----- | ------- | --------------------- | ---------------------- |
| Impressions/month        | 10k   | 50k     | 250k                  | 1.5M                   |
| Active campaigns         | 2     | 5       | 25                    | Unlimited reasonable   |
| Draft campaigns          | Unlimited | Unlimited | Unlimited          | Unlimited              |
| Storefront languages     | 2     | 3       | Unlimited reasonable  | Unlimited reasonable   |
| Discount sync campaigns  | 1     | 3       | Unlimited reasonable  | Unlimited reasonable   |
| Unique codes/month       | 25    | 500     | 5,000                 | 50,000 or high usage   |
| Active A/B tests         | 1     | 2       | 10                    | Unlimited reasonable   |
| A/B variants             | 2     | 2       | 3                     | Unlimited reasonable   |
| Analytics retention      | 7 days | 30 days | 90 days              | 365 days               |
| Email countdown timers   | 0     | 0       | 5                     | Unlimited reasonable   |
| AI Campaign Builder      | No    | No      | Limited               | Full                   |
| Custom CSS               | No    | No      | Yes                   | Yes                    |
| Auto-winner              | No    | No      | No                    | Yes                    |

## Development Overrides

Local and E2E environments may override `Shop.plan` with:

```bash
PROMO_PULSE_DEV_PLAN=PRO
```

Valid override values are `FREE`, `STARTER`, `GROWTH`, and `PRO`. When no
override is provided, `NODE_ENV=development` defaults to the `PRO` effective
plan. Overrides are ignored when `NODE_ENV=production`.

## Billing Status

`/app/billing` displays the four public plans and returns a local placeholder
message when a paid plan is selected. Shopify Billing charge creation still
needs production charge IDs and subscription persistence before public launch.
