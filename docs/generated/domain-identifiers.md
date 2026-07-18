# Generated domain identifiers

> GENERATED FILE — do not edit. Run `npm run docs:generate`. Sources: `prisma/schema.prisma` and `app/types/campaign-options.ts`.

The generator also verifies that campaign-type and placement option registries contain exactly the corresponding Prisma enum values. Capability support is intentionally documented in the manually reviewed [campaign capability matrix](../campaign-types/capability-matrix.md).

## Campaign types

| Identifier           | Admin label        |
| -------------------- | ------------------ |
| `COUNTDOWN_BAR`      | Countdown bar      |
| `PRODUCT_TIMER`      | Product timer      |
| `CART_TIMER`         | Cart timer         |
| `FREE_SHIPPING_GOAL` | Free shipping goal |
| `DELIVERY_CUTOFF`    | Delivery cutoff    |
| `LOW_STOCK`          | Low stock message  |
| `PRODUCT_BADGE`      | Product badge      |

## Campaign goals

- `FLASH_SALE`
- `FREE_SHIPPING`
- `CART_RESCUE`
- `SHIPPING_PROMISE`
- `LOW_STOCK_URGENCY`
- `DELIVERY_CUTOFF`
- `PRODUCT_BADGE`
- `ANNOUNCEMENT`
- `LAUNCH`
- `PREORDER`

## Placements

| Identifier           | Admin label           | Description                                                  |
| -------------------- | --------------------- | ------------------------------------------------------------ |
| `TOP_BAR`            | Top bar               | Global bar injected at the top of the storefront.            |
| `BOTTOM_BAR`         | Bottom bar            | Global bar injected at the bottom of the storefront.         |
| `PRODUCT_PAGE`       | Product page          | Product detail page block or automatic product-page surface. |
| `PRODUCT_PAGE_BADGE` | Product page badge    | Badge over product media on product detail pages only.       |
| `COLLECTION_CARD`    | Collection card badge | Badge rendered on product cards in collection/search grids.  |
| `CART_PAGE`          | Cart page             | Cart page module.                                            |
| `CART_DRAWER`        | Cart drawer           | Cart drawer module.                                          |
| `THANK_YOU_PAGE`     | Thank you page        | Post-purchase thank you page extension.                      |
| `ORDER_STATUS_PAGE`  | Order status page     | Order status page extension.                                 |
| `CUSTOM_SELECTOR`    | Custom HTML slot      | Renders into a configured selector or Campaign ID snippet.   |

## Timer modes

- `FIXED_DATE`
- `EVERGREEN_SESSION`
- `RECURRING_DAILY`
- `RECURRING_WEEKLY`

## Timer expiration behaviors

- `UNPUBLISH_TIMER`
- `HIDE_TIMER`
- `REPEAT_COUNTDOWN`
- `SHOW_CUSTOM_TITLE`
- `DO_NOTHING`

## Analytics events

- `IMPRESSION`
- `CLICK`
- `PRODUCT_VIEWED`
- `BADGE_IMPRESSION`
- `BADGE_CLICK`
- `COPY_CODE`
- `UNIQUE_CODE_ASSIGNED`
- `APPLY_CODE_CLICKED`
- `ADD_TO_CART`
- `CHECKOUT_STARTED`
- `POST_PURCHASE_IMPRESSION`
- `REORDER_OFFER_CLICK`
- `ORDER_ATTRIBUTED`
