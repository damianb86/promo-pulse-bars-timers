# Post-Purchase Extensions

Promo Pulse soporta mensajes post-compra con dos targets Shopify:

- `purchase.thank-you.block.render` dentro de
  `extensions/promo-pulse-checkout`.
- `customer-account.order-status.block.render` dentro de
  `extensions/promo-pulse-order-status`.

Ambos bloques son no bloqueantes: si el backend falla, si la tienda no tiene
plan elegible o si no hay campana activa para el placement, no muestran nada.

## Placements

El editor de campana permite seleccionar:

- `THANK_YOU_PAGE`
- `ORDER_STATUS_PAGE`

Estos placements usan el mismo gate premium que checkout:

`canUsePremiumFeature(shop, "CHECKOUT_EXTENSIONS")`

El plan minimo es `GROWTH`; `PRO` tambien queda incluido.

## Endpoint

Los bloques consumen:

- Directo: `/api/post-purchase/campaign`
- App Proxy: `/apps/counterpulse-campaigns/api/post-purchase/campaign`

Parametros principales:

- `shop`
- `surface`: `THANK_YOU_PAGE` u `ORDER_STATUS_PAGE`
- `mode`: `AUTO_ELIGIBLE` o `SPECIFIC_CAMPAIGN`
- `campaignId`: requerido solo con `SPECIFIC_CAMPAIGN`
- `compactMode`
- `showTimer`
- `appliedDiscountCodes`: lista opcional para detectar codigos realmente
  usados
- `currency`, `country`, `locale`, `market`

El endpoint directo valida session tokens:

- `THANK_YOU_PAGE`: `authenticate.public.checkout()`
- `ORDER_STATUS_PAGE`: `authenticate.public.customerAccount()`

El App Proxy valida con `authenticate.public.appProxy()`. En
`E2E_TEST_MODE=true`, se permite usar mocks sin Shopify real; el bypass no
funciona en produccion.

## Mensajes Soportados

El backend arma un view model conservador:

- `Offer used successfully`: solo cuando el target reporta un codigo aplicado
  que coincide exactamente con el codigo de la campana.
- `Next order discount`: solo cuando hay un codigo real configurado y no hay
  timer futuro.
- `Delivery promise`: usa texto de delivery configurado por el merchant; si el
  texto tiene placeholders sin resolver, usa fallback seguro.
- `Share this offer`: solo cuando hay CTA URL configurada.
- `Limited-time reorder discount`: solo cuando hay codigo real y `endsAt`
  futuro.

No se inventan descuentos, timers ni claims de uso de oferta.

## Tracking

Los bloques envian eventos al App Proxy analytics existente:

- `POST_PURCHASE_IMPRESSION`
- `REORDER_OFFER_CLICK`

El payload no incluye email, nombre, direccion ni customer ID. Usa
`campaignId`, `placementType`, `currencyCode`, `country`, `locale` y `path`.

## Network Access

Ambas extensiones usan `network_access = true`. Antes de publicar, habilitar
network access en Partner Dashboard. El backend devuelve:

`Access-Control-Allow-Origin: *`

## Como Agregar Los Bloques

1. Ejecutar `shopify app deploy`.
2. Confirmar que aparecen las extensiones:
   - `promo-pulse-checkout`
   - `promo-pulse-order-status`
3. En Shopify Admin, abrir el checkout and accounts editor.
4. Agregar el bloque de thank-you u order-status en la ubicacion soportada.
5. Usar `AUTO_ELIGIBLE` o `SPECIFIC_CAMPAIGN` con `campaignId`.
6. Guardar.

## Limitaciones

- La disponibilidad exacta del editor y de los targets depende del plan y de la
  configuracion de checkout/accounts de Shopify.
- `Offer used successfully` solo aparece cuando Shopify expone los codigos
  aplicados al target y el codigo coincide con la campana.
- El bloque no auto-aplica descuentos ni modifica pedidos.
- El countdown solo aparece con un `endsAt` real futuro.
- El tracking post-compra mejora reporting, pero no marca revenue ni
  conversiones por si solo.

## Como Probar

```bash
npm run test:unit -- app/services/post-purchase/postPurchaseCampaignViewModel.test.ts tests/unit/post-purchase-campaign-endpoint.test.ts tests/unit/post-purchase-extension-api.test.ts
npx playwright test tests/e2e/post-purchase-extension.spec.ts
npx shopify app build --skip-dependencies-installation --no-color
```
