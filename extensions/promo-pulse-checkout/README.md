# Promo Pulse Checkout Extension

Checkout UI Extension for Promo Pulse promotional messages.

Target:

- `purchase.checkout.block.render`
- `purchase.thank-you.block.render`

Behavior:

- Fetches a checkout-safe campaign from the Promo Pulse backend.
- Renders a non-blocking banner with optional real countdown.
- Does not mutate checkout, payment, cart lines, attributes, or metafields.
- Fails closed when the API is unavailable or the shop plan is not eligible.

See `docs/checkout-ui-extension.md` for setup, plan gating, security, and test
instructions.
