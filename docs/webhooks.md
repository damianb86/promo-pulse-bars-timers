# Webhooks

Promo Pulse uses Shopify webhooks to reconcile storefront state with completed
commerce events.

## Orders Create

Route:

```text
POST /webhooks/orders/create
```

The handler verifies the request with `authenticate.webhook(request)`, reads
order discount codes, and reconciles any matching `UniqueDiscountCode` records:

- no discount codes: returns success and does not mutate codes;
- matching Promo Pulse code: marks it `USED`, stores the Shopify order ID, and
  increments the pool `totalUsed` counter once;
- unknown code: returns success and records it in the reconciliation result;
- duplicate webhook delivery: no additional counter increment because codes
  already marked `USED` are treated as idempotent.

Real stores need the `orders/create` subscription and the `read_orders` scope.
After changing scopes, the app must be reauthorized before Shopify sends order
payloads to the app.

## Cleanup Jobs

The cleanup service exposes:

- `expireOldAssignedCodes()` for local assigned-code expiration;
- `reconcileUsedCodesFromOrders()` for order/webhook reconciliation;
- `revokeExpiredShopifyCodes()` for best-effort remote deactivation when an
  Admin API client is available.

These jobs do not collect PII. They use order IDs, discount codes, shop IDs, and
campaign IDs only.
