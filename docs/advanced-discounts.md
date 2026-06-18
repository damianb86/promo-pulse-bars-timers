# Advanced Discounts

Promo Pulse advanced discounts use Shopify Functions for rules that should not
be modeled as simple native code discounts. Stage 1 Discount Sync remains in
place for basic code/free-shipping flows; this feature adds a separate
`AdvancedDiscountRule` model and a dedicated Function extension.

## What It Supports

- Spend X get Y: qualifies by cart subtotal and applies an order discount when
  no products are configured, or a product discount when product/variant IDs are
  configured.
- Tiered discount: chooses the highest qualifying subtotal tier and applies the
  tier discount.
- Free gift: discounts an already-in-cart configured product or variant by
  100%. It does not auto-add products to the cart.
- Product + shipping combo: can apply a product discount and a delivery discount
  from the same rule when Shopify discount classes allow it.
- Cart contents: applies a product discount when configured product or variant
  IDs are present in the cart.

Rules are serialized into the discount metafield:

- Namespace: `$app:promo-pulse`
- Key: `advanced-discount-config`
- Type: `json`

The Function extension lives at
`extensions/promo-pulse-advanced-discounts` and has two targets:

- `cart.lines.discounts.generate.run`
- `cart.delivery-options.discounts.generate.run`

## Limitations

- Advanced discounts are automatic app discounts. Code-based custom Function
  discounts should use Shopify's code app discount mutations in a later cut.
- Free gift rules only discount a gift item that is already in the cart. Promo
  Pulse does not imply that a gift exists or force-add one.
- Collection IDs are stored in config, but the current Function input query only
  evaluates product and variant IDs. Collection membership requires a follow-up
  query strategy before enabling collection targeting in production rules.
- Shipping discounts depend on Shopify discount classes and combination rules.
  If Shopify does not grant the shipping class for a discount, the Function
  returns no delivery operation.
- `functionHandle` is preferred. `functionId` is still supported as a fallback
  for stores or versions using older Admin API examples.

## Admin API

The service functions are in
`app/services/discounts/advancedDiscounts.server.ts`:

- `createAppDiscount()`
- `updateAppDiscount()`
- `deleteAppDiscount()`

They create/update/delete Shopify automatic app discounts through GraphQL Admin
API when a Function handle or ID is available. In `E2E_TEST_MODE=true`, they use
controlled `e2e://advanced-discount/...` IDs and do not call Shopify.

Configure one of these when activating rules against Shopify:

```bash
SHOPIFY_ADVANCED_DISCOUNT_FUNCTION_HANDLE=promo-pulse-advanced-discounts
SHOPIFY_ADVANCED_DISCOUNT_FUNCTION_ID=<legacy function id fallback>
```

## Scopes

Required:

- `write_discounts`
- `read_discounts`
- `read_products`

These are already present in `shopify.app.toml`.

## How To Test

```bash
npx prisma generate
npx prisma migrate deploy
npm --prefix extensions/promo-pulse-advanced-discounts run build
npm --prefix extensions/promo-pulse-advanced-discounts test
npm run test:unit
```

For UI smoke testing, open a Pro-plan shop, edit a campaign, and use the
`Advanced Discount Rules` section. Non-Pro shops should only see the plan-gating
callout.

## References

- Shopify Build a Discount Function:
  https://shopify.dev/docs/apps/build/discounts/build-discount-function
- Shopify JavaScript for Functions:
  https://shopify.dev/docs/apps/build/functions/programming-languages/javascript-for-functions
- Shopify `discountAutomaticAppCreate`:
  https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountAutomaticAppCreate
- Shopify `DiscountAutomaticAppInput`:
  https://shopify.dev/docs/api/admin-graphql/latest/input-objects/DiscountAutomaticAppInput
- Shopify `discountAutomaticAppUpdate`:
  https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountAutomaticAppUpdate
