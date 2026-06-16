# Promo Pulse Analytics

Promo Pulse uses two storefront signals for Etapa 1 analytics:

1. Theme extension events from rendered campaign UI.
2. Shopify Web Pixel standard events.

## Theme Events

The storefront helper stores a session id in browser storage using:

```text
counterpulse_session_id
```

When a campaign is rendered, clicked, or copied, it also stores a short
attribution record:

```text
counterpulse_last_seen_campaign
```

The value contains only:

- campaign id;
- placement type;
- timestamp.

It does not store customer identity, email, phone, address, or IP address.

## Web Pixel Events

The `Promo Pulse Web Pixel` extension subscribes to:

- `page_viewed`;
- `product_viewed`;
- `collection_viewed`;
- `cart_viewed`;
- `product_added_to_cart`;
- `checkout_started`;
- `checkout_completed`.

The pixel sends a minimal payload to:

```text
/api/analytics/pixel
```

In production, configure the pixel `appEndpoint` setting with the absolute app
URL, for example:

```text
https://your-app.example.com/api/analytics/pixel
```

## Event Mapping

Stored campaign analytics:

- `product_added_to_cart` maps to `ADD_TO_CART`.
- `checkout_started` maps to `CHECKOUT_STARTED`.
- `checkout_completed` maps to `ORDER_ATTRIBUTED` when revenue/order data is
  available.

Received but not stored as campaign metrics:

- `page_viewed`;
- `product_viewed`;
- `collection_viewed`;
- `cart_viewed`.

Those events can become funnel context later, but Etapa 1 keeps the
`AnalyticsEvent` table focused on campaign-attributable metrics.

## Attribution Limits

Etapa 1 attribution is approximate. The pixel cannot reliably know which
campaign caused checkout or purchase, so it uses the most recently rendered
Promo Pulse campaign in the same browser session.

Known limits:

- If no campaign was recently rendered, cart and checkout events are ignored.
- If a customer sees multiple campaigns, the latest stored campaign receives
  attribution.
- Cross-device and cross-browser attribution is not supported.
- Full order attribution depends on `checkout_completed` availability and data
  exposed by Shopify for the app pixel context.
- No customer PII is collected by the Promo Pulse pixel.

For stronger attribution later, add Web Pixel event ids, campaign interaction
history, and server-side reconciliation with Shopify order data where permitted.

## Activation

Required Shopify scopes:

```text
write_pixels,read_customer_events
```

After the app is installed with those scopes, create the web pixel record with
Shopify Admin GraphQL `webPixelCreate` and settings similar to:

```graphql
mutation CreatePromoPulsePixel {
  webPixelCreate(
    webPixel: {
      settings: "{\"shop\":\"example.myshopify.com\",\"appEndpoint\":\"https://your-app.example.com/api/analytics/pixel\"}"
    }
  ) {
    userErrors {
      field
      message
    }
    webPixel {
      id
      settings
    }
  }
}
```

```json
{
  "shop": "example.myshopify.com",
  "appEndpoint": "https://your-app.example.com/api/analytics/pixel"
}
```

In a dev store, run `npm run dev`, use the CLI GraphiQL app, then open Shopify
admin Settings > Customer events to confirm the app pixel is connected.
