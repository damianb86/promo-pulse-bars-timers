# Advanced Product Badges

Advanced badges turn the original single product badge into prioritized
merchandising rules. Simple badge settings remain available and are used as a
fallback when no advanced rule matches.

## Rule Inputs

Rules support these product context fields:

- product tags;
- collection IDs;
- vendor;
- inventory quantity;
- active discount flag;
- `compare_at_price` greater than price;
- one optional product metafield exposed by the theme block;
- market;
- country;
- locale;
- schedule window.

All configured conditions must match. Empty conditions are ignored.

## Storefront Endpoint

The product badge block calls:

```text
GET /api/storefront/badges
GET /apps/counterpulse-campaigns/api/storefront/badges
```

The app-proxy route is used by the Theme App Extension in production. The direct
API route is useful with `apiBaseUrl` during development.

The response contains:

```json
{
  "badges": [
    {
      "campaignId": "campaign-id",
      "ruleId": "rule-id",
      "text": "VIP drop",
      "priority": 25,
      "badge": {
        "badgeShape": "PILL",
        "badgePosition": "TOP_RIGHT",
        "url": "/collections/vip"
      }
    }
  ]
}
```

## Theme Safety

Promo Pulse does not automatically inject badges into every product card. The
merchant must place the Product Badge app block where the theme supports app
blocks. Collection/product card support is limited to contexts where Shopify
exposes a `product` object.

## Analytics

The product badge asset emits:

- `BADGE_IMPRESSION`;
- `BADGE_CLICK` when the badge has a URL.

These are stored in `AnalyticsEvent` and counted as impressions/clicks in the
existing analytics summaries.

## Limitations

- Metafield matching needs the merchant to configure one namespace/key on the
  theme block so Liquid can safely expose that product metafield.
- Inventory values depend on what the theme/Liquid context exposes.
- Multiple matching rules render multiple badges, sorted by priority, with
  duplicate campaign/text/position combinations removed.
