# Campaign capability matrix

The seven renderer types are defined by Prisma and the editor option registry. They share scheduling, targeting, localization, design, placements, experiments, and analytics infrastructure; the matrix calls out specialized runtime data and the placements with implemented product flows. Additional placement combinations may be accepted by generic form controls but are not considered supported without a renderer/test.

| Type                 | Merchant label / common goal               | Countdown                                       | Specialized data                                                 | Implemented primary placements                          | Expiration/dismissal                                         | Main runtime and tests                                                     |
| -------------------- | ------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `COUNTDOWN_BAR`      | Countdown bar / flash sale or announcement | fixed, evergreen, daily; weekly engine-only     | `TimerSettings`                                                  | `TOP_BAR`, `BOTTOM_BAR`, `CUSTOM_SELECTOR`              | all timer expiration options; design dismissal               | general surface/promo runtime; timer tests, `storefront-countdown.spec.ts` |
| `PRODUCT_TIMER`      | Product timer / flash sale                 | fixed, evergreen, daily; weekly engine-only     | `TimerSettings`                                                  | `PRODUCT_PAGE`, optional custom selector                | timer expiration + dismissal                                 | `product-timer.js`; campaign-type/product/design E2E                       |
| `CART_TIMER`         | Cart timer / cart rescue                   | evergreen by default; cart trigger/reset logic  | `TimerSettings`, `CartRescueSettings`                            | `CART_PAGE`, `CART_DRAWER`                              | timer expiration + dismissal; cart trigger can delay display | `cart-timer.js`; cart drawer/campaign-type tests                           |
| `FREE_SHIPPING_GOAL` | Free shipping goal                         | optional shared timer                           | `FreeShippingSettings`, optional discount sync/Markets threshold | `CART_PAGE`, `CART_DRAWER`, global bars, `PRODUCT_PAGE` | timer expiration + dismissal                                 | cart/free-shipping/product runtimes; free-shipping E2E                     |
| `DELIVERY_CUTOFF`    | Delivery cutoff / delivery promise         | cutoff-derived display plus optional timer data | `DeliveryCutoffSettings`, country/Markets overrides              | `PRODUCT_PAGE`, global bars                             | after-cutoff behavior; dismissal                             | `delivery-cutoff.js`/product runtime; delivery tests                       |
| `LOW_STOCK`          | Low stock message                          | no primary countdown                            | `LowStockSettings` and real product inventory context            | `PRODUCT_PAGE`                                          | dismissal; hide/fallback without trustworthy stock           | `low-stock.js`/product runtime; low-stock and campaign-type tests          |
| `PRODUCT_BADGE`      | Product badge                              | optional badge timer slot                       | `BadgeSettings`, optional advanced badge rules                   | `PRODUCT_PAGE_BADGE`, `COLLECTION_CARD`                 | badge timer/dismissal only where rendered                    | badge endpoint + `product-badge.js`; advanced-badge E2E                    |

## Shared capability notes

- Scheduling: all campaigns have nullable start/end/timezone. Display countdown requires the type/view model to serialize timer data.
- Targeting: base targeting is available to all types, subject to context available on the surface. Checkout/post-purchase focused endpoints use reduced safe context.
- Localization: all types use `CampaignTranslation`; type-specific settings add messages such as free-shipping, delivery, low-stock, and badge copy.
- Experiments: variants attach to any campaign, but an override field only works if its serializer/runtime consumes that field.
- Analytics: campaign identity and placement are shared; event production depends on the runtime interaction.
- Thank-you/order-status placements use focused post-purchase view models and are safe-message surfaces rather than full theme rendering of every type.

## Sources of truth

`prisma/schema.prisma`, `app/types/campaign-options.ts`, `app/components/campaign-form/constants.tsx`, `app/utils/storefront-campaigns.ts`, type-specific services/utilities, theme sources, and E2E specs. Exact enum lists are generated in [domain identifiers](../generated/domain-identifiers.md).

## Maintenance

Manually maintained because capability support is distributed across server, editor, and independently built storefront runtimes. Update whenever a type gains/loses a mode, placement, specialized record, override, or test. Confirm code and tests rather than inferring support from an enum.
