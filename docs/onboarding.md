# Promo Pulse Onboarding

Promo Pulse includes a guided setup flow at `/app/onboarding` for new
merchants.

## Flow

1. Welcome screen when the shop has no campaigns.
2. Goal selection: flash sale, free shipping, delivery cutoff, or cart rescue.
3. Template selection using the existing design templates.
4. Basic copy editing for headline, subheadline, CTA text, and CTA URL.
5. Placement selection: top bar, product page, or cart.
6. Starter campaign creation and activation.
7. Setup instructions for Theme Editor.
8. Persistent checklist shown in onboarding and dashboard.

## Checklist persistence

The checklist is stored per shop in `ShopOnboardingChecklist`.

- `firstCampaignCreated`: set automatically after a campaign is created, or
  inferred if the shop already has campaigns.
- `appEmbedEnabled`: manual boolean because Shopify does not expose a reliable
  theme app embed status to this local app flow.
- `productBlockAdded`: manual boolean.
- `cartBlockAdded`: manual boolean.
- `firstImpressionReceived`: set automatically when an `IMPRESSION` analytics
  event is saved.

## Theme Editor URL

When the shop domain is available, Promo Pulse builds a best-effort URL:

```text
https://{shop}/admin/themes/current/editor?context=apps
```

For product and cart placements it adds `template=product` or `template=cart`.
If the URL cannot be constructed, the onboarding success screen simply hides the
button and still shows the manual instructions.

## Plan gating

The onboarding flow uses the same plan gates as campaign creation. On Free,
flash sale and basic free shipping campaigns are available. Delivery cutoff and
cart rescue are locked until the required plan unlocks those features.
