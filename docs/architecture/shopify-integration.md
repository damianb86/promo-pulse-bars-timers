# Shopify integration

## App and authentication

`app/shopify.server.ts` configures the embedded application, Prisma session storage, API version/scopes, auth paths, webhooks, and billing plans. Admin routes authenticate with Shopify admin context. Public surfaces use the appropriate app-proxy, checkout, or customer-account authentication; guarded E2E helpers are permitted only outside production.

`shopify.app.toml` is the source for app URL, scopes, webhook subscriptions, auth redirect, and app proxy. `npm run config:sync-url` updates URL-bearing fields from `SHOPIFY_APP_URL`; `npm run config:check` checks expected configuration.

## Extensions

| Extension                        | Runtime/targets                                                     | Backend dependency                                             |
| -------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `promo-pulse-theme`              | Theme embed and product/cart blocks                                 | storefront campaigns, badges, unique-code and analytics routes |
| `promo-pulse-checkout`           | `purchase.checkout.block.render`, `purchase.thank-you.block.render` | checkout/post-purchase campaign endpoints; network access      |
| `promo-pulse-order-status`       | `customer-account.order-status.block.render`                        | post-purchase endpoint; network access                         |
| `promo-pulse-web-pixel`          | strict Web Pixel runtime                                            | analytics pixel endpoint and privacy settings                  |
| `promo-pulse-advanced-discounts` | cart line and delivery-option Shopify Functions                     | JSON discount metafield produced by discount service           |

## Webhooks and lifecycle

Configured webhook routes cover orders/create, checkouts/create, uninstall, scopes update, and mandatory privacy topics. Compliance helpers live in `app/lib/shopify-compliance-webhooks.server.ts`; privacy logic is in `app/services/privacy.server.ts`. Order/create reconciles discount/attribution data and must remain idempotent. Uninstall cleanup must be shop-scoped.

## Billing and plan gates

Billing configuration is centralized in `app/shopify.server.ts` and `app/services/billing.server.ts`; product limits and premium feature availability are enforced separately by `planLimits.server.ts` and `premiumFeatures.server.ts`. UI hiding alone is not enforcement: public endpoints and mutations must apply their server-side gate.

## Constraints

- Scopes in `shopify.app.toml`, optional-scope requests, API calls, and documentation must agree. Request the minimum required scope.
- Checkout/account extension availability and network access depend on Shopify configuration; fail closed/no-render when unavailable.
- App-proxy aliases exist for Shopify forwarding and test/direct access. Route changes must cover every alias.
- Real-store E2E is opt-in and subject to root/test `AGENTS.md` safeguards.

## Validation

Use `npm run config:check`, focused auth/webhook/billing unit tests, extension-specific tests/build, mocked E2E, and `npx shopify app build --skip-dependencies-installation --no-color` when practical. Real-store checks require explicit environment authorization.

## Related documentation

[Storefront rendering](storefront-rendering.md), existing [webhooks](../webhooks.md), [post-purchase](../post-purchase-extensions.md), and [advanced discounts](../advanced-discounts.md) guides.

## Maintenance

Source of truth: Shopify server/config/manifests and integration routes. Update for scopes, auth mode, webhook, billing, target, or network-access changes.
