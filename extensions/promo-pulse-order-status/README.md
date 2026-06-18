# Promo Pulse Order Status Extension

Customer Account UI Extension for Promo Pulse post-purchase messages.

Target:

- `customer-account.order-status.block.render`

Behavior:

- Fetches an order-status eligible campaign from the Promo Pulse backend.
- Renders a non-blocking banner with optional real countdown.
- Does not mutate the order, payment, cart lines, attributes, or metafields.
- Fails closed when the API is unavailable or the shop plan is not eligible.

See `docs/post-purchase-extensions.md` for setup, plan gating, security, and
test instructions.
