# Unique Discount Codes

Storefront campaigns configured with unique codes request one code per
`visitorId` from `POST /api/storefront/unique-code/assign`.

The storefront widget uses the persisted Promo Pulse visitor/session IDs and
does not collect PII. The backend validates that the shop exists, the campaign
is active, the campaign uses unique codes, and the shop plan can use the
feature before assigning from the campaign pool.

## Auto-Apply

When auto-apply is enabled for the campaign, the endpoint returns a relative
Shopify discount URL:

```text
/discount/CODE?redirect=/current-path
```

The storefront only renders the apply button for safe relative `/discount/...`
URLs. Promo Pulse does not force checkout state or claim the code is applied
until Shopify handles that URL. If a theme, market, checkout setting, or browser
policy changes Shopify's discount behavior, the fallback is still a visible code
with a copy action.

## Expiration

The widget shows a code-level countdown when `expiresAt` is present. When that
timer reaches zero, it hides the code, renders the campaign `expiredText`, and
best-effort posts `action: "expire"` to the assign endpoint.
